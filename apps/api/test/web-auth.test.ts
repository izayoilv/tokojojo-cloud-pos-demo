import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, test } from "node:test";

import { GraphQLError } from "graphql";

import { createApp, type CreateAppOptions } from "../src/app.ts";
import { authorizeOperation } from "../src/auth/operation-guard.ts";
import {
  getPepper,
  hashPassword,
  loadPepperConfigFromEnv,
  type PepperConfig,
  verifyPassword,
} from "../src/auth/passwords.ts";
import { createAuthServices } from "../src/auth/services.ts";
import { CSRF_COOKIE, hashToken, SESSION_COOKIE } from "../src/auth/tokens.ts";
import { createRequestContext } from "../src/graphql/context.ts";
import { randomSuffix, testSql } from "./db.ts";

const sharedSql = await import("../src/db/client.ts").then(
  (module) => module.sql,
);

after(async () => {
  await Promise.all([testSql.end(), sharedSql.end({ timeout: 5 })]);
});

interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

interface TestUser {
  id: string;
  username: string;
  password: string;
}

async function startServer(
  options: CreateAppOptions = {},
): Promise<TestServer> {
  const app = createApp({
    checkDatabase: async () => {},
    ...options,
  });
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

async function createTestUser(
  options: {
    password?: string;
    role?: "OWNER" | "ADMIN" | "CASHIER" | "WAREHOUSE";
    isActive?: boolean;
    pepper?: string;
    pepperVersion?: number;
  } = {},
): Promise<TestUser> {
  const suffix = randomSuffix();
  const username = `web-${suffix}`;
  const password = options.password ?? "correct-password";
  const pepperConfig = loadPepperConfigFromEnv();
  const pepperVersion = options.pepperVersion ?? pepperConfig.currentVersion;
  const pepper =
    options.pepper ?? getPepper(pepperConfig, pepperConfig.currentVersion);
  const passwordHash = await hashPassword(password, pepper);

  const [row] = await testSql`
    insert into users (
      name, username, password_hash, password_pepper_version, role, is_active
    )
    values (
      ${`Web User ${suffix}`}, ${username}, ${passwordHash},
      ${pepperVersion}, ${options.role ?? "CASHIER"}, ${options.isActive ?? true}
    )
    returning id`;

  return { id: row.id, username, password };
}

const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      accessExpiresAt
      refreshToken
      offlineToken
      device { id }
      serverTime
      keySet { kid }
      user { id username role isActive }
    }
  }
