import { randomUUID } from "node:crypto";

import type { RequestContext } from "../graphql/context.ts";
import { apiError, notFound } from "../graphql/errors.ts";
import type { OfflineTokenClaims } from "./paseto.ts";
import {
  type DbClient,
  type DeviceRow,
  findOfflineTokenByJti,
  findUserById,
  insertAuditEvent,
  insertOfflineToken,
  type OfflineTokenRow,
  rotateOfflineToken,
  type UserRow,
} from "./repository.ts";

export const OFFLINE_TOKEN_SCOPE = [
  "sales:create",
  "catalog:read",
  "inventory:read",
] as const;

export interface OfflineTokenView {
  token: string;
  jti: string;
  expiresAt: Date;
  graceUntil: Date;
}

export async function issueOfflineToken(
  client: DbClient,
  context: RequestContext,
  input: {
    user: UserRow;
    device: DeviceRow;
    deviceKeyId: string;
    rotateJti?: string | null;
  },
): Promise<OfflineTokenView | null> {
  if (input.device.platform !== "TAURI") return null;

  const now = context.auth.now();
  const expiresAt = new Date(now.getTime() + context.auth.paseto.offlineTtlMs);
  const graceUntil = new Date(
    expiresAt.getTime() + context.auth.paseto.offlineGraceMs,
  );
  const jti = randomUUID();
  const token = context.auth.paseto.signOfflineToken(
    {
      sub: input.user.id,
      device_id: input.device.id,
      device_key_id: input.deviceKeyId,
      scope: [...OFFLINE_TOKEN_SCOPE],
      jti,
      exp: expiresAt.toISOString(),
      grace_until: graceUntil.toISOString(),
    },
    now,
  );

  if (input.rotateJti) {
    const rotated = await rotateOfflineToken(client, input.rotateJti);
    if (rotated) {
      await insertAuditEvent(client, {
        eventType: "OFFLINE_TOKEN_ROTATED",
        actorUserId: input.user.id,
        deviceId: input.device.id,
        entityType: "offline_token",
        metadata: { jti: input.rotateJti },
      });
    }
  }

  const row = await insertOfflineToken(client, {
    jti,
    deviceId: input.device.id,
    issuedToUserId: input.user.id,
    scope: [...OFFLINE_TOKEN_SCOPE],
    issuedAt: now,
    expiresAt,
    graceUntil,
  });

  await insertAuditEvent(client, {
    eventType: "OFFLINE_TOKEN_ISSUED",
    actorUserId: input.user.id,
    deviceId: input.device.id,
    entityType: "offline_token",
    entityId: row.jti,
    metadata: { scope: OFFLINE_TOKEN_SCOPE },
  });

  return { token, jti, expiresAt, graceUntil };
}

export interface VerifiedOfflineToken {
  claims: OfflineTokenClaims;
  row: OfflineTokenRow;
  user: UserRow;
  /** Token expired but remains usable inside its grace window. */
  graceOnly: boolean;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function verifyOfflineTokenForDevice(
  context: RequestContext,
  token: string,
  device: DeviceRow,
): Promise<VerifiedOfflineToken> {
  const claims = context.auth.paseto.verifyOfflineToken(token);
  if (!claims) throw apiError("INVALID_SIGNATURE");
  if (
    claims.device_id !== device.id ||
    !UUID_PATTERN.test(claims.jti) ||
    !UUID_PATTERN.test(claims.sub)
  ) {
    throw apiError("INVALID_SIGNATURE");
  }

  const row = await findOfflineTokenByJti(claims.jti);
  if (!row || row.deviceId !== device.id || row.issuedToUserId !== claims.sub) {
    throw apiError("INVALID_SIGNATURE");
  }

  if (row.revokedAt || row.rotatedAt) {
    throw apiError("OFFLINE_TOKEN_EXPIRED");
  }

  const hasScope = OFFLINE_TOKEN_SCOPE.every(
    (scope) => claims.scope.includes(scope) && row.scope.includes(scope),
  );
  if (!hasScope) throw apiError("FORBIDDEN");

  const user = await findUserById(row.issuedToUserId);
  if (!user) throw notFound("Pengguna tidak ditemukan.");
  if (!user.isActive) throw apiError("USER_DISABLED");

  const now = context.auth.now();
  if (new Date(row.graceUntil).getTime() <= now.getTime()) {
    throw apiError("GRACE_EXPIRED");
  }
  const graceOnly = new Date(row.expiresAt).getTime() <= now.getTime();

  return { claims, row, user, graceOnly };
}
