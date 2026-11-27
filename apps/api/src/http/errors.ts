import type { ErrorRequestHandler, RequestHandler, Response } from "express";

import type { ErrorCode } from "../graphql/errors.ts";

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
  };
  requestId: string;
}

function jsonError(
  response: Response,
  status: number,
  code: string,
  message: string,
): void {
  const requestId =
    typeof response.locals.requestId === "string"
      ? response.locals.requestId
      : "";

  const body: ErrorBody = {
    error: { code, message },
    requestId,
  };

  response.status(status).json(body);
}

export const notFoundHandler: RequestHandler = (_request, response) => {
  jsonError(response, 404, "NOT_FOUND", "Route not found.");
};

interface ExpressBodyParserError extends Error {
  status?: number;
  type?: string;
  expose?: boolean;
}

/**
 * Central HTTP error boundary. GraphQL errors are handled inside Yoga; this
 * covers JSON parsing, CORS/origin rejection, 404s, and unexpected bugs.
 * Unexpected details are never returned to the client or written to the log.
 */
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  next,
) => {
  void next;
  if (response.headersSent) return;

  const requestId =
    typeof response.locals.requestId === "string"
      ? response.locals.requestId
      : "";

  if (error instanceof HttpError) {
    jsonError(response, error.status, error.code, error.message);
    return;
  }

  const parserError = error as ExpressBodyParserError;

  if (parserError?.type === "entity.too.large" || parserError?.status === 413) {
    jsonError(response, 413, "VALIDATION_FAILED", "Request body is too large.");
    return;
  }

  if (
    parserError?.type === "entity.parse.failed" ||
    (error instanceof SyntaxError && parserError?.status === 400)
  ) {
    jsonError(response, 400, "VALIDATION_FAILED", "Malformed JSON body.");
    return;
  }

  // Keep the log line free of headers, bodies, tokens, and error messages.
  console.error(
    JSON.stringify({
      level: "error",
      message: "unhandled_http_error",
      requestId,
      method: request.method,
      path: request.path,
      errorName: error instanceof Error ? error.name : typeof error,
    }),
  );

  jsonError(response, 500, "INTERNAL_SERVER_ERROR", "Internal server error.");
};
