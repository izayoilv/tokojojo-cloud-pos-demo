import express, { type Express, type RequestHandler } from "express";

import {
  type AuthServiceOptions,
  type AuthServices,
  createAuthServices,
} from "./auth/services.ts";
import { loadRuntimeEnv } from "./config/env.ts";
import { createGraphQLServer } from "./graphql/yoga.ts";
import { createNonceHandler } from "./http/auth-nonce.ts";
import { parseTrustedProxies } from "./http/client-ip.ts";
import { corsMiddleware, resolveAllowedOrigins } from "./http/cors.ts";
import { errorHandler, notFoundHandler } from "./http/errors.ts";
import { graphqlGuardMiddleware } from "./http/graphql-guard.ts";
import { requestIdMiddleware } from "./http/request-id.ts";
import { API_VERSION } from "./version.ts";

export interface CreateAppOptions {
  checkDatabase?: () => Promise<void>;
  version?: string;
  nodeEnv?: string;
  corsOrigins?: string;
  jsonBodyLimit?: string;
  healthTimeoutMs?: number;
  auth?: AuthServiceOptions;
  authServices?: AuthServices;
  trustedProxies?: string;
  graphqlMaxDepth?: number;
  graphqlMaxComplexity?: number;
}

async function defaultCheckDatabase(): Promise<void> {
  const { checkDatabase } = await import("./db/health.ts");
  await checkDatabase();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Health check timed out."));
    }, timeoutMs);
    timer.unref();

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Build the Express app without binding a port. Tests and `server.ts` own the
 * listener; schema construction never depends on listening.
 */
export function createApp(options: CreateAppOptions = {}): Express {
  const env = options.nodeEnv
    ? { ...process.env, APP_ENV: options.nodeEnv }
    : process.env;
  const runtimeEnv = loadRuntimeEnv(env);
  const isProduction = runtimeEnv.isProduction;
  const version = options.version ?? API_VERSION;
  const jsonBodyLimit =
    options.jsonBodyLimit ?? process.env.JSON_BODY_LIMIT ?? "1mb";
  const healthTimeoutMs =
    options.healthTimeoutMs ??
    Number(process.env.HEALTHCHECK_TIMEOUT_MS ?? 3000);

  const trustedProxies = parseTrustedProxies(
    options.trustedProxies ?? process.env.TRUSTED_PROXIES,
  );

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", trustedProxies.length > 0 ? trustedProxies : false);

  const allowedOrigins = resolveAllowedOrigins({
    configured: options.corsOrigins ?? process.env.CORS_ORIGINS,
    isProduction,
  });
  const auth =
    options.authServices ??
    createAuthServices({
      ...options.auth,
      env,
      runtimeEnv,
    });

  app.use(requestIdMiddleware());
  app.use(corsMiddleware(allowedOrigins));

  app.get("/auth/nonce", createNonceHandler(auth, { trustedProxies }));

  app.get("/healthz", async (_request, response) => {
    const time = new Date().toISOString();

    try {
      await withTimeout(
        (options.checkDatabase ?? defaultCheckDatabase)(),
        healthTimeoutMs,
      );
      response.status(200).json({ status: "ok", time, version });
    } catch {
      response.status(503).json({ status: "unavailable", time, version });
    }
  });

  app.use(express.json({ limit: jsonBodyLimit, strict: true }));
  app.use(
    "/graphql",
    graphqlGuardMiddleware({
      maxDepth: options.graphqlMaxDepth,
      maxComplexity: options.graphqlMaxComplexity,
    }),
  );

  const yoga = createGraphQLServer({
    isProduction,
    auth,
    allowedOrigins,
    trustedProxies,
  });
  app.use("/graphql", yoga as unknown as RequestHandler);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
