import type { RequestHandler } from "express";

import { HttpError } from "./errors.ts";

const ALLOWED_METHODS = "GET,POST,OPTIONS";
const ALLOWED_HEADERS = [
  "Accept",
  "Authorization",
  "Content-Type",
  "X-CSRF-Token",
  "X-Request-Id",
  "X-Client-Platform",
  "X-Device-Id",
  "X-Device-Key-Id",
  "X-Nonce",
  "X-Client-Time",
  "X-Device-Signature",
  "X-Offline-Token",
  "X-Acting-User-Id",
].join(", ");

const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "http://tauri.localhost",
  "https://tauri.localhost",
  "tauri://localhost",
];

export function resolveAllowedOrigins(options: {
  configured?: string;
  isProduction: boolean;
}): string[] {
  const configured = (options.configured ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length > 0) return configured;
  return options.isProduction ? [] : DEV_ORIGINS;
}

function isSameOrigin(origin: string, host: string | undefined): boolean {
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function isOriginAllowed(
  origin: string | null,
  host: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  if (!origin) return true;
  return allowedOrigins.includes(origin) || isSameOrigin(origin, host);
}

function isUnsafeMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

/**
 * CORS and origin check in one place. Cookies are allowed for the explicitly
 * configured web origins; unknown cross-origin writes are rejected before they
 * reach a resolver. Same-origin requests work without configuration.
 */
export function corsMiddleware(
  allowedOrigins: readonly string[],
): RequestHandler {
  return (request, response, next) => {
    const origin = request.get("origin");
    const allowedOrigin = isOriginAllowed(
      origin ?? null,
      request.get("host"),
      allowedOrigins,
    );

    if (!origin) {
      next();
      return;
    }

    if (!allowedOrigin) {
      if (request.method === "OPTIONS" || isUnsafeMethod(request.method)) {
        next(
          new HttpError(
            403,
            "FORBIDDEN",
            "Origin is not allowed to access this API.",
          ),
        );
        return;
      }

      next();
      return;
    }

    response.vary("Origin");
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");

    if (request.method === "OPTIONS") {
      response.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
      response.setHeader(
        "Access-Control-Allow-Headers",
        request.get("access-control-request-headers") ?? ALLOWED_HEADERS,
      );
      response.setHeader("Access-Control-Max-Age", "600");
      response.status(204).end();
      return;
    }

    next();
  };
}
