import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * Accept a caller-provided id only when it is safe to echo. The id is copied
 * onto the request headers so GraphQL context can read it without sharing
 * Express-specific objects with resolvers.
 */
export function requestIdMiddleware(): RequestHandler {
  return (request, response, next) => {
    const incoming = request.get("x-request-id");
    const requestId =
      incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();

    request.headers["x-request-id"] = requestId;
    response.locals.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);

    next();
  };
}

export function getRequestId(response: {
  locals: Record<string, unknown>;
}): string {
  return typeof response.locals.requestId === "string"
    ? response.locals.requestId
    : "";
}
