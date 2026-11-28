import { randomBytes } from "node:crypto";

import type { RequestContext } from "../graphql/context.ts";
import {
  apiError,
  conflict,
  forbidden,
  notFound,
  validationFailed,
} from "../graphql/errors.ts";
import { verifyLoginCredentials } from "./credentials.ts";
import {
  isUsableDeviceKey,
  verifyDeviceSignature,
} from "./device-signature.ts";
import { type DeviceView, deviceView, loadDeviceView } from "./device-view.ts";
import {
  approveDeviceById,
  createDeviceWithKey,
  type DeviceRow,
  findDeviceById,
  findDeviceWithKey,
  getSqlClient,
  insertAuditEvent,
  insertAuthNonce,
  insertDeviceKey,
  listDeviceKeys,
  listDevices,
  listSessionsWithUsers,
  retireDeviceKey,
  revokeDeviceById,
  revokeSessionById,
  type SessionWithUserRow,
  updateUserPasswordHash,
  type UserRow,
} from "./repository.ts";
import { hashToken } from "./tokens.ts";
import { userRowToContextUser } from "./user-mapper.ts";

const NONCE_TTL_MS = 2 * 60 * 1000;
const RETIRED_KEY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export interface NativeEnrollmentResult {
  user: ReturnType<typeof userRowToContextUser>;
  device: DeviceView;
  serverTime: Date;
}

export interface SessionView {
  id: string;
  user: ReturnType<typeof userRowToContextUser>;
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  userAgent: string | null;
  ip: string | null;
}

export interface DeviceListView {
  items: DeviceView[];
  total: number;
}

export interface IssuedNonce {
  nonce: string;
  serverTime: Date;
  expiresAt: Date;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505"
  );
}

function assertRawPublicKey(value: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw validationFailed("publicKey harus base64url tanpa padding.");
  }
  const raw = Buffer.from(value, "base64url");
  if (raw.length !== 32 || raw.toString("base64url") !== value) {
    throw validationFailed("publicKey harus raw Ed25519 32 byte.");
  }
}

function assertKeyId(value: string): void {
  if (!value.trim()) throw validationFailed("keyId wajib diisi.");
}

