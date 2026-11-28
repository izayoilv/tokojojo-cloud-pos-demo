import type { RequestContext } from "../graphql/context.ts";
import { apiError, validationFailed } from "../graphql/errors.ts";
import {
  getPepper,
  hashPassword,
  passwordNeedsRehash,
  verifyPassword,
} from "./passwords.ts";
import {
  findUserByUsername,
  getSqlClient,
  insertAuditEvent,
  type UserRow,
} from "./repository.ts";
import type { AuthServices } from "./services.ts";

export const INVALID_CREDENTIALS_MESSAGE = "Username atau password salah.";

const dummyHashes = new Map<number, Promise<string>>();

export interface VerifiedCredentials {
  user: UserRow;
  rehashedPassword: string | null;
  rehashedPepperVersion: number | null;
}

function getDummyHash(auth: AuthServices): Promise<string> {
  const version = auth.peppers.currentVersion;
  let pending = dummyHashes.get(version);
  if (!pending) {
    const pepper = getPepper(auth.peppers, version);
    pending = hashPassword("tokojojo-dummy-password", pepper).catch(
      (error: unknown) => {
        dummyHashes.delete(version);
        throw error;
      },
    );
    dummyHashes.set(version, pending);
  }
  return pending;
}

export async function writeLoginFailureAudit(
  context: RequestContext,
  user: UserRow | null,
  username: string,
  reason: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const sql = await getSqlClient();
    await insertAuditEvent(sql, {
      eventType: "AUTH_LOGIN_FAILED",
      actorUserId: user?.id ?? null,
      metadata: { ...metadata, username, reason },
    });
  } catch (error) {
    // Do not leak credentials or database details; the auth response stands.
    console.error(
      JSON.stringify({
        level: "error",
        message: "auth_audit_write_failed",
        eventType: "AUTH_LOGIN_FAILED",
        errorName: error instanceof Error ? error.name : typeof error,
      }),
    );
  }
}

/**
 * Shared password verification for web and native login. Failures are counted
 * and audited; the caller resets the limiter only after the full login succeeds.
 */
export async function verifyLoginCredentials(
  context: RequestContext,
  input: { username: string; password: string },
): Promise<VerifiedCredentials> {
  const username = input.username.trim();
  if (!username || !input.password) {
    throw validationFailed("Username dan password wajib diisi.");
  }

  const ip = context.ip ?? "unknown";
  if (!context.auth.rateLimit.check(ip, username)) {
    await writeLoginFailureAudit(context, null, username, "RATE_LIMITED");
    throw apiError("RATE_LIMITED");
  }

  const user = await findUserByUsername(username);
  const currentPepper = getPepper(
    context.auth.peppers,
    context.auth.peppers.currentVersion,
  );

  let validPassword = false;
  let rehashedPassword: string | null = null;
  let rehashedPepperVersion: number | null = null;

  if (!user) {
    await context.auth.argon2.run(async () => {
      const dummyHash = await getDummyHash(context.auth);
      await verifyPassword(dummyHash, input.password, currentPepper);
    });
  } else {
    let recordedPepper: string | null = null;
    try {
      recordedPepper = getPepper(
        context.auth.peppers,
        user.passwordPepperVersion,
      );
    } catch {
      recordedPepper = null;
    }

    if (!recordedPepper) {
      await context.auth.argon2.run(async () => {
        const dummyHash = await getDummyHash(context.auth);
        await verifyPassword(dummyHash, input.password, currentPepper);
      });
    } else {
      const pepper = recordedPepper;
      const result = await context.auth.argon2.run(async () => {
        const valid = await verifyPassword(
          user.passwordHash,
          input.password,
          pepper,
        );

        if (
          !valid ||
          !passwordNeedsRehash(
            user.passwordHash,
            user.passwordPepperVersion,
            context.auth.peppers,
          )
        ) {
          return { valid, hash: null, version: null };
        }

        const newHash = await hashPassword(input.password, currentPepper);
        return {
          valid,
          hash: newHash,
          version: context.auth.peppers.currentVersion,
        };
      });

      validPassword = result.valid;
      rehashedPassword = result.hash;
      rehashedPepperVersion = result.version;
    }
  }

  if (!validPassword || !user) {
    context.auth.rateLimit.recordFailure(ip, username);
    await writeLoginFailureAudit(
      context,
      user,
      username,
      user ? "INVALID_CREDENTIALS" : "UNKNOWN_USER",
    );
    throw apiError("UNAUTHENTICATED", INVALID_CREDENTIALS_MESSAGE);
  }

  if (!user.isActive) {
    context.auth.rateLimit.recordFailure(ip, username);
    await writeLoginFailureAudit(context, user, username, "USER_DISABLED");
    throw apiError("USER_DISABLED");
  }

  return {
    user,
    rehashedPassword,
    rehashedPepperVersion,
  };
}
