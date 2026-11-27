import { randomUUID } from "node:crypto";

import type { RequestContext } from "../graphql/context.ts";
import {
  apiError,
  unauthenticated,
  validationFailed,
} from "../graphql/errors.ts";
import {
  verifyLoginCredentials,
  writeLoginFailureAudit,
} from "./credentials.ts";
import { verifyDeviceSignature } from "./device-signature.ts";
import { type DeviceView, loadDeviceView } from "./device-view.ts";
import { issueOfflineToken, type OfflineTokenView } from "./offline.ts";
import type { PasetoPublicKey } from "./paseto.ts";
import type { Role } from "./permissions.ts";
import {
  findRefreshTokenByHash,
  findUserById,
  getSqlClient,
  insertAuditEvent,
  insertRefreshToken,
  revokeRefreshTokenFamily,
  rotateRefreshToken,
  touchDevice,
  updateUserPasswordHash,
} from "./repository.ts";
import {
  generateRefreshToken,
  hashToken,
  refreshTokenSubject,
} from "./tokens.ts";
import { userRowToContextUser } from "./user-mapper.ts";

export interface NativeAuthResult {
  user: ReturnType<typeof userRowToContextUser>;
  device: DeviceView;
  accessToken: string | null;
  accessExpiresAt: Date;
  refreshToken: string | null;
  refreshExpiresAt: Date | null;
  offlineToken: string | null;
  offlineExpiresAt: Date | null;
  graceUntil: Date | null;
  serverTime: Date;
  keySet: PasetoPublicKey[];
}

function nativePlatform(context: RequestContext): "ANDROID" | "TAURI" {
  const platform = context.clientPlatform?.toUpperCase();
  if (platform !== "ANDROID" && platform !== "TAURI") {
    throw validationFailed(
      "Login native memerlukan header X-Client-Platform: ANDROID atau TAURI.",
    );
  }
  return platform;
}

function errorCode(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const extensions = (error as { extensions?: { code?: unknown } })
      .extensions;
    if (typeof extensions?.code === "string") return extensions.code;
  }
  return "INVALID_SIGNATURE";
}

function accessClaims(
  userId: string,
  role: Role,
  deviceId: string,
  platform: "ANDROID" | "TAURI",
) {
  return {
    sub: userId,
    role,
    deviceId,
    platform,
  };
}

export async function loginNative(
  context: RequestContext,
  input: { username: string; password: string },
): Promise<NativeAuthResult> {
  const platform = nativePlatform(context);
  let proof;
  try {
    proof = await verifyDeviceSignature(context, "login", input.username);
  } catch (error) {
    await writeLoginFailureAudit(
      context,
      null,
      input.username,
      errorCode(error),
      {
        platform,
        deviceId: context.deviceId,
      },
    );
    throw error;
  }
  const credentials = await verifyLoginCredentials(context, input);
  const { user, rehashedPassword, rehashedPepperVersion } = credentials;
  const now = context.auth.now();
  const sql = await getSqlClient();

  if (proof.device.status === "PENDING") {
    await sql.begin(async (transaction) => {
      if (rehashedPassword && rehashedPepperVersion) {
        await updateUserPasswordHash(transaction, {
          userId: user.id,
          passwordHash: rehashedPassword,
          pepperVersion: rehashedPepperVersion,
        });
      }
      await touchDevice(transaction, proof.device.id, now);
      await insertAuditEvent(transaction, {
        eventType: "AUTH_LOGIN_SUCCEEDED",
        actorUserId: user.id,
        deviceId: proof.device.id,
        entityType: "device",
        entityId: proof.device.id,
        metadata: { platform, deviceStatus: "PENDING" },
      });
    });

    context.auth.rateLimit.reset(context.ip ?? "unknown", user.username);
    const device = await loadDeviceView(proof.device.id);

    return {
      user: userRowToContextUser(
        {
          ...user,
          passwordHash: rehashedPassword ?? user.passwordHash,
          passwordPepperVersion:
            rehashedPepperVersion ?? user.passwordPepperVersion,
        },
        now,
      ),
      device: device!,
      accessToken: null,
      accessExpiresAt: now,
      refreshToken: null,
      refreshExpiresAt: null,
      offlineToken: null,
      offlineExpiresAt: null,
      graceUntil: null,
      serverTime: now,
      keySet: context.auth.paseto.keySet,
    };
  }

  if (proof.device.status !== "ACTIVE") {
    throw apiError("DEVICE_REVOKED");
  }

  const access = context.auth.paseto.signAccessToken(
    accessClaims(user.id, user.role, proof.device.id, platform),
    now,
  );
  const refreshToken = generateRefreshToken(user.id);
  const refreshExpiresAt = new Date(now.getTime() + context.auth.refreshTtlMs);
  const offlineHolder: { value: OfflineTokenView | null } = { value: null };

  await sql.begin(async (transaction) => {
    if (rehashedPassword && rehashedPepperVersion) {
      await updateUserPasswordHash(transaction, {
        userId: user.id,
        passwordHash: rehashedPassword,
        pepperVersion: rehashedPepperVersion,
      });
    }

    await insertRefreshToken(transaction, {
      deviceId: proof.device.id,
      tokenHash: hashToken(refreshToken),
      familyId: randomUUID(),
      expiresAt: refreshExpiresAt,
    });

    const [activeOffline] = await transaction`
      select jti from offline_tokens
      where device_id = ${proof.device.id}
        and rotated_at is null and revoked_at is null
      order by issued_at desc, jti desc
      limit 1`;

    offlineHolder.value = await issueOfflineToken(transaction, context, {
      user,
      device: proof.device,
      deviceKeyId: proof.key.keyId,
      rotateJti: activeOffline?.jti ?? null,
    });

    await touchDevice(transaction, proof.device.id, now);

    await insertAuditEvent(transaction, {
      eventType: "AUTH_LOGIN_SUCCEEDED",
      actorUserId: user.id,
      deviceId: proof.device.id,
      entityType: "device",
      entityId: proof.device.id,
      metadata: { platform, deviceStatus: "ACTIVE" },
    });
  });

  context.auth.rateLimit.reset(context.ip ?? "unknown", user.username);
  const device = await loadDeviceView(proof.device.id);

  return {
    user: userRowToContextUser(
      {
        ...user,
        passwordHash: rehashedPassword ?? user.passwordHash,
        passwordPepperVersion:
          rehashedPepperVersion ?? user.passwordPepperVersion,
      },
      now,
    ),
    device: device!,
    accessToken: access.token,
    accessExpiresAt: access.expiresAt,
    refreshToken,
    refreshExpiresAt,
    offlineToken: offlineHolder.value?.token ?? null,
    offlineExpiresAt: offlineHolder.value?.expiresAt ?? null,
    graceUntil: offlineHolder.value?.graceUntil ?? null,
    serverTime: now,
    keySet: context.auth.paseto.keySet,
  };
}

