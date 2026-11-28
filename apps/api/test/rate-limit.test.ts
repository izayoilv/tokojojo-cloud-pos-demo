import assert from "node:assert/strict";
import { after, test } from "node:test";

import { LoginRateLimiter } from "../src/auth/rate-limit.ts";

const sharedSql = await import("../src/db/client.ts").then(
  (module) => module.sql,
);

after(async () => {
  await sharedSql.end({ timeout: 5 });
});

test("rate limiter store is bounded for 10k unique identities", () => {
  let now = 0;
  const limiter = new LoginRateLimiter(
    {
      perIp: 1_000_000,
      perUsername: 1_000_000,
      windowMs: 60_000,
      maxKeys: 500,
    },
    () => now,
  );

  for (let index = 0; index < 10_000; index += 1) {
    limiter.recordFailure("203.0.113.1", `user-${index}`);
  }
  assert.ok(limiter.size <= 500, `size ${limiter.size} exceeds cap`);

  const deviceLimiter = new LoginRateLimiter(
    {
      perIp: 1_000_000,
      perUsername: 1_000_000,
      windowMs: 60_000,
      maxKeys: 500,
    },
    () => now,
  );
  for (let index = 0; index < 10_000; index += 1) {
    deviceLimiter.recordDeviceFailure(`device-${index}`);
  }
  assert.ok(
    deviceLimiter.size <= 500,
    `size ${deviceLimiter.size} exceeds cap`,
  );

  now = 61_000;
  limiter.sweepExpired();
  assert.equal(limiter.size, 0);
  limiter.stop();
  deviceLimiter.stop();
});

test("native refresh does not rate-limit on an unverified device id", async () => {
  const { createApp } = await import("../src/app.ts");
  const { createAuthServices } = await import("../src/auth/services.ts");
  const { createServer } = await import("node:http");
  const { createHash, generateKeyPairSync, randomUUID, sign } =
    await import("node:crypto");

  const authServices = createAuthServices({
    refreshRateLimit: { perIp: 100, perUsername: 1, windowMs: 60_000 },
  });
  const app = createApp({
    checkDatabase: async () => {},
    authServices,
  });
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const pair = generateKeyPairSync("ed25519");
    const publicKey = (
      pair.publicKey.export({ format: "jwk" }) as { x?: string }
    ).x;
    assert.ok(publicKey);
    const deviceId = randomUUID();
    const keyId = `kid-review-${randomUUID()}`;

    async function refreshAttempt(): Promise<Response> {
      const nonce = `nonce-${randomUUID()}`;
      const clientTime = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      const payload = "review-refresh-token";
      const hash = createHash("sha256").update(payload, "utf8").digest("hex");
      const canonical = [
        "v1",
        "refresh",
        deviceId,
        keyId,
        nonce,
        clientTime,
        hash,
      ].join("\n");
      const signature = sign(
        null,
        Buffer.from(canonical, "utf8"),
        pair.privateKey,
      ).toString("base64url");
      return fetch(`${baseUrl}/graphql`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-client-platform": "TAURI",
          "x-device-id": deviceId,
          "x-device-key-id": keyId,
          "x-nonce": nonce,
          "x-client-time": clientTime,
          "x-device-signature": `v1:${signature}`,
        },
        body: JSON.stringify({
          query:
            "mutation($input: RefreshInput!) { refresh(input: $input) { accessToken } }",
          variables: { input: { refreshToken: payload } },
        }),
      });
    }

    const first = await refreshAttempt();
    const firstBody = (await first.json()) as {
      errors?: Array<{ extensions?: { code?: string } }>;
    };
    const second = await refreshAttempt();
    const secondBody = (await second.json()) as {
      errors?: Array<{ extensions?: { code?: string } }>;
    };

    assert.notEqual(firstBody.errors?.[0]?.extensions?.code, "RATE_LIMITED");
    assert.notEqual(secondBody.errors?.[0]?.extensions?.code, "RATE_LIMITED");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    authServices.stop();
  }
});
