import { defaultFieldResolver, type GraphQLSchema } from "graphql";

import type { RequestContext } from "../graphql/context.ts";
import {
  apiError,
  forbidden,
  unauthenticated,
  validationFailed,
} from "../graphql/errors.ts";
import {
  hasPermission,
  isWebSessionOnly,
  policyForOperation,
} from "./permissions.ts";
import { tokenHashMatches } from "./tokens.ts";

export type OperationKind = "query" | "mutation";

function requireCsrf(context: RequestContext): void {
  if (!context.session) return;

  const token = context.csrfToken;
  if (!token || !tokenHashMatches(token, context.session.csrfTokenHash)) {
    throw forbidden("CSRF token tidak valid.");
  }
}

/**
 * Applies the static operation policy before a resolver runs. Every root field
 * is wrapped, including future slices, so forgetting a guard fails closed.
 */
export function authorizeOperation(
  operation: string,
  kind: OperationKind,
  context: RequestContext,
): void {
  const policy = policyForOperation(operation);
  if (!policy) {
    throw forbidden("Operasi tidak dikenal.");
  }

  if (kind === "mutation") {
    if (context.origin && !context.originAllowed) {
      throw forbidden("Origin is not allowed to access this API.");
    }

    if (operation === "login") {
      const platform = context.clientPlatform?.toUpperCase();
      if (
        platform !== "WEB" &&
        platform !== "ANDROID" &&
        platform !== "TAURI"
      ) {
        throw validationFailed(
          "X-Client-Platform harus WEB, ANDROID, atau TAURI.",
        );
      }
    }
  }

  if (policy.kind === "public") return;

  // These operations prove the device themselves and may not carry a bearer.
  if (
    operation === "refresh" ||
    operation === "upgradeOfflineSession" ||
    operation === "syncOfflineBatch"
  ) {
    return;
  }

  if (context.authFailure) {
    throw apiError(context.authFailure);
  }

  if (!context.user || !context.role) {
    throw unauthenticated();
  }

  if (kind === "mutation" && operation !== "login" && context.session) {
    requireCsrf(context);
  }

  if (isWebSessionOnly(operation) && !context.session) {
    throw forbidden("Operasi ini memerlukan sesi web.");
  }

  switch (policy.kind) {
    case "authenticated":
      return;
    case "permission":
      if (!hasPermission(context.role, policy.permission)) {
        throw forbidden();
      }
      return;
    case "device":
    case "deviceSelf":
      if (!context.device) throw unauthenticated();
      return;
    case "selfOrAdmin":
      return;
    default:
      throw forbidden("Operasi tidak diizinkan.");
  }
}

export function applyOperationPolicies(schema: GraphQLSchema): void {
  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();
  const roots: Array<[string, OperationKind, typeof queryType]> = [
    ["query", "query", queryType],
    ["mutation", "mutation", mutationType],
  ];

  for (const [, kind, root] of roots) {
    if (!root) continue;

    for (const [operation, field] of Object.entries(root.getFields())) {
      const originalResolve = field.resolve ?? defaultFieldResolver;

      field.resolve = (source, args, context, info) => {
        authorizeOperation(operation, kind, context as RequestContext);
        return originalResolve(source, args, context, info);
      };
    }
  }
}
