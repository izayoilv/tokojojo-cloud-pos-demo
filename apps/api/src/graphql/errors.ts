import { GraphQLError } from "graphql";

/**
 * The client-facing error codes from docs/screens.md. Do not add ad-hoc codes
 * here; both clients map this list to UI copy.
 */
export const DOCUMENTED_ERROR_CODES = [
  "UNAUTHENTICATED",
  "DEVICE_REVOKED",
  "USER_DISABLED",
  "OFFLINE_TOKEN_EXPIRED",
  "GRACE_EXPIRED",
  "INVALID_SIGNATURE",
  "INVALID_NONCE",
  "CLOCK_SKEW",
  "RATE_LIMITED",
  "DUPLICATE_ORDER",
  "ORDER_FLAGGED",
  "QUEUE_LIMIT",
  "FORBIDDEN",
  "SHIFT_NOT_FOUND",
  "SHIFT_CLOSED",
  "SHIFT_SYNC_REQUIRED",
  "INVALID_SHIFT",
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "CONFLICT",
  "PENDING_APPROVAL",
  "DEVICE_PENDING",
  "STALE_CATALOG",
  "SYNC_REJECTED",
] as const;

export type ErrorCode = (typeof DOCUMENTED_ERROR_CODES)[number];

const documentedErrorCodes = new Set<string>(DOCUMENTED_ERROR_CODES);
const VALIDATION_ERROR_CODES = new Set<string>([
  "GRAPHQL_PARSE_FAILED",
  "GRAPHQL_VALIDATION_FAILED",
]);

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && documentedErrorCodes.has(value);
}

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Silakan masuk terlebih dahulu.",
  DEVICE_REVOKED: "Perangkat ini sudah dicabut aksesnya.",
  USER_DISABLED: "Akun pengguna ini sedang dinonaktifkan.",
  OFFLINE_TOKEN_EXPIRED: "Sesi offline sudah kedaluwarsa.",
  GRACE_EXPIRED: "Masa tenggang offline sudah berakhir.",
  INVALID_SIGNATURE: "Tanda tangan perangkat tidak valid.",
  INVALID_NONCE: "Nonce tidak valid atau sudah dipakai.",
  CLOCK_SKEW: "Waktu perangkat tidak sinkron dengan server.",
  RATE_LIMITED: "Terlalu banyak permintaan. Coba lagi nanti.",
  DUPLICATE_ORDER: "Pesanan ini sudah pernah diterima.",
  ORDER_FLAGGED: "Pesanan ditandai untuk ditinjau.",
  QUEUE_LIMIT: "Antrean sinkronisasi sudah penuh.",
  FORBIDDEN: "Anda tidak punya akses.",
  SHIFT_NOT_FOUND: "Shift tidak ditemukan.",
  SHIFT_CLOSED: "Shift sudah ditutup.",
  SHIFT_SYNC_REQUIRED: "Shift perlu disinkronkan terlebih dahulu.",
  INVALID_SHIFT: "Shift tidak valid.",
  VALIDATION_FAILED: "Data yang dikirim tidak valid.",
  NOT_FOUND: "Data tidak ditemukan.",
  CONFLICT: "Data sudah berubah. Muat ulang lalu coba lagi.",
  PENDING_APPROVAL: "Perangkat masih menunggu persetujuan admin.",
  DEVICE_PENDING: "Perangkat masih menunggu persetujuan admin.",
  STALE_CATALOG: "Katalog di perangkat sudah usang. Sinkronkan ulang.",
  SYNC_REJECTED: "Sinkronisasi ditolak.",
};

export interface ApiErrorExtensions {
  [key: string]: unknown;
}

/**
 * Build a GraphQLError whose `extensions.code` is one of the documented client
 * codes. GraphQL auth failures stay HTTP 200; only `extensions` carries state.
 */
export function apiError(
  code: ErrorCode,
  message = DEFAULT_MESSAGES[code],
  extensions: ApiErrorExtensions = {},
): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      ...extensions,
      code,
    },
  });
}

export function unauthenticated(message?: string): GraphQLError {
  return apiError("UNAUTHENTICATED", message);
}

export function forbidden(message?: string): GraphQLError {
  return apiError("FORBIDDEN", message);
}

export function validationFailed(message?: string): GraphQLError {
  return apiError("VALIDATION_FAILED", message);
}

export function notFound(message?: string): GraphQLError {
  return apiError("NOT_FOUND", message);
}

export function conflict(message?: string): GraphQLError {
  return apiError("CONFLICT", message);
}

/**
 * Keep deliberate GraphQL errors with a documented code intact. GraphQL
 * parse/validation errors are safe too: they describe the query, not server
 * state. Everything else (including internal GraphQLErrors) is replaced with an
 * opaque message.
 */
export function maskGraphQLError(
  error: unknown,
  fallbackMessage = "Unexpected error.",
): GraphQLError {
  if (error instanceof GraphQLError) {
    const code = error.extensions?.code;
    if (isErrorCode(code)) return error;
    if (typeof code === "string" && VALIDATION_ERROR_CODES.has(code)) {
      return error;
    }
  }

  return new GraphQLError(fallbackMessage, {
    extensions: {
      code: "INTERNAL_SERVER_ERROR",
    },
  });
}
