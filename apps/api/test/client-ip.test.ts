import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, test } from "node:test";

import { createApp } from "../src/app.ts";
import { parseTrustedProxies, resolveClientIp } from "../src/http/client-ip.ts";

const sharedSql = await import("../src/db/client.ts").then(
  (module) => module.sql,
);

after(async () => {
  await sharedSql.end({ timeout: 5 });
});

async function startServer(options: Parameters<typeof createApp>[0]) {
  const app = createApp({ checkDatabase: async () => {}, ...options });
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function nonceRequest(baseUrl: string, spoofedIp: string): Promise<Response> {
  return fetch(`${baseUrl}/auth/nonce`, {
    headers: {
      "cf-connecting-ip": spoofedIp,
      "x-device-id": crypto.randomUUID(),
      "x-device-key-id": `kid-${crypto.randomUUID()}`,
    },
  });
}

function loginRequest(
  baseUrl: string,
  username: string,
  spoofedIp: string,
): Promise<Response> {
  return fetch(`${baseUrl}/graphql`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client-platform": "WEB",
      "cf-connecting-ip": spoofedIp,
    },
    body: JSON.stringify({
      query:
        "mutation($input: LoginInput!) { login(input: $input) { user { id } } }",
      variables: { input: { username, password: "wrong-password" } },
    }),
  });
}

async function errorCode(response: Response): Promise<string | undefined> {
  const body = (await response.json()) as {
    errors?: Array<{ extensions?: { code?: string } }>;
    error?: { code?: string };
  };
  return body.errors?.[0]?.extensions?.code ?? body.error?.code;
}

test("client IP ignores spoofed proxy headers by default", () => {
  assert.equal(
    resolveClientIp({
      peerAddress: "127.0.0.1",
      headers: new Headers({
        "cf-connecting-ip": "203.0.113.9",
        "x-forwarded-for": "198.51.100.7, 10.0.0.1",
      }),
      trustedProxies: [],
    }),
    "127.0.0.1",
  );
  assert.deepEqual(parseTrustedProxies(undefined), []);
  assert.deepEqual(parseTrustedProxies(""), []);
});

test("client IP honors headers only from a trusted proxy", () => {
  assert.equal(
    resolveClientIp({
      peerAddress: "127.0.0.1",
      headers: new Headers({ "cf-connecting-ip": "203.0.113.9" }),
      trustedProxies: ["127.0.0.1"],
    }),
    "203.0.113.9",
  );
  assert.equal(
    resolveClientIp({
      peerAddress: "127.0.0.1",
      headers: new Headers({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" }),
      trustedProxies: ["127.0.0.1"],
    }),
    "198.51.100.7",
  );
  assert.deepEqual(parseTrustedProxies("127.0.0.1, 10.0.0.0/8"), [
    "127.0.0.1",
    "10.0.0.0/8",
  ]);
});

test("nonce and GraphQL use the same client IP resolver", async () => {
  const limitedAuth = {
    nonceRateLimit: { perIp: 1, perUsername: 100, windowMs: 60_000 },
    rateLimit: { perIp: 1, perUsername: 100, windowMs: 60_000 },
  };
  const untrusted = await startServer({ auth: limitedAuth });
  try {
    const firstNonce = await nonceRequest(untrusted.baseUrl, "203.0.113.10");
    assert.equal(firstNonce.status, 404);
    const secondNonce = await nonceRequest(untrusted.baseUrl, "203.0.113.11");
    assert.equal(secondNonce.status, 429);
    assert.equal(await errorCode(secondNonce), "RATE_LIMITED");

    const firstLogin = await loginRequest(
      untrusted.baseUrl,
      `missing-${crypto.randomUUID()}`,
      "203.0.113.12",
    );
    assert.equal(await errorCode(firstLogin), "UNAUTHENTICATED");
    const secondLogin = await loginRequest(
      untrusted.baseUrl,
      `missing-${crypto.randomUUID()}`,
      "203.0.113.13",
    );
    assert.equal(await errorCode(secondLogin), "RATE_LIMITED");
  } finally {
    await untrusted.close();
  }

  const trusted = await startServer({
    auth: limitedAuth,
    trustedProxies: "127.0.0.1",
  });
  try {
    const firstNonce = await nonceRequest(trusted.baseUrl, "203.0.113.20");
    assert.equal(firstNonce.status, 404);
    const secondNonce = await nonceRequest(trusted.baseUrl, "203.0.113.21");
    assert.equal(secondNonce.status, 404);

    const firstLogin = await loginRequest(
      trusted.baseUrl,
      `missing-${crypto.randomUUID()}`,
      "203.0.113.22",
    );
    assert.equal(await errorCode(firstLogin), "UNAUTHENTICATED");
    const secondLogin = await loginRequest(
      trusted.baseUrl,
      `missing-${crypto.randomUUID()}`,
      "203.0.113.23",
    );
    assert.equal(await errorCode(secondLogin), "UNAUTHENTICATED");
  } finally {
    await trusted.close();
  }
});
