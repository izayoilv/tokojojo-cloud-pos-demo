import type { Role } from "../auth/permissions.ts";
import {
  findDeviceById,
  findSessionByTokenHash,
  findUserById,
  updateDeviceLastSeen,
} from "../auth/repository.ts";
import { type AuthServices, createAuthServices } from "../auth/services.ts";
import {
  clearCsrfCookie,
  clearSessionCookie,
  getCookie,
  hashToken,
  parseCookies,
  SESSION_COOKIE,
} from "../auth/tokens.ts";
import { userRowToContextUser } from "../auth/user-mapper.ts";
import { isOriginAllowed } from "../http/cors.ts";

export interface ContextUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: Date | string | null;
  passwordChangedAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ContextDevice {
  id: string;
  platform: "ANDROID" | "TAURI";
  status: "PENDING" | "ACTIVE" | "REVOKED";
}

export interface ContextSession {
  id: string;
  userId: string;
  csrfTokenHash: string;
  expiresAt: Date;
}

export type AuthFailure = "USER_DISABLED" | "DEVICE_REVOKED" | "DEVICE_PENDING";
export type AuthKind = "web" | "native";

export interface CookieResponse {
  appendHeader(name: string, value: string): unknown;
}

export interface RequestContext {
  requestId: string;
  user: ContextUser | null;
  role: Role | null;
  device: ContextDevice | null;
  session: ContextSession | null;
  authKind: AuthKind | null;
  authFailure: AuthFailure | null;
  origin: string | null;
  originAllowed: boolean;
  clientPlatform: string | null;
  csrfToken: string | null;
  deviceId: string | null;
  deviceKeyId: string | null;
  nonce: string | null;
  clientTime: string | null;
  deviceSignature: string | null;
  offlineToken: string | null;
  actingUserId: string | null;
  ip: string | null;
  userAgent: string | null;
  auth: AuthServices;
  setCookie: (cookie: string) => void;
  clearAuthCookies: () => void;
}

export interface CreateRequestContextOptions {
  auth?: AuthServices;
  allowedOrigins?: readonly string[];
  response?: CookieResponse | null;
  ip?: string | null;
}

function resolveIp(
  request: Request,
  fallback: string | null | undefined,
): string | null {
  const forwarded =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return forwarded ?? fallback ?? null;
}

/**
 * Resolve the web session cookie into a request context. A session that is
 * missing, expired, or revoked is anonymous; a valid session for a disabled
 * user carries USER_DISABLED so protected operations fail closed.
 */
export async function createRequestContext(
  request: Request,
  options: CreateRequestContextOptions = {},
): Promise<RequestContext> {
  const auth = options.auth ?? createAuthServices();
  const allowedOrigins = options.allowedOrigins ?? [];
  const now = auth.now();
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? undefined;
  const sessionToken = getCookie(
    parseCookies(request.headers.get("cookie")),
    SESSION_COOKIE,
  );

  const setCookie = (cookie: string): void => {
    options.response?.appendHeader("Set-Cookie", cookie);
  };
  const clearAuthCookies = (): void => {
    setCookie(clearSessionCookie());
    setCookie(clearCsrfCookie());
  };

  const context: RequestContext = {
    requestId,
    user: null,
    role: null,
    device: null,
    session: null,
    authKind: null,
    authFailure: null,
    origin,
    originAllowed: isOriginAllowed(origin, host, allowedOrigins),
    clientPlatform: request.headers.get("x-client-platform"),
    csrfToken: request.headers.get("x-csrf-token"),
    deviceId: request.headers.get("x-device-id"),
    deviceKeyId: request.headers.get("x-device-key-id"),
    nonce: request.headers.get("x-nonce"),
    clientTime: request.headers.get("x-client-time"),
    deviceSignature: request.headers.get("x-device-signature"),
    offlineToken: request.headers.get("x-offline-token"),
    actingUserId: request.headers.get("x-acting-user-id"),
    ip: resolveIp(request, options.ip),
    userAgent: request.headers.get("user-agent"),
    auth,
    setCookie,
    clearAuthCookies,
  };

  if (sessionToken) {
    const session = await findSessionByTokenHash(hashToken(sessionToken));
    if (
      session &&
      session.sessionRevokedAt === null &&
      new Date(session.sessionExpiresAt).getTime() > now.getTime()
    ) {
      if (!session.isActive) {
        clearAuthCookies();
        context.authFailure = "USER_DISABLED";
        return context;
      }

      context.user = userRowToContextUser(session, session.lastLoginAt);
      context.role = context.user.role;
      context.session = {
        id: session.sessionId,
        userId: session.sessionUserId,
        csrfTokenHash: session.csrfTokenHash,
        expiresAt: new Date(session.sessionExpiresAt),
      };
      context.authKind = "web";
      return context;
    }

    clearAuthCookies();
  }

  const authorization = request.headers.get("authorization");
  const bearer = /^Bearer\s+(.+)$/i.exec(authorization ?? "")?.[1];
  if (!bearer) return context;

  const claims = auth.paseto.verifyAccessToken(bearer, now);
  if (!claims) return context;

  const headerPlatform = context.clientPlatform?.toUpperCase();
  if (
    (headerPlatform === "ANDROID" || headerPlatform === "TAURI") &&
    headerPlatform !== claims.platform
  ) {
    return context;
  }

  const device = await findDeviceById(claims.deviceId);
  if (!device) return context;

  context.device = {
    id: device.id,
    platform: device.platform,
    status: device.status,
  };

  if (device.status === "REVOKED") {
    context.authFailure = "DEVICE_REVOKED";
    return context;
  }

  const tokenUser = await findUserById(claims.sub);
  if (!tokenUser) return context;

  if (!tokenUser.isActive) {
    context.authFailure = "USER_DISABLED";
    return context;
  }

  let effectiveUser = tokenUser;
  if (device.platform === "TAURI" && context.actingUserId) {
    const actingUser = await findUserById(context.actingUserId);
    if (!actingUser) return context;
    if (!actingUser.isActive) {
      context.authFailure = "USER_DISABLED";
      return context;
    }
    effectiveUser = actingUser;
  }

  if (device.status === "PENDING") {
    context.authFailure = "DEVICE_PENDING";
    return context;
  }

  context.user = userRowToContextUser(effectiveUser, null);
  context.role = context.user.role;
  context.authKind = "native";
  await updateDeviceLastSeen(device.id, now);

  return context;
}
