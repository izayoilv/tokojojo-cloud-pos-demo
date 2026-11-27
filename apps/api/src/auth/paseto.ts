import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
  randomUUID,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";

import type { Role } from "./permissions.ts";

const PASETO_HEADER = Buffer.from("v4.public.");
const PKCS8_ED25519_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

export interface PasetoPublicKey {
  kid: string;
  publicKey: string;
  alg: string;
}

export interface AccessTokenClaims {
  sub: string;
  role: Role;
  deviceId: string;
  platform: "ANDROID" | "TAURI";
  kid: string;
  jti: string;
  iat: string;
  exp: string;
}

export interface PasetoKeyInput {
  kid: string;
  publicKey?: string;
  privateKey?: string;
}

export interface OfflineTokenClaims {
  typ: "offline";
  sub: string;
  device_id: string;
  device_key_id: string;
  scope: string[];
  kid: string;
  jti: string;
  iat: string;
  exp: string;
  grace_until: string;
}

export interface PasetoServiceOptions {
  active?: PasetoKeyInput;
  previous?: PasetoKeyInput[];
  accessTtlMs?: number;
  offlineTtlMs?: number;
  offlineGraceMs?: number;
}

export interface PasetoService {
  keySet: PasetoPublicKey[];
  accessTtlMs: number;
  offlineTtlMs: number;
  offlineGraceMs: number;
  signAccessToken(
    claims: Omit<AccessTokenClaims, "kid" | "jti" | "iat" | "exp">,
    now: Date,
  ): { token: string; expiresAt: Date };
  verifyAccessToken(token: string, now: Date): AccessTokenClaims | null;
  signOfflineToken(
    claims: Omit<OfflineTokenClaims, "typ" | "kid" | "iat">,
    now: Date,
  ): string;
  verifyOfflineToken(token: string): OfflineTokenClaims | null;
}

interface KeyMaterial {
  kid: string;
  publicKey: string;
  publicKeyObject: KeyObject;
  privateKeyObject: KeyObject | null;
}

let developmentKeyPair: { privateKey: string; publicKey: string } | undefined;

function decodeBase64Url(value: string, label: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`${label} must be base64url without padding.`);
  }

  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) {
    throw new Error(`${label} is not valid base64url.`);
  }
  return decoded;
}

function privateKeyFromRaw(value: string): KeyObject {
  if (value.startsWith("-----BEGIN")) {
    return createPrivateKey(value);
  }

  const raw = decodeBase64Url(value, "PASETO private key");
  const seed = raw.subarray(0, 32);
  if (raw.length !== 32 && raw.length !== 64) {
    throw new Error("PASETO private key must be a 32-byte seed.");
  }

  return createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
}

