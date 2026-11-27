import {
  createHash,
  createPublicKey,
  verify as cryptoVerify,
} from "node:crypto";

import type { RequestContext } from "../graphql/context.ts";
import { apiError, validationFailed } from "../graphql/errors.ts";
import {
  consumeAuthNonce,
  type DeviceKeyRow,
  type DeviceRow,
  findDeviceWithKey,
  getSqlClient,
} from "./repository.ts";
import { hashToken } from "./tokens.ts";

const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export type DeviceOperation =
  | "login"
  | "refresh"
  | "upgradeOfflineSession"
  | "syncOfflineBatch"
  | "rotateDeviceKey";

export interface VerifiedDeviceSignature {
  device: DeviceRow;
  key: DeviceKeyRow;
  payloadHash: string;
}

function decodeRawPublicKey(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;

  const raw = Buffer.from(value, "base64url");
  if (raw.length !== 32 || raw.toString("base64url") !== value) return null;

  return createPublicKey({
    key: Buffer.concat([SPKI_ED25519_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

function decodeSignature(value: string): Buffer | null {
  const parts = value.split(":");
  if (parts.length !== 2 || parts[0] !== "v1" || !parts[1]) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;

  const signature = Buffer.from(parts[1], "base64url");
  if (signature.length !== 64 || signature.toString("base64url") !== parts[1]) {
    return null;
  }
  return signature;
}

function payloadHash(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function isUsableDeviceKey(key: DeviceKeyRow, now: Date): boolean {
  if (key.status === "ACTIVE") return true;
  if (key.status !== "RETIRED") return false;
  if (!key.acceptedUntil) return false;
  return new Date(key.acceptedUntil).getTime() >= now.getTime();
}

function requireHeader(value: string | null, name: string): string {
  if (!value) {
    throw validationFailed(`Header ${name} wajib diisi.`);
  }
  return value;
}

/**
 * Verify the native device proof and consume its nonce. Login/refresh use this
 * before touching credentials; rotateDeviceKey uses it before rotating the key.
 */
export async function verifyDeviceSignature(
  context: RequestContext,
  operation: DeviceOperation,
  payload: string,
): Promise<VerifiedDeviceSignature> {
  const platform = context.clientPlatform?.toUpperCase();
  if (platform !== "ANDROID" && platform !== "TAURI") {
    throw validationFailed(
      "X-Client-Platform harus ANDROID atau TAURI untuk permintaan native.",
    );
  }

  const deviceId = requireHeader(context.deviceId, "X-Device-Id");
  const keyId = requireHeader(context.deviceKeyId, "X-Device-Key-Id");
  const nonce = requireHeader(context.nonce, "X-Nonce");
  const clientTime = requireHeader(context.clientTime, "X-Client-Time");
  const signatureHeader = requireHeader(
    context.deviceSignature,
    "X-Device-Signature",
  );

  const clientTimeMs = Date.parse(clientTime);
  if (Number.isNaN(clientTimeMs)) {
    throw validationFailed("X-Client-Time harus ISO-8601.");
  }

  const now = context.auth.now();
  if (Math.abs(now.getTime() - clientTimeMs) > CLOCK_SKEW_MS) {
    throw apiError("CLOCK_SKEW");
  }

  const record = await findDeviceWithKey(deviceId, keyId);
  if (!record || record.device.platform !== platform) {
    throw apiError("INVALID_SIGNATURE", "Perangkat atau kunci tidak valid.");
  }

  if (record.device.status === "REVOKED") {
    throw apiError("DEVICE_REVOKED");
  }

  if (!isUsableDeviceKey(record.key, now)) {
    throw apiError("INVALID_SIGNATURE", "Kunci perangkat tidak valid.");
  }

  const signature = decodeSignature(signatureHeader);
  const publicKey = decodeRawPublicKey(record.key.publicKey);
  if (!signature || !publicKey) {
    throw apiError("INVALID_SIGNATURE");
  }

  const hash = payloadHash(payload);
  const canonical = [
    "v1",
    operation,
    deviceId,
    keyId,
    nonce,
    clientTime,
    hash,
  ].join("\n");

  let verified = false;
  try {
    verified = cryptoVerify(
      null,
      Buffer.from(canonical, "utf8"),
      publicKey,
      signature,
    );
  } catch {
    verified = false;
  }

  if (!verified) {
    throw apiError("INVALID_SIGNATURE");
  }

  const sql = await getSqlClient();
  const consumed = await consumeAuthNonce(sql, {
    nonceHash: hashToken(nonce),
    deviceId,
    now,
  });
  if (!consumed) {
    throw apiError("INVALID_NONCE");
  }

  return {
    device: record.device,
    key: record.key,
    payloadHash: hash,
  };
}

export async function verifyPerOrderSignature(input: {
  deviceId: string;
  signature: string;
  canonical: string;
  now: Date;
}): Promise<void> {
  const parts = input.signature.split(":");
  if (parts.length !== 3 || parts[0] !== "v1" || !parts[1] || !parts[2]) {
    throw apiError("INVALID_SIGNATURE");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(parts[2])) {
    throw apiError("INVALID_SIGNATURE");
  }
  const signature = Buffer.from(parts[2], "base64url");
  if (signature.length !== 64 || signature.toString("base64url") !== parts[2]) {
    throw apiError("INVALID_SIGNATURE");
  }

  const record = await findDeviceWithKey(input.deviceId, parts[1]);
  if (!record) throw apiError("INVALID_SIGNATURE");
  if (record.device.status === "REVOKED") throw apiError("DEVICE_REVOKED");
  if (!isUsableDeviceKey(record.key, input.now)) {
    throw apiError("INVALID_SIGNATURE");
  }

  const publicKey = decodeRawPublicKey(record.key.publicKey);
  if (!publicKey) throw apiError("INVALID_SIGNATURE");
  let verified = false;
  try {
    verified = cryptoVerify(
      null,
      Buffer.from(input.canonical, "utf8"),
      publicKey,
      signature,
    );
  } catch {
    verified = false;
  }
  if (!verified) throw apiError("INVALID_SIGNATURE");
}
