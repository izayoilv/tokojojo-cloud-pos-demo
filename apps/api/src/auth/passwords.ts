import { createHmac } from "node:crypto";

import { hash, parseOptions, verify } from "@node-rs/argon2";

// @node-rs/argon2 exports Algorithm as a const enum, which verbatimModuleSyntax
// cannot reference at runtime. 2 is Algorithm.Argon2id.
const ARGON2ID_ALGORITHM = 2;

export const ARGON2_OPTIONS = {
  algorithm: ARGON2ID_ALGORITHM,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
} as const;

const DEVELOPMENT_PEPPER = "tokojojo-development-pepper-not-for-production";

export interface PepperConfig {
  currentVersion: number;
  peppers: ReadonlyMap<number, string>;
}

function parseVersion(value: string | undefined): number {
  const version = Number(value ?? 1);
  if (!Number.isInteger(version) || version < 1 || version > 32767) {
    throw new Error("PASSWORD_PEPPER_VERSION must be a positive smallint.");
  }
  return version;
}

/**
 * Peppers are versioned so a rotation can verify old hashes before rehashing.
 * `PASSWORD_PEPPER` is the current value; `PASSWORD_PEPPER_V<n>` keeps older
 * values available during the rotation window. Production has no fallback.
 */
export function loadPepperConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): PepperConfig {
  const currentVersion = parseVersion(env.PASSWORD_PEPPER_VERSION);
  const peppers = new Map<number, string>();

  for (const [key, value] of Object.entries(env)) {
    const match = /^PASSWORD_PEPPER_V(\d+)$/.exec(key);
    if (!match || !value) continue;
    const version = Number(match[1]);
    if (Number.isInteger(version) && version > 0) {
      peppers.set(version, value);
    }
  }

  const currentPepper = env.PASSWORD_PEPPER ?? peppers.get(currentVersion);
  if (currentPepper) {
    peppers.set(currentVersion, currentPepper);
  } else if (env.NODE_ENV === "production") {
    throw new Error(
      "PASSWORD_PEPPER is required in production; keep it in podman secrets or the environment, never the database.",
    );
  } else {
    peppers.set(currentVersion, DEVELOPMENT_PEPPER);
  }

  return { currentVersion, peppers };
}

export function getPepper(config: PepperConfig, version: number): string {
  const pepper = config.peppers.get(version);
  if (!pepper) {
    throw new Error(`Password pepper version ${version} is not configured.`);
  }
  return pepper;
}

export function pepperPassword(password: string, pepper: string): string {
  return createHmac("sha256", pepper).update(password, "utf8").digest("base64");
}

export async function hashPassword(
  password: string,
  pepper: string,
): Promise<string> {
  return hash(pepperPassword(password, pepper), ARGON2_OPTIONS);
}

/**
 * Returns false for malformed hashes and verification failures so callers can
 * keep the same generic credentials response.
 */
export async function verifyPassword(
  encodedHash: string,
  password: string,
  pepper: string,
): Promise<boolean> {
  try {
    return await verify(encodedHash, pepperPassword(password, pepper));
  } catch {
    return false;
  }
}

export function passwordNeedsRehash(
  encodedHash: string,
  recordedPepperVersion: number,
  config: PepperConfig,
): boolean {
  if (recordedPepperVersion !== config.currentVersion) return true;

  try {
    const options = parseOptions(encodedHash);
    return (
      options.algorithm !== ARGON2_OPTIONS.algorithm ||
      options.memoryCost !== ARGON2_OPTIONS.memoryCost ||
      options.timeCost !== ARGON2_OPTIONS.timeCost ||
      options.parallelism !== ARGON2_OPTIONS.parallelism
    );
  } catch {
    return true;
  }
}