`;

interface GraphQLResponseBody {
  data?: Record<string, unknown>;
  errors?: Array<{
    message: string;
    extensions?: { code?: string };
  }>;
}

async function graphql(
  server: TestServer,
  query: string,
  options: {
    variables?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
): Promise<{ response: Response; body: GraphQLResponseBody }> {
  const response = await fetch(`${server.baseUrl}/graphql`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
    body: JSON.stringify({ query, variables: options.variables }),
  });

  return {
    response,
    body: (await response.json()) as GraphQLResponseBody,
  };
}

async function login(
  server: TestServer,
  username: string,
  password: string,
  headers: Record<string, string> = { "x-client-platform": "WEB" },
) {
  return graphql(server, LOGIN_MUTATION, {
    variables: { input: { username, password } },
    headers,
  });
}

function cookieValue(setCookies: string[], name: string): string {
  const cookie = setCookies.find((value) => value.startsWith(`${name}=`));
  assert.ok(cookie, `missing cookie ${name}`);
  return decodeURIComponent(cookie.slice(name.length + 1).split(";")[0] ?? "");
}

function cookieHeader(setCookies: string[]): string {
  return setCookies
    .filter((cookie) => !cookie.includes("Max-Age=0"))
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

function errorCode(body: GraphQLResponseBody): string | undefined {
  return body.errors?.[0]?.extensions?.code;
}

test("web login sets hashed sessions and both secure cookies", async () => {
  const user = await createTestUser({ role: "CASHIER" });
  const server = await startServer();

  try {
    const { response, body } = await login(
      server,
      user.username,
      user.password,
    );
    assert.equal(response.status, 200);
    assert.equal(body.errors, undefined);

    const payload = body.data?.login as {
      accessToken: string | null;
      accessExpiresAt: string;
      refreshToken: string | null;
      offlineToken: string | null;
      device: unknown;
      serverTime: string;
      keySet: unknown[];
      user: { id: string; username: string; role: string };
    };
    assert.equal(payload.user.id, user.id);
    assert.equal(payload.user.role, "CASHIER");
    assert.equal(payload.accessToken, null);
    assert.equal(payload.refreshToken, null);
    assert.equal(payload.offlineToken, null);
    assert.equal(payload.device, null);
    assert.ok(payload.keySet.length >= 1);
    assert.ok(!Number.isNaN(Date.parse(payload.accessExpiresAt)));
    assert.ok(!Number.isNaN(Date.parse(payload.serverTime)));

    const setCookies = response.headers.getSetCookie();
    const sessionCookie = setCookies.find((cookie) =>
      cookie.startsWith(`${SESSION_COOKIE}=`),
    );
    const csrfCookieHeader = setCookies.find((cookie) =>
      cookie.startsWith(`${CSRF_COOKIE}=`),
    );
    assert.ok(sessionCookie);
    assert.ok(csrfCookieHeader);
    assert.match(sessionCookie, /HttpOnly/);
    assert.doesNotMatch(csrfCookieHeader, /HttpOnly/);

    for (const cookie of [sessionCookie, csrfCookieHeader]) {
      assert.match(cookie, /Secure/);
      assert.match(cookie, /SameSite=Lax/);
      assert.match(cookie, /Path=\//);
      assert.doesNotMatch(cookie, /Domain=/);
      assert.match(cookie, /Max-Age=3600/);
    }

    const rawSessionToken = cookieValue(setCookies, SESSION_COOKIE);
    const rawCsrfToken = cookieValue(setCookies, CSRF_COOKIE);
    const [session] = await testSql`
      select token_hash, csrf_token_hash, expires_at, revoked_at
      from sessions
      where user_id = ${user.id}
      order by created_at desc
      limit 1`;
    assert.equal(session.token_hash, hashToken(rawSessionToken));
    assert.notEqual(session.token_hash, rawSessionToken);
    assert.equal(session.csrf_token_hash, hashToken(rawCsrfToken));
    assert.equal(session.revoked_at, null);

    const me = await graphql(server, "{ me { id username role isActive } }", {
      headers: { cookie: cookieHeader(setCookies) },
    });
    assert.equal(me.body.errors, undefined);
    assert.deepEqual(me.body.data?.me, {
      id: user.id,
      username: user.username,
      role: "CASHIER",
      isActive: true,
    });

    const audits = await testSql`
      select event_type, metadata
      from audit_events
      where actor_user_id = ${user.id}
      order by created_at`;
    assert.equal(audits[0]?.event_type, "AUTH_LOGIN_SUCCEEDED");
    assert.deepEqual(audits[0]?.metadata, { platform: "WEB" });
  } finally {
    await server.close();
  }
});

test("bad credentials stay generic and missing platform is rejected", async () => {
  const user = await createTestUser();
  const server = await startServer();

  try {
    const missingPlatform = await login(
      server,
      user.username,
      user.password,
      {},
    );
    assert.equal(missingPlatform.response.status, 200);
    assert.equal(errorCode(missingPlatform.body), "VALIDATION_FAILED");

    const badPassword = await login(server, user.username, "wrong-password");
    assert.equal(errorCode(badPassword.body), "UNAUTHENTICATED");
    assert.equal(
      badPassword.body.errors?.[0]?.message,
      "Username atau password salah.",
    );
    assert.deepEqual(badPassword.response.headers.getSetCookie(), []);

    const unknownUser = await login(
      server,
      `missing-${randomSuffix()}`,
      "wrong-password",
    );
    assert.equal(errorCode(unknownUser.body), "UNAUTHENTICATED");
    assert.equal(
      unknownUser.body.errors?.[0]?.message,
      badPassword.body.errors?.[0]?.message,
    );

    const failures = await testSql`
      select metadata
      from audit_events
      where event_type = 'AUTH_LOGIN_FAILED'
        and metadata->>'username' = ${user.username}`;
    assert.ok(failures.length >= 1);
    assert.equal(failures.at(-1)?.metadata.reason, "INVALID_CREDENTIALS");
  } finally {
    await server.close();
  }
});

test("disabled users get USER_DISABLED after a valid password", async () => {
  const user = await createTestUser({ isActive: false });
  const server = await startServer();

  try {
    const result = await login(server, user.username, user.password);
    assert.equal(errorCode(result.body), "USER_DISABLED");

    const failure = await testSql`
      select metadata
      from audit_events
      where actor_user_id = ${user.id}
        and event_type = 'AUTH_LOGIN_FAILED'
      order by created_at desc
      limit 1`;
    assert.equal(failure[0]?.metadata.reason, "USER_DISABLED");
  } finally {
    await server.close();
  }
});

test("an outdated pepper rehashes the password on successful login", async () => {
  const peppers: PepperConfig = {
    currentVersion: 2,
    peppers: new Map([
      [1, "old-pepper-for-test"],
      [2, "new-pepper-for-test"],
    ]),
  };
  const user = await createTestUser({
    pepper: "old-pepper-for-test",
    pepperVersion: 1,
  });
  const server = await startServer({ auth: { peppers } });

  try {
    const first = await login(server, user.username, user.password);
    assert.equal(first.body.errors, undefined);

    const [row] = await testSql`
      select password_hash, password_pepper_version
      from users
      where id = ${user.id}`;
    assert.equal(Number(row.password_pepper_version), 2);
    assert.match(row.password_hash, /^\$argon2id\$/);
    assert.equal(
      await verifyPassword(
        row.password_hash,
        user.password,
        "new-pepper-for-test",
      ),
      true,
    );

    const second = await login(server, user.username, user.password);
    assert.equal(second.body.errors, undefined);
  } finally {
    await server.close();
  }
});

test("login rotation revokes the previous session", async () => {
  const user = await createTestUser();
  const server = await startServer();

  try {
    const first = await login(server, user.username, user.password);
    const firstCookies = first.response.headers.getSetCookie();

    const second = await login(server, user.username, user.password);
    assert.equal(second.body.errors, undefined);
    const secondCookies = second.response.headers.getSetCookie();

    const sessions = await testSql`
      select id, revoked_at
      from sessions
      where user_id = ${user.id}
      order by created_at, id`;
    assert.equal(sessions.length, 2);
    assert.equal(
      sessions.filter((session) => session.revoked_at !== null).length,
      1,
    );

    const oldSession = await graphql(server, "{ me { id } }", {
      headers: { cookie: cookieHeader(firstCookies) },
    });
    assert.equal(errorCode(oldSession.body), "UNAUTHENTICATED");

    const newSession = await graphql(server, "{ me { id } }", {
      headers: { cookie: cookieHeader(secondCookies) },
    });
    assert.equal(newSession.body.errors, undefined);

    const [revokedAudit] = await testSql`
      select metadata
      from audit_events
      where actor_user_id = ${user.id}
        and event_type = 'SESSION_REVOKED'
      order by created_at desc
      limit 1`;
    assert.deepEqual(revokedAudit?.metadata, { reason: "LOGIN_ROTATION" });
  } finally {
    await server.close();
  }
});

test("expired sessions become UNAUTHENTICATED", async () => {
  const user = await createTestUser();
  let now = new Date();
  const server = await startServer({ auth: { now: () => now } });

  try {
    const result = await login(server, user.username, user.password);
    const cookies = result.response.headers.getSetCookie();

    now = new Date(now.getTime() + 61 * 60 * 1000);

    const me = await graphql(server, "{ me { id } }", {
      headers: { cookie: cookieHeader(cookies) },
    });
    assert.equal(errorCode(me.body), "UNAUTHENTICATED");
  } finally {
    await server.close();
  }
});

test("logout requires a valid CSRF token and revokes the session", async () => {
  const user = await createTestUser();
  const server = await startServer();

  try {
    const loginResult = await login(server, user.username, user.password);
    const setCookies = loginResult.response.headers.getSetCookie();
    const cookies = cookieHeader(setCookies);
    const csrfToken = cookieValue(setCookies, CSRF_COOKIE);

    const missing = await graphql(server, "mutation { logout }", {
      headers: { cookie: cookies },
    });
    assert.equal(errorCode(missing.body), "FORBIDDEN");

    const wrong = await graphql(server, "mutation { logout }", {
      headers: { cookie: cookies, "x-csrf-token": "wrong-token" },
    });
    assert.equal(errorCode(wrong.body), "FORBIDDEN");

    const logout = await graphql(server, "mutation { logout }", {
      headers: { cookie: cookies, "x-csrf-token": csrfToken },
    });
    assert.equal(logout.body.errors, undefined);
    assert.equal(logout.body.data?.logout, true);

    const cleared = logout.response.headers.getSetCookie();
    for (const cookie of cleared) {
      assert.match(cookie, /Max-Age=0/);
    }

    const [session] = await testSql`
      select revoked_at
      from sessions
      where user_id = ${user.id}
      order by created_at desc
      limit 1`;
    assert.ok(session?.revoked_at instanceof Date);

    const me = await graphql(server, "{ me { id } }", {
      headers: { cookie: cookies },
    });
    assert.equal(errorCode(me.body), "UNAUTHENTICATED");

    const [audit] = await testSql`
      select event_type
      from audit_events
      where actor_user_id = ${user.id}
        and event_type = 'AUTH_LOGOUT'`;
    assert.ok(audit);
  } finally {
    await server.close();
  }
});

test("cross-origin login attempts are rejected", async () => {
  const user = await createTestUser();
  const server = await startServer();

  try {
    const result = await login(server, user.username, user.password, {
      "x-client-platform": "WEB",
      origin: "https://evil.example",
    });
    assert.equal(result.response.status, 403);
    const errorBody = result.body as unknown as {
      error?: { code?: string };
    };
    assert.equal(errorBody.error?.code, "FORBIDDEN");
  } finally {
    await server.close();
  }
});

test("role guard allows catalog read and denies user management", async () => {
  const user = await createTestUser({ role: "CASHIER" });
  const server = await startServer();

  try {
    const loginResult = await login(server, user.username, user.password);
    const cookies = cookieHeader(loginResult.response.headers.getSetCookie());

    const request = new Request("http://localhost/graphql", {
      headers: { cookie: cookies },
    });
    const context = await createRequestContext(request, {
      auth: createAuthServices(),
      allowedOrigins: [],
    });

    assert.equal(context.user?.role, "CASHIER");
    assert.doesNotThrow(() => authorizeOperation("products", "query", context));
    assert.throws(
      () => authorizeOperation("users", "query", context),
      (error: unknown) =>
        error instanceof GraphQLError && error.extensions.code === "FORBIDDEN",
    );
    assert.throws(
      () => authorizeOperation("logout", "mutation", context),
      (error: unknown) =>
        error instanceof GraphQLError && error.extensions.code === "FORBIDDEN",
    );
  } finally {
    await server.close();
  }
});

test("login rate limit applies per username and per IP", async () => {
  const first = await createTestUser();
  const second = await createTestUser();
  const server = await startServer({
    auth: {
      rateLimit: { perIp: 2, perUsername: 2, windowMs: 60_000 },
    },
  });

  try {
    const one = await login(server, first.username, "wrong-password");
    assert.equal(errorCode(one.body), "UNAUTHENTICATED");

    const two = await login(server, first.username, "wrong-password");
    assert.equal(errorCode(two.body), "UNAUTHENTICATED");

    const usernameLimited = await login(
      server,
      first.username,
      "wrong-password",
    );
    assert.equal(errorCode(usernameLimited.body), "RATE_LIMITED");

    const ipLimited = await login(server, second.username, "wrong-password");
    assert.equal(errorCode(ipLimited.body), "RATE_LIMITED");
  } finally {
    await server.close();
  }
});

test("disabled users cannot continue on a still-valid session", async () => {
  const user = await createTestUser();
  const server = await startServer();

  try {
    const result = await login(server, user.username, user.password);
    const cookies = cookieHeader(result.response.headers.getSetCookie());

    await testSql`update users set is_active = false where id = ${user.id}`;

    const me = await graphql(server, "{ me { id } }", {
      headers: { cookie: cookies },
    });
    assert.equal(errorCode(me.body), "USER_DISABLED");
  } finally {
    await server.close();
  }
});
