import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "__Host-tokojojo_session";
export const CSRF_COOKIE = "__Host-tokojojo_csrf";

export const SESSION_TTL_MS = 60 * 60 * 1000;
export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

export interface CookieOptions {
  httpOnly: boolean;
  maxAgeSeconds: number;
}

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function tokenHashMatches(token: string, expectedHash: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;

  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function parseCookies(
  header: string | null | undefined,
): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;

    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    if (!name) continue;

    try {
      cookies.set(name, decodeURIComponent(rawValue));
    } catch {
      cookies.set(name, rawValue);
    }
  }

  return cookies;
}

export function getCookie(
  cookies: ReadonlyMap<string, string>,
  name: string,
): string | null {
  return cookies.get(name) ?? null;
}

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions,
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`,
    "Path=/",
    "Secure",
    "SameSite=Lax",
  ];

  if (options.httpOnly) parts.push("HttpOnly");
  return parts.join("; ");
}

export function clearCookie(name: string, httpOnly: boolean): string {
  return serializeCookie(name, "", { httpOnly, maxAgeSeconds: 0 });
}

export function sessionCookie(token: string, ttlMs: number): string {
  return serializeCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    maxAgeSeconds: ttlMs / 1000,
  });
}

export function csrfCookie(token: string, ttlMs: number): string {
  return serializeCookie(CSRF_COOKIE, token, {
    httpOnly: false,
    maxAgeSeconds: ttlMs / 1000,
  });
}

export function clearSessionCookie(): string {
  return clearCookie(SESSION_COOKIE, true);
}

export function clearCsrfCookie(): string {
  return clearCookie(CSRF_COOKIE, false);
}

export function generateRefreshToken(userId: string): string {
  return `${userId}.${generateOpaqueToken()}`;
}

export function refreshTokenSubject(token: string): string | null {
  const separator = token.indexOf(".");
  if (separator === -1) return null;
  const userId = token.slice(0, separator);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      userId,
    )
  ) {
    return null;
  }
  return userId;
}
