import { randomUUID } from "node:crypto";

import type { RequestContext } from "../graphql/context.ts";
import { apiError, validationFailed } from "../graphql/errors.ts";
import {
  verifyLoginCredentials,
  writeLoginFailureAudit,
} from "./credentials.ts";
import { verifyDeviceSignature } from "./device-signature.ts";
import { loadDeviceView } from "./device-view.ts";
import type { NativeAuthResult } from "./native.ts";
import {
  issueOfflineToken,
  type OfflineTokenView,
  verifyOfflineTokenForDevice,
} from "./offline.ts";
import {
  getSqlClient,
  insertAuditEvent,
  insertRefreshToken,
  touchDevice,
  updateUserPasswordHash,
} from "./repository.ts";
import { generateRefreshToken, hashToken } from "./tokens.ts";
import { userRowToContextUser } from "./user-mapper.ts";

export async function upgradeOfflineSession(
  context: RequestContext,
  input: { username: string; password: string },
): Promise<NativeAuthResult> {
  const platform = context.clientPlatform?.toUpperCase();
  if (platform !== "TAURI") {
    throw validationFailed("Offline session hanya tersedia untuk TAURI.");
  }

  const ip = context.ip ?? "unknown";
  if (!context.auth.upgradeRateLimit.checkIp(ip)) {
    throw apiError("RATE_LIMITED");
  }
  context.auth.upgradeRateLimit.recordIpFailure(ip);

  const offlineToken = context.offlineToken;
  if (!offlineToken) {
    throw validationFailed("Header X-Offline-Token wajib diisi.");
  }

  let proof;
  try {
    proof = await verifyDeviceSignature(
      context,
      "upgradeOfflineSession",
      offlineToken,
    );
  } catch (error) {
    await writeLoginFailureAudit(
      context,
      null,
      input.username,
      "OFFLINE_UPGRADE_FAILED",
      { platform, deviceId: context.deviceId },
    );
    throw error;
  }

  if (proof.device.status !== "ACTIVE") {
    throw proof.device.status === "PENDING"
      ? apiError("DEVICE_PENDING")
      : apiError("DEVICE_REVOKED");
  }
  if (proof.device.platform !== "TAURI") {
    throw validationFailed("Perangkat ini tidak mendukung sesi offline.");
  }
  if (!context.auth.upgradeRateLimit.checkDevice(proof.device.id)) {
    throw apiError("RATE_LIMITED");
  }
  context.auth.upgradeRateLimit.recordDeviceFailure(proof.device.id);

  const verified = await verifyOfflineTokenForDevice(
    context,
    offlineToken,
    proof.device,
  );

  const credentials = await verifyLoginCredentials(context, input);
  const { user, rehashedPassword, rehashedPepperVersion } = credentials;
  const now = context.auth.now();
  const access = context.auth.paseto.signAccessToken(
    {
      sub: user.id,
      role: user.role,
      deviceId: proof.device.id,
      platform: "TAURI",
    },
    now,
  );
  const refreshToken = generateRefreshToken(user.id);
  const refreshExpiresAt = new Date(now.getTime() + context.auth.refreshTtlMs);
  const offlineHolder: { value: OfflineTokenView | null } = { value: null };

  const sql = await getSqlClient();
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

    if (!verified.graceOnly) {
      offlineHolder.value = await issueOfflineToken(transaction, context, {
        user,
        device: proof.device,
        deviceKeyId: proof.key.keyId,
        rotateJti: verified.row.jti,
      });
    }

    await touchDevice(transaction, proof.device.id, now);

    await insertAuditEvent(transaction, {
      eventType: "OFFLINE_SESSION_UPGRADED",
      actorUserId: user.id,
      deviceId: proof.device.id,
      entityType: "offline_token",
      entityId: verified.row.jti,
      metadata: { platform, limited: verified.graceOnly },
    });

    if (verified.graceOnly) {
      await insertAuditEvent(transaction, {
        eventType: "OFFLINE_GRACE_SESSION",
        actorUserId: user.id,
        deviceId: proof.device.id,
        entityType: "offline_token",
        entityId: verified.row.jti,
        metadata: { platform, graceUntil: verified.row.graceUntil },
      });
    }
  });

  context.auth.rateLimit.reset(ip, user.username);
  context.auth.upgradeRateLimit.resetIp(ip);
  context.auth.upgradeRateLimit.resetDevice(proof.device.id);

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
    device: (await loadDeviceView(proof.device.id))!,
    accessToken: access.token,
    accessExpiresAt: access.expiresAt,
    refreshToken,
    refreshExpiresAt,
    offlineToken: offlineHolder.value?.token ?? null,
    offlineExpiresAt: offlineHolder.value?.expiresAt ?? null,
    graceUntil:
      offlineHolder.value?.graceUntil ??
      (verified.graceOnly ? verified.row.graceUntil : null),
    serverTime: now,
    keySet: context.auth.paseto.keySet,
  };
}
