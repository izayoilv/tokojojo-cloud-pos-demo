import { type DeviceView, deviceView } from "../auth/device-view.ts";
import {
  findDevicesByIds,
  findUsersByIds,
  getSqlClient,
  listDeviceKeysByIds,
} from "../auth/repository.ts";
import { userRowToContextUser } from "../auth/user-mapper.ts";
import {
  type DbClient,
  normalizePage,
  type PageInfo,
  pageInfo,
  resolveSort,
  toDate,
} from "../db/query.ts";
import type { ContextUser } from "../graphql/context.ts";

export interface AuditEventView {
  id: string;
  eventType: string;
  actor: ContextUser | null;
  deviceId: string | null;
  device: DeviceView | null;
  entityType: string | null;
  entityId: string | null;
  metadata: string;
  createdAt: Date | string;
  retentionUntil: Date | string;
}

export interface AuditEventPageView {
  items: AuditEventView[];
  pageInfo: PageInfo;
}

interface AuditEventRow {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  device_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  retention_until: Date;
}

export async function listAuditEvents(
  input: {
    filter?: {
      eventType?: string | null;
      actorUserId?: string | null;
      deviceId?: string | null;
      entityType?: string | null;
      entityId?: string | null;
      range?: {
        from?: Date | string | null;
        to?: Date | string | null;
      } | null;
    } | null;
    page?: { page: number; pageSize: number } | null;
    sort?: { field: string; direction: "ASC" | "DESC" } | null;
  },
  clientOverride?: DbClient,
): Promise<AuditEventPageView> {
  const client = clientOverride ?? (await getSqlClient());
  const page = normalizePage(input.page);
  const order = resolveSort(
    input.sort,
    {
      createdAt: "e.created_at",
      eventType: "e.event_type",
      entityType: "e.entity_type",
    },
    "e.created_at",
  );
  const eventType = input.filter?.eventType ?? null;
  const actorUserId = input.filter?.actorUserId ?? null;
  const deviceId = input.filter?.deviceId ?? null;
  const entityType = input.filter?.entityType ?? null;
  const entityId = input.filter?.entityId ?? null;
  const from = toDate(input.filter?.range?.from)?.toISOString() ?? null;
  const to = toDate(input.filter?.range?.to)?.toISOString() ?? null;
  const direction = order.direction === "ASC" ? client`asc` : client`desc`;
  const offset = (page.page - 1) * page.pageSize;

  const [countRow] = await client`
    select count(*)::int as total
    from audit_events e
    where (${eventType}::text is null or e.event_type = ${eventType})
      and (${actorUserId}::text is null
        or e.actor_user_id::text = ${actorUserId})
      and (${deviceId}::text is null or e.device_id::text = ${deviceId})
      and (${entityType}::text is null or e.entity_type = ${entityType})
      and (${entityId}::text is null or e.entity_id::text = ${entityId})
      and (${from}::timestamptz is null or e.created_at >= ${from}::timestamptz)
      and (${to}::timestamptz is null or e.created_at <= ${to}::timestamptz)`;

  const rows = (await client`
    select
      e.id, e.event_type, e.actor_user_id, e.device_id, e.entity_type,
      e.entity_id, e.metadata, e.created_at, e.retention_until
    from audit_events e
    where (${eventType}::text is null or e.event_type = ${eventType})
      and (${actorUserId}::text is null
        or e.actor_user_id::text = ${actorUserId})
      and (${deviceId}::text is null or e.device_id::text = ${deviceId})
      and (${entityType}::text is null or e.entity_type = ${entityType})
      and (${entityId}::text is null or e.entity_id::text = ${entityId})
      and (${from}::timestamptz is null or e.created_at >= ${from}::timestamptz)
      and (${to}::timestamptz is null or e.created_at <= ${to}::timestamptz)
    order by ${client(order.expression)} ${direction}
    limit ${page.pageSize} offset ${offset}`) as AuditEventRow[];

  const actorIds = [
    ...new Set(
      rows
        .map((row) => row.actor_user_id)
        .filter((id): id is string => id !== null),
    ),
  ];
  const deviceIds = [
    ...new Set(
      rows
        .map((row) => row.device_id)
        .filter((id): id is string => id !== null),
    ),
  ];
  const [devices, deviceKeys] = await Promise.all([
    findDevicesByIds(deviceIds, client),
    listDeviceKeysByIds(deviceIds, client),
  ]);
  const userIds = new Set(actorIds);
  for (const device of devices.values()) {
    userIds.add(device.enrolledByUserId);
  }
  const users = await findUsersByIds([...userIds], client);
  const deviceViews = new Map<string, DeviceView>();
  for (const [deviceId, device] of devices) {
    const enrolledBy = users.get(device.enrolledByUserId);
    if (!enrolledBy) continue;
    deviceViews.set(
      deviceId,
      deviceView(
        device,
        userRowToContextUser(enrolledBy, null),
        deviceKeys.get(deviceId) ?? [],
      ),
    );
  }

  const items: AuditEventView[] = rows.map((row) => {
    const actor = row.actor_user_id
      ? (users.get(row.actor_user_id) ?? null)
      : null;
    return {
      id: row.id,
      eventType: row.event_type,
      actor: actor ? userRowToContextUser(actor, null) : null,
      deviceId: row.device_id,
      device: row.device_id ? (deviceViews.get(row.device_id) ?? null) : null,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: JSON.stringify(row.metadata ?? {}),
      createdAt: row.created_at,
      retentionUntil: row.retention_until,
    };
  });

  return { items, pageInfo: pageInfo(page, Number(countRow.total)) };
}

/**
 * Audit rows carry a 180-day `retention_until`; this job removes only rows
 * whose retention window has fully elapsed.
 */
export async function purgeExpiredAuditEvents(
  now = new Date(),
): Promise<number> {
  const client = await getSqlClient();
  const rows = await client`
    delete from audit_events
    where retention_until <= ${now.toISOString()}::timestamptz
    returning id`;
  return rows.length;
}

export function startAuditRetentionJob(
  intervalMs = 24 * 60 * 60 * 1000,
): () => void {
  const run = (): void => {
    void purgeExpiredAuditEvents().catch((error: unknown) => {
      console.error(
        JSON.stringify({
          level: "error",
          message: "audit_retention_failed",
          errorName: error instanceof Error ? error.name : typeof error,
        }),
      );
    });
  };

  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
