import type { RequestContext } from "../graphql/context.ts";
import { unauthenticated, validationFailed } from "../graphql/errors.ts";
import {
  type VerifiedCredentials,
  verifyLoginCredentials,
} from "./credentials.ts";
import {
  getSqlClient,
  insertAuditEvent,
  insertSession,
  revokeActiveSessionsForUser,
  revokeDeviceRefreshTokens,
  revokeSessionById,
  updateUserPasswordHash,
} from "./repository.ts";
import {
  csrfCookie,
  generateOpaqueToken,
  hashToken,
  sessionCookie,
} from "./tokens.ts";
import { userRowToContextUser } from "./user-mapper.ts";

export interface WebLoginResult {
  user: ReturnType<typeof userRowToContextUser>;
  sessionId: string;
  expiresAt: Date;
  serverTime: Date;
}

export async function loginWeb(
  context: RequestContext,
  input: { username: string; password: string },
): Promise<WebLoginResult> {
  if (context.clientPlatform?.toUpperCase() !== "WEB") {
    throw validationFailed(
      "Login web memerlukan header X-Client-Platform: WEB.",
    );
  }

  const credentials: VerifiedCredentials = await verifyLoginCredentials(
    context,
    input,
  );
  const { user, rehashedPassword, rehashedPepperVersion } = credentials;

  const now = context.auth.now();
  const expiresAt = new Date(now.getTime() + context.auth.sessionTtlMs);
  const sessionToken = generateOpaqueToken();
  const csrfToken = generateOpaqueToken();

  const sql = await getSqlClient();
  const session = await sql.begin(async (transaction) => {
    const revokedSessions = await revokeActiveSessionsForUser(
      transaction,
      user.id,
    );

    if (context.session && context.session.userId !== user.id) {
      const previous = await revokeSessionById(transaction, context.session.id);
      if (previous) revokedSessions.push(previous);
    }

    for (const revoked of revokedSessions) {
      await insertAuditEvent(transaction, {
        eventType: "SESSION_REVOKED",
        actorUserId: revoked.userId,
        entityType: "session",
        entityId: revoked.id,
        metadata: { reason: "LOGIN_ROTATION" },
      });
    }

    if (rehashedPassword && rehashedPepperVersion) {
      await updateUserPasswordHash(transaction, {
        userId: user.id,
        passwordHash: rehashedPassword,
        pepperVersion: rehashedPepperVersion,
      });
    }

    const inserted = await insertSession(transaction, {
      userId: user.id,
      tokenHash: hashToken(sessionToken),
      csrfTokenHash: hashToken(csrfToken),
      expiresAt,
      userAgent: context.userAgent,
      ip: context.ip,
    });

    await insertAuditEvent(transaction, {
      eventType: "AUTH_LOGIN_SUCCEEDED",
      actorUserId: user.id,
      entityType: "session",
      entityId: inserted.id,
      metadata: { platform: "WEB" },
    });

    return inserted;
  });

  context.auth.rateLimit.reset(context.ip ?? "unknown", user.username);
  context.setCookie(sessionCookie(sessionToken, context.auth.sessionTtlMs));
  context.setCookie(csrfCookie(csrfToken, context.auth.sessionTtlMs));

  return {
    user: userRowToContextUser(
      {
        ...user,
        passwordHash: rehashedPassword ?? user.passwordHash,
        passwordPepperVersion:
          rehashedPepperVersion ?? user.passwordPepperVersion,
      },
      session.createdAt,
    ),
    sessionId: session.id,
    expiresAt: session.expiresAt,
    serverTime: now,
  };
}

export async function logoutWeb(context: RequestContext): Promise<boolean> {
  if (!context.user) throw unauthenticated();

  const sql = await getSqlClient();

  if (context.session) {
    await sql.begin(async (transaction) => {
      const revoked = await revokeSessionById(transaction, context.session!.id);
      if (!revoked) return;

      await insertAuditEvent(transaction, {
        eventType: "AUTH_LOGOUT",
        actorUserId: revoked.userId,
        entityType: "session",
        entityId: revoked.id,
        metadata: {},
      });

      await insertAuditEvent(transaction, {
        eventType: "SESSION_REVOKED",
        actorUserId: revoked.userId,
        entityType: "session",
        entityId: revoked.id,
        metadata: { reason: "LOGOUT" },
      });
    });

    context.clearAuthCookies();
    return true;
  }

  if (context.device && context.authKind === "native") {
    await sql.begin(async (transaction) => {
      await revokeDeviceRefreshTokens(transaction, context.device!.id);
      await insertAuditEvent(transaction, {
        eventType: "AUTH_LOGOUT",
        actorUserId: context.user?.id ?? null,
        deviceId: context.device?.id ?? null,
        entityType: "device",
        entityId: context.device?.id ?? null,
        metadata: { platform: context.device?.platform },
      });
    });
    return true;
  }

  throw unauthenticated();
}
