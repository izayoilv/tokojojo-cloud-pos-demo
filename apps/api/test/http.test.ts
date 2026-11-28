import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, test } from "node:test";

import { GraphQLError } from "graphql";
import postgres from "postgres";

import { createApp, type CreateAppOptions } from "../src/app.ts";
import { sql } from "../src/db/client.ts";
import { maskGraphQLError } from "../src/graphql/errors.ts";
import { testSql } from "./db.ts";

after(async () => {
  await Promise.all([testSql.end(), sql.end({ timeout: 5 })]);
});

interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

async function startServer(options: CreateAppOptions): Promise<TestServer> {
  const app = createApp(options);
  const server: Server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

async function postGraphQL(
  server: TestServer,
  query: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${server.baseUrl}/graphql`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ query }),
  });
}

test("GET /healthz reports ok against PostgreSQL", async () => {
  const server = await startServer({ version: "test-version" });

  try {
    const response = await fetch(`${server.baseUrl}/healthz`);
    assert.equal(response.status, 200);

    const body = (await response.json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ["status", "time", "version"]);
    assert.equal(body.status, "ok");
    assert.equal(body.version, "test-version");
    assert.ok(
      typeof body.time === "string" && !Number.isNaN(Date.parse(body.time)),
    );
  } finally {
    await server.close();
  }
});

test("GET /healthz returns 503 when the database is down", async () => {
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, "DATABASE_URL must be set for integration tests");

  const missingDatabaseUrl = new URL(databaseUrl);
  missingDatabaseUrl.pathname = `/tokojojo_missing_${crypto
    .randomUUID()
    .replaceAll("-", "")}`;
  const unreachableSql = postgres(missingDatabaseUrl.toString(), {
    max: 1,
    connect_timeout: 2,
  });

  const server = await startServer({
    version: "test-version",
    checkDatabase: async () => {
      await unreachableSql`select 1`;
    },
  });

  try {
    const response = await fetch(`${server.baseUrl}/healthz`);
    assert.equal(response.status, 503);

    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.status, "unavailable");
    assert.equal(body.version, "test-version");
    assert.ok(typeof body.time === "string");

    const text = JSON.stringify(body);
    assert.doesNotMatch(text, /stack/i);
  } finally {
    await server.close();
    await unreachableSql.end({ timeout: 1 });
  }
});

test("GraphQL is mounted at /graphql and echoes the request id", async () => {
  const server = await startServer({ checkDatabase: async () => {} });

  try {
    const response = await postGraphQL(server, "{ __typename }", {
      "x-request-id": "request-id-test",
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-request-id"), "request-id-test");

    const body = (await response.json()) as {
      data: { __typename: string };
    };
    assert.equal(body.data.__typename, "Query");
  } finally {
    await server.close();
  }
});

test("anonymous me maps to the documented UNAUTHENTICATED code", async () => {
  const server = await startServer({ checkDatabase: async () => {} });

  try {
    const response = await postGraphQL(server, "{ me { id } }");
    assert.equal(response.status, 200);

    const body = (await response.json()) as {
      errors: Array<{ message: string; extensions: { code: string } }>;
    };
    assert.equal(body.errors.length, 1);
    assert.equal(body.errors[0]?.extensions.code, "UNAUTHENTICATED");
    assert.doesNotMatch(body.errors[0]?.message ?? "", /stack/i);
  } finally {
    await server.close();
  }
});

test("unknown operations are validation errors, not internal errors", async () => {
  const server = await startServer({ checkDatabase: async () => {} });

  try {
    const response = await postGraphQL(server, "{ noSuchOperation { id } }");
    assert.equal(response.status, 200);

    const body = (await response.json()) as {
      errors: Array<{ message: string; extensions?: { code?: string } }>;
    };
    assert.ok(body.errors.length > 0);
    assert.match(body.errors[0]?.message ?? "", /Cannot query field/);
  } finally {
    await server.close();
  }
});

test("internal errors are masked by the GraphQL boundary", () => {
  const masked = maskGraphQLError(new Error("raw secret token"));
  assert.equal(masked.message, "Unexpected error.");
  assert.equal(masked.extensions?.code, "INTERNAL_SERVER_ERROR");
  assert.doesNotMatch(JSON.stringify(masked.toJSON()), /raw secret token/);

  const maskedGraphQLError = maskGraphQLError(
    new GraphQLError("raw secret token"),
  );
  assert.equal(maskedGraphQLError.message, "Unexpected error.");
  assert.doesNotMatch(
    JSON.stringify(maskedGraphQLError.toJSON()),
    /raw secret token/,
  );
});

test("JSON bodies over the limit return 413 without echoing the body", async () => {
  const server = await startServer({
    checkDatabase: async () => {},
    jsonBodyLimit: "1kb",
  });

  try {
    const response = await fetch(`${server.baseUrl}/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: `{ __typename } # ${"x".repeat(2048)}` }),
    });
    assert.equal(response.status, 413);

    const body = (await response.json()) as {
      error: { code: string; message: string };
      requestId: string;
    };
    assert.equal(body.error.code, "VALIDATION_FAILED");
    assert.doesNotMatch(JSON.stringify(body), /x{64}/);
    assert.ok(body.requestId.length > 0);
  } finally {
    await server.close();
  }
});

test("CORS allows configured origins and rejects unknown cross-origin writes", async () => {
  const server = await startServer({ checkDatabase: async () => {} });

  try {
    const allowed = await fetch(`${server.baseUrl}/graphql`, {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
      },
    });
    assert.equal(allowed.status, 204);
    assert.equal(
      allowed.headers.get("access-control-allow-origin"),
      "http://localhost:5173",
    );
    assert.equal(
      allowed.headers.get("access-control-allow-credentials"),
      "true",
    );

    const blocked = await postGraphQL(server, "{ __typename }", {
      origin: "https://evil.example",
    });
    assert.equal(blocked.status, 403);

    const body = (await blocked.json()) as { error: { code: string } };
    assert.equal(body.error.code, "FORBIDDEN");
  } finally {
    await server.close();
  }
});

test("introspection is disabled in production", async () => {
  const server = await startServer({
    nodeEnv: "production",
    checkDatabase: async () => {},
  });

  try {
    const response = await postGraphQL(
      server,
      "{ __schema { queryType { name } } }",
    );
    const body = (await response.json()) as {
      errors?: Array<{ message: string }>;
      data?: unknown;
    };
    assert.ok(body.errors && body.errors.length > 0);
    assert.equal(body.data, undefined);
    assert.match(body.errors[0]?.message ?? "", /introspection/i);
  } finally {
    await server.close();
  }
});