export async function enrollDevice(
  context: RequestContext,
  input: {
    username: string;
    password: string;
    name: string;
    platform: "ANDROID" | "TAURI";
    keyId: string;
    publicKey: string;
  },
): Promise<NativeEnrollmentResult> {
  if (!input.name.trim()) throw validationFailed("Nama perangkat wajib diisi.");
  assertKeyId(input.keyId);
  assertRawPublicKey(input.publicKey);

  const credentials = await verifyLoginCredentials(context, {
    username: input.username,
    password: input.password,
  });
  const { user, rehashedPassword, rehashedPepperVersion } = credentials;

  const allowedRoles =
    input.platform === "TAURI"
      ? new Set(["OWNER", "ADMIN"])
      : new Set(["WAREHOUSE", "ADMIN", "OWNER"]);
  if (!allowedRoles.has(user.role)) {
    throw forbidden(
      `Role ${user.role} tidak diizinkan mendaftarkan perangkat ${input.platform}.`,
    );
  }

  const now = context.auth.now();
  const sql = await getSqlClient();

  let created: { device: DeviceRow; enrolledBy: UserRow } | null = null;
  try {
    await sql.begin(async (transaction) => {
      const result = await createDeviceWithKey(transaction, {
        name: input.name.trim(),
        platform: input.platform,
        enrolledByUserId: user.id,
        keyId: input.keyId,
        publicKey: input.publicKey,
      });

      if (rehashedPassword && rehashedPepperVersion) {
        await updateUserPasswordHash(transaction, {
          userId: user.id,
          passwordHash: rehashedPassword,
          pepperVersion: rehashedPepperVersion,
        });
      }

      await insertAuditEvent(transaction, {
        eventType: "DEVICE_ENROLLED",
        actorUserId: user.id,
        deviceId: result.device.id,
        entityType: "device",
        entityId: result.device.id,
        metadata: {
          platform: input.platform,
          name: input.name.trim(),
        },
      });

      created = {
        device: result.device,
        enrolledBy: {
          ...user,
          passwordHash: rehashedPassword ?? user.passwordHash,
          passwordPepperVersion:
            rehashedPepperVersion ?? user.passwordPepperVersion,
        },
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("keyId sudah dipakai perangkat lain.");
    }
    throw error;
  }

  if (!created) throw conflict("Perangkat gagal dibuat.");
  context.auth.rateLimit.reset(context.ip ?? "unknown", user.username);

  const result = created as {
    device: DeviceRow;
    enrolledBy: UserRow;
  };
  const enrolledBy = userRowToContextUser(result.enrolledBy, now);
  const keys = await listDeviceKeys(result.device.id);

  return {
    user: enrolledBy,
    device: deviceView(result.device, enrolledBy, keys),
    serverTime: now,
  };
}

export async function approveDevice(
  context: RequestContext,
  deviceId: string,
): Promise<DeviceView> {
  const existing = await findDeviceById(deviceId);
  if (!existing) throw notFound("Perangkat tidak ditemukan.");
  if (existing.status === "REVOKED") {
    throw conflict("Perangkat sudah dicabut.");
  }

  if (existing.status === "PENDING") {
    const sql = await getSqlClient();
    await sql.begin(async (transaction) => {
      const approved = await approveDeviceById(transaction, deviceId);
      if (!approved) return;

      await insertAuditEvent(transaction, {
        eventType: "DEVICE_APPROVED",
        actorUserId: context.user?.id ?? null,
        deviceId,
        entityType: "device",
        entityId: deviceId,
        metadata: {},
      });
    });
  }

  const device = await loadDeviceView(deviceId);
  if (!device) throw notFound("Perangkat tidak ditemukan.");
  return device;
}

export async function revokeDevice(
  context: RequestContext,
  deviceId: string,
): Promise<DeviceView> {
  const existing = await findDeviceById(deviceId);
  if (!existing) throw notFound("Perangkat tidak ditemukan.");

  if (existing.status !== "REVOKED") {
    const sql = await getSqlClient();
    await sql.begin(async (transaction) => {
      const revoked = await revokeDeviceById(transaction, deviceId);
      if (!revoked) return;

      await insertAuditEvent(transaction, {
        eventType: "DEVICE_REVOKED",
        actorUserId: context.user?.id ?? null,
        deviceId,
        entityType: "device",
        entityId: deviceId,
        metadata: {},
      });
      await insertAuditEvent(transaction, {
        eventType: "OFFLINE_TOKENS_REVOKED",
        actorUserId: context.user?.id ?? null,
        deviceId,
        entityType: "device",
        entityId: deviceId,
        metadata: { reason: "DEVICE_REVOKED" },
      });
    });
  }

  const device = await loadDeviceView(deviceId);
  if (!device) throw notFound("Perangkat tidak ditemukan.");
  return device;
}

export async function rotateDeviceKey(
  context: RequestContext,
  input: { deviceId: string; keyId: string; publicKey: string },
): Promise<DeviceView> {
  assertKeyId(input.keyId);
  assertRawPublicKey(input.publicKey);

  const proof = await verifyDeviceSignature(
    context,
    "rotateDeviceKey",
    `${input.keyId}:${input.publicKey}`,
  );

  if (
    proof.device.id !== input.deviceId ||
    context.device?.id !== input.deviceId
  ) {
    throw apiError("INVALID_SIGNATURE");
  }
  if (proof.device.status === "PENDING") {
    throw apiError("DEVICE_PENDING");
  }
  if (proof.device.status !== "ACTIVE") {
    throw apiError("DEVICE_REVOKED");
  }

  const now = context.auth.now();
  const retiredAt = now;
  const acceptedUntil = new Date(now.getTime() + RETIRED_KEY_WINDOW_MS);
  const sql = await getSqlClient();

  try {
    await sql.begin(async (transaction) => {
      await retireDeviceKey(transaction, {
        deviceId: proof.device.id,
        retiredAt,
        acceptedUntil,
      });

      await insertDeviceKey(transaction, {
        deviceId: proof.device.id,
        keyId: input.keyId,
        publicKey: input.publicKey,
        activatedAt: now,
      });

      await insertAuditEvent(transaction, {
        eventType: "DEVICE_KEY_ROTATED",
        actorUserId: context.user?.id ?? null,
        deviceId: proof.device.id,
        entityType: "device",
        entityId: proof.device.id,
        metadata: {
          oldKeyId: proof.key.keyId,
          newKeyId: input.keyId,
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("keyId sudah dipakai perangkat lain.");
    }
    throw error;
  }

  const device = await loadDeviceView(proof.device.id);
  if (!device) throw notFound("Perangkat tidak ditemukan.");
  return device;
}

export async function listDeviceViews(input: {
  search?: string | null;
  platform?: string | null;
  status?: string | null;
  page: number;
  pageSize: number;
}): Promise<DeviceListView> {
  const result = await listDevices(input);
  const items = await Promise.all(
    result.items.map(async (device) => {
      const view = await loadDeviceView(device.id);
      return view;
    }),
  );

  return {
    items: items.filter((item): item is DeviceView => item !== null),
    total: result.total,
  };
}

export async function getDeviceForViewer(
  context: RequestContext,
  deviceId: string,
): Promise<DeviceView | null> {
  if (context.role !== "OWNER" && context.role !== "ADMIN") {
    if (context.device?.id !== deviceId) throw forbidden();
  }
  return loadDeviceView(deviceId);
}

export function sessionView(row: SessionWithUserRow): SessionView {
  return {
    id: row.id,
    user: userRowToContextUser(row.user, null),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    lastSeenAt: row.lastSeenAt,
    revokedAt: row.revokedAt,
    userAgent: row.userAgent,
    ip: row.ip,
  };
}

export async function listSessionViews(): Promise<SessionView[]> {
  return (await listSessionsWithUsers()).map(sessionView);
}

export async function revokeSession(
  context: RequestContext,
  sessionId: string,
): Promise<boolean> {
  const sql = await getSqlClient();
  let revoked: { id: string; userId: string } | null = null;

  await sql.begin(async (transaction) => {
    revoked = await revokeSessionById(transaction, sessionId);
    if (!revoked) return;

    await insertAuditEvent(transaction, {
      eventType: "SESSION_REVOKED",
      actorUserId: context.user?.id ?? null,
      entityType: "session",
      entityId: revoked.id,
      metadata: {
        sessionUserId: revoked.userId,
        reason: "ADMIN_REVOKED",
      },
    });
  });

  return revoked !== null;
}

export async function issueAuthNonce(input: {
  deviceId: string;
  keyId: string;
  now: Date;
}): Promise<IssuedNonce> {
  const record = await findDeviceWithKey(input.deviceId, input.keyId);
  if (!record) throw notFound("Perangkat atau kunci tidak ditemukan.");
  if (record.device.status === "REVOKED") {
    throw apiError("DEVICE_REVOKED");
  }
  if (!isUsableDeviceKey(record.key, input.now)) {
    throw apiError("INVALID_SIGNATURE", "Kunci perangkat tidak valid.");
  }

  const nonce = randomBytes(32).toString("base64url");
  const expiresAt = new Date(input.now.getTime() + NONCE_TTL_MS);
  const sql = await getSqlClient();
  await insertAuthNonce(sql, {
    nonceHash: hashToken(nonce),
    deviceId: input.deviceId,
    expiresAt,
  });

  return { nonce, serverTime: input.now, expiresAt };
}