function publicKeyFromRaw(value: string): KeyObject {
  if (value.startsWith("-----BEGIN")) {
    return createPublicKey(value);
  }

  const raw = decodeBase64Url(value, "PASETO public key");
  if (raw.length !== 32) {
    throw new Error("PASETO public key must be raw 32 bytes.");
  }

  return createPublicKey({
    key: Buffer.concat([SPKI_ED25519_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

function rawPublicKey(key: KeyObject): string {
  const der = key.export({ format: "der", type: "spki" });
  return der.subarray(der.length - 32).toString("base64url");
}

function keyMaterial(
  input: PasetoKeyInput,
  requirePrivate: boolean,
): KeyMaterial {
  const privateKeyObject = input.privateKey
    ? privateKeyFromRaw(input.privateKey)
    : null;
  if (requirePrivate && !privateKeyObject) {
    throw new Error("PASETO active private key is required.");
  }

  const publicKeyObject = privateKeyObject
    ? createPublicKey(privateKeyObject)
    : input.publicKey
      ? publicKeyFromRaw(input.publicKey)
      : null;
  if (!publicKeyObject) {
    throw new Error("PASETO public key is required.");
  }

  return {
    kid: input.kid,
    publicKey: rawPublicKey(publicKeyObject),
    publicKeyObject,
    privateKeyObject,
  };
}

function getDevelopmentKeys(): { privateKey: string; publicKey: string } {
  if (developmentKeyPair) return developmentKeyPair;

  const pair = generateKeyPairSync("ed25519");
  const privateJwk = pair.privateKey.export({ format: "jwk" }) as {
    d?: string;
  };
  const publicJwk = pair.publicKey.export({ format: "jwk" }) as {
    x?: string;
  };
  if (!privateJwk.d || !publicJwk.x) {
    throw new Error("Could not generate development PASETO keys.");
  }

  developmentKeyPair = {
    privateKey: privateJwk.d,
    publicKey: publicJwk.x,
  };
  return developmentKeyPair;
}

function pasetoConfigFromEnv(env: NodeJS.ProcessEnv): {
  active: PasetoKeyInput;
  previous: PasetoKeyInput[];
} {
  const activePrivate = env.PASETO_ACTIVE_PRIVATE_KEY ?? env.PASETO_PRIVATE_KEY;
  const activePublic = env.PASETO_ACTIVE_PUBLIC_KEY ?? env.PASETO_PUBLIC_KEY;
  const activeKid = env.PASETO_ACTIVE_KID ?? env.PASETO_KEY_ID ?? "v1";

  let active: PasetoKeyInput = {
    kid: activeKid,
    privateKey: activePrivate,
    publicKey: activePublic,
  };

  if (!activePrivate) {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "PASETO_ACTIVE_PRIVATE_KEY is required in production; keep signing keys in podman secrets or the environment.",
      );
    }
    const keys = getDevelopmentKeys();
    active = {
      kid: activeKid,
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
    };
  }

  const previous: PasetoKeyInput[] = [];
  if (env.PASETO_PREVIOUS_PUBLIC_KEY) {
    previous.push({
      kid: env.PASETO_PREVIOUS_KID ?? "previous",
      publicKey: env.PASETO_PREVIOUS_PUBLIC_KEY,
    });
  }

  return { active, previous };
}

function le64(value: number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

function preAuthEncode(...pieces: Buffer[]): Buffer {
  return Buffer.concat([
    le64(pieces.length),
    ...pieces.flatMap((piece) => [le64(piece.length), piece]),
  ]);
}

function signMessage(message: Buffer, privateKey: KeyObject): Buffer {
  return cryptoSign(
    null,
    preAuthEncode(PASETO_HEADER, message, Buffer.alloc(0), Buffer.alloc(0)),
    privateKey,
  );
}

function verifyMessage(
  message: Buffer,
  signature: Buffer,
  publicKey: KeyObject,
): boolean {
  try {
    return cryptoVerify(
      null,
      preAuthEncode(PASETO_HEADER, message, Buffer.alloc(0), Buffer.alloc(0)),
      publicKey,
      signature,
    );
  } catch {
    return false;
  }
}

function isOfflineClaims(value: unknown): value is OfflineTokenClaims {
  if (!value || typeof value !== "object") return false;
  const claims = value as Record<string, unknown>;
  return (
    claims.typ === "offline" &&
    typeof claims.sub === "string" &&
    typeof claims.device_id === "string" &&
    typeof claims.device_key_id === "string" &&
    Array.isArray(claims.scope) &&
    claims.scope.every((scope) => typeof scope === "string") &&
    typeof claims.kid === "string" &&
    typeof claims.jti === "string" &&
    typeof claims.iat === "string" &&
    typeof claims.exp === "string" &&
    typeof claims.grace_until === "string"
  );
}

function isAccessClaims(value: unknown): value is AccessTokenClaims {
  if (!value || typeof value !== "object") return false;
  const claims = value as Record<string, unknown>;
  return (
    typeof claims.sub === "string" &&
    typeof claims.role === "string" &&
    typeof claims.deviceId === "string" &&
    (claims.platform === "ANDROID" || claims.platform === "TAURI") &&
    typeof claims.kid === "string" &&
    typeof claims.jti === "string" &&
    typeof claims.iat === "string" &&
    typeof claims.exp === "string"
  );
}

export function createPasetoService(
  options: PasetoServiceOptions = {},
): PasetoService {
  const envConfig = options.active
    ? { active: options.active, previous: options.previous ?? [] }
    : pasetoConfigFromEnv(process.env);
  const activeInput = options.active ?? envConfig.active;
  const previousInput = options.previous ?? envConfig.previous;
  const active = keyMaterial(activeInput, true);
  const previous = previousInput.map((key) => keyMaterial(key, false));
  const keyMap = new Map<string, KeyMaterial>(
    [active, ...previous].map((key) => [key.kid, key]),
  );
  const configuredTtlMs =
    options.accessTtlMs ??
    Number(process.env.PASETO_ACCESS_TTL_MS ?? 20 * 60 * 1000);
  const accessTtlMs =
    Number.isFinite(configuredTtlMs) && configuredTtlMs > 0
      ? configuredTtlMs
      : 20 * 60 * 1000;
  const configuredOfflineTtl =
    options.offlineTtlMs ??
    Number(process.env.OFFLINE_TOKEN_TTL_MS ?? 7 * 24 * 60 * 60 * 1000);
  const offlineTtlMs =
    Number.isFinite(configuredOfflineTtl) && configuredOfflineTtl > 0
      ? configuredOfflineTtl
      : 7 * 24 * 60 * 60 * 1000;
  const configuredOfflineGrace =
    options.offlineGraceMs ??
    Number(process.env.OFFLINE_TOKEN_GRACE_MS ?? 7 * 24 * 60 * 60 * 1000);
  const offlineGraceMs =
    Number.isFinite(configuredOfflineGrace) && configuredOfflineGrace > 0
      ? configuredOfflineGrace
      : 7 * 24 * 60 * 60 * 1000;

  return {
    accessTtlMs,
    offlineTtlMs,
    offlineGraceMs,
    keySet: [active, ...previous].map((key) => ({
      kid: key.kid,
      publicKey: key.publicKey,
      alg: "Ed25519",
    })),
    signAccessToken(claims, now) {
      if (!active.privateKeyObject) {
        throw new Error("PASETO active private key is missing.");
      }

      const expiresAt = new Date(now.getTime() + accessTtlMs);
      const payload: AccessTokenClaims = {
        ...claims,
        kid: active.kid,
        jti: randomUUID(),
        iat: now.toISOString(),
        exp: expiresAt.toISOString(),
      };
      const message = Buffer.from(JSON.stringify(payload), "utf8");
      const signature = signMessage(message, active.privateKeyObject);

      return {
        token: `${PASETO_HEADER.toString()}${Buffer.concat([
          message,
          signature,
        ]).toString("base64url")}`,
        expiresAt,
      };
    },
    signOfflineToken(claims, now) {
      if (!active.privateKeyObject) {
        throw new Error("PASETO active private key is missing.");
      }

      const payload: OfflineTokenClaims = {
        ...claims,
        typ: "offline",
        kid: active.kid,
        iat: now.toISOString(),
      };
      const message = Buffer.from(JSON.stringify(payload), "utf8");
      const signature = signMessage(message, active.privateKeyObject);
      return `${PASETO_HEADER.toString()}${Buffer.concat([
        message,
        signature,
      ]).toString("base64url")}`;
    },
    verifyOfflineToken(token) {
      const parsed = verifySignedPayload(token);
      return parsed && isOfflineClaims(parsed) ? parsed : null;
    },
    verifyAccessToken(token, now) {
      const claims = verifySignedPayload(token);
      if (!claims || !isAccessClaims(claims)) return null;

      const issuedAt = Date.parse(claims.iat);
      const expiresAt = Date.parse(claims.exp);
      if (
        Number.isNaN(issuedAt) ||
        Number.isNaN(expiresAt) ||
        issuedAt > now.getTime() + CLOCK_TOLERANCE_MS ||
        expiresAt <= now.getTime()
      ) {
        return null;
      }

      return claims;
    },
  };

  function verifySignedPayload(token: string): unknown | null {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "v4" || parts[1] !== "public") {
      return null;
    }

    let body: Buffer;
    try {
      body = decodeBase64Url(parts[2] ?? "", "PASETO token");
    } catch {
      return null;
    }
    if (body.length <= 64) return null;

    const message = body.subarray(0, -64);
    const signature = body.subarray(-64);

    let claims: unknown;
    try {
      claims = JSON.parse(message.toString("utf8"));
    } catch {
      return null;
    }
    if (!claims || typeof claims !== "object") return null;

    const kid = (claims as { kid?: unknown }).kid;
    if (typeof kid !== "string") return null;
    const key = keyMap.get(kid);
    if (!key || !verifyMessage(message, signature, key.publicKeyObject)) {
      return null;
    }
    return claims;
  }
}