export async function refreshNative(
  context: RequestContext,
  input: { refreshToken: string },
): Promise<NativeAuthResult> {
  const platform = nativePlatform(context);
  const ip = context.ip ?? "unknown";
  const key = context.deviceId ?? "unknown";
  if (!context.auth.refreshRateLimit.check(ip, key)) {
    throw apiError("RATE_LIMITED");
  }
  context.auth.refreshRateLimit.recordFailure(ip, key);

  const proof = await verifyDeviceSignature(
    context,
    "refresh",
    input.refreshToken,
  );

  const subjectUserId = refreshTokenSubject(input.refreshToken);
  if (!subjectUserId) {
    throw unauthenticated("Refresh token tidak valid.");
  }

  const user = await findUserById(subjectUserId);
  if (!user) throw unauthenticated("Refresh token tidak valid.");
  if (!user.isActive) throw apiError("USER_DISABLED");

  const token = await findRefreshTokenByHash(hashToken(input.refreshToken));
  if (!token || token.deviceId !== proof.device.id) {
    throw unauthenticated("Refresh token tidak valid.");
  }

  const now = context.auth.now();
  const device = await loadDeviceView(proof.device.id);

  if (proof.device.status === "PENDING") {
    return {
      user: userRowToContextUser(user, null),
      device: device!,
      accessToken: null,
      accessExpiresAt: now,
      refreshToken: null,
      refreshExpiresAt: null,
      offlineToken: null,
      offlineExpiresAt: null,
      graceUntil: null,
      serverTime: now,
      keySet: context.auth.paseto.keySet,
    };
  }

  if (proof.device.status !== "ACTIVE") {
    throw apiError("DEVICE_REVOKED");
  }

  if (token.revokedAt) {
    throw unauthenticated("Refresh token tidak valid.");
  }

  if (token.rotatedAt) {
    const sql = await getSqlClient();
    await sql.begin(async (transaction) => {
      await revokeRefreshTokenFamily(transaction, token.familyId);
      await insertAuditEvent(transaction, {
        eventType: "AUTH_REFRESH_REUSE_DETECTED",
        actorUserId: user.id,
        deviceId: proof.device.id,
        entityType: "refresh_token_family",
        metadata: { familyId: token.familyId },
      });
    });
    throw unauthenticated("Refresh token sudah dipakai.");
  }

  if (new Date(token.expiresAt).getTime() <= now.getTime()) {
    throw unauthenticated("Refresh token sudah kedaluwarsa.");
  }

  const access = context.auth.paseto.signAccessToken(
    accessClaims(user.id, user.role, proof.device.id, platform),
    now,
  );
  const nextRefreshToken = generateRefreshToken(user.id);
  const nextRefreshExpiresAt = new Date(
    now.getTime() + context.auth.refreshTtlMs,
  );

  const sql = await getSqlClient();
  let rotated = false;
  await sql.begin(async (transaction) => {
    rotated = await rotateRefreshToken(transaction, token.id);
    if (!rotated) return;

    await insertRefreshToken(transaction, {
      deviceId: proof.device.id,
      tokenHash: hashToken(nextRefreshToken),
      familyId: token.familyId,
      expiresAt: nextRefreshExpiresAt,
    });

    await touchDevice(transaction, proof.device.id, now);

    await insertAuditEvent(transaction, {
      eventType: "AUTH_REFRESH_SUCCEEDED",
      actorUserId: user.id,
      deviceId: proof.device.id,
      entityType: "refresh_token",
      entityId: token.id,
      metadata: { platform },
    });
  });

  if (!rotated) {
    await sql.begin(async (transaction) => {
      await revokeRefreshTokenFamily(transaction, token.familyId);
      await insertAuditEvent(transaction, {
        eventType: "AUTH_REFRESH_REUSE_DETECTED",
        actorUserId: user.id,
        deviceId: proof.device.id,
        entityType: "refresh_token_family",
        metadata: { familyId: token.familyId },
      });
    });
    throw unauthenticated("Refresh token sudah dipakai.");
  }

  return {
    user: userRowToContextUser(user, null),
    device: device!,
    accessToken: access.token,
    accessExpiresAt: access.expiresAt,
    refreshToken: nextRefreshToken,
    refreshExpiresAt: nextRefreshExpiresAt,
    offlineToken: null,
    offlineExpiresAt: null,
    graceUntil: null,
    serverTime: now,
    keySet: context.auth.paseto.keySet,
  };
}
