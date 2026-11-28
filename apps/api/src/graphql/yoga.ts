import type { IncomingMessage, ServerResponse } from "node:http";

import { useDisableIntrospection } from "@graphql-yoga/plugin-disable-introspection";
import type { GraphQLSchema } from "graphql";
import { createYoga } from "graphql-yoga";

import { type AuthServices, createAuthServices } from "../auth/services.ts";
import { resolveClientIp } from "../http/client-ip.ts";
import { createRequestContext, type RequestContext } from "./context.ts";
import { maskGraphQLError } from "./errors.ts";
import { appSchema } from "./schema.ts";

export interface GraphQLServerOptions {
  isProduction?: boolean;
  schema?: GraphQLSchema;
  auth?: AuthServices;
  allowedOrigins?: readonly string[];
  trustedProxies?: readonly string[];
}

/**
 * Yoga owns GraphQL parsing/execution only. Express owns request ids, CORS,
 * origin checks, and the JSON body limit.
 */
export function createGraphQLServer(
  options: GraphQLServerOptions = {},
): ReturnType<
  typeof createYoga<
    { req: IncomingMessage; res: ServerResponse },
    RequestContext
  >
> {
  const isProduction =
    options.isProduction ?? process.env.NODE_ENV === "production";
  const auth = options.auth ?? createAuthServices();
  const allowedOrigins = options.allowedOrigins ?? [];

  return createYoga<
    { req: IncomingMessage; res: ServerResponse },
    RequestContext
  >({
    schema: options.schema ?? appSchema,
    graphqlEndpoint: "/graphql",
    cors: false,
    graphiql: !isProduction,
    landingPage: !isProduction,
    maskedErrors: {
      isDev: false,
      maskError: (error, message) => maskGraphQLError(error, message),
    },
    plugins: isProduction ? [useDisableIntrospection()] : [],
    context: ({ request, req, res }) =>
      createRequestContext(request, {
        auth,
        allowedOrigins,
        response: res,
        ip: resolveClientIp({
          peerAddress: req.socket.remoteAddress,
          headers: req.headers,
          trustedProxies: options.trustedProxies,
        }),
      }),
  });
}
