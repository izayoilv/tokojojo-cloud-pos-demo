import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, test } from "node:test";

import { createApp } from "../src/app.ts";
import {
  getPepper,
  hashPassword,
  loadPepperConfigFromEnv,
} from "../src/auth/passwords.ts";
import { randomSuffix, testSql } from "./db.ts";

const sharedSql = await import("../src/db/client.ts").then(
  (module) => module.sql,
);

after(async () => {
  await Promise.all([testSql.end(), sharedSql.end({ timeout: 5 })]);
});

type Role = "OWNER" | "ADMIN" | "CASHIER" | "WAREHOUSE";

async function createUser(role: Role) {
  const suffix = randomSuffix();
  const username = `enroll-role-${suffix}`;
  const password = "enroll-role-password";
  const config = loadPepperConfigFromEnv();
  const passwordHash = await hashPassword(
    password,
    getPepper(config, config.currentVersion),
  );
  const [row] = await testSql`
    insert into users (
      name, username, password_hash, password_pepper_version, role
    )
    values (
      ${`Enroll ${role}`}, ${username}, ${passwordHash},
      ${config.currentVersion}, ${role}
    )
    returning id`;
  return { id: row.id, username, password };
}

async function startServer() {
  const app = createApp({ checkDatabase: async () => {} });
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

async function enroll(
  baseUrl: string,
  user: { username: string; password: string },
  platform: "ANDROID" | "TAURI",
  keyId: string,
) {
  const pair = await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ]);
  const publicKey = Buffer.from(
    await crypto.subtle.exportKey("raw", pair.publicKey),
  ).toString("base64url");
  const response = await fetch(`${baseUrl}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `mutation($input: EnrollDeviceInput!) {
        enrollDevice(input: $input) { device { id } }
      }`,
      variables: {
        input: {
          username: user.username,
          password: user.password,
          name: `Role matrix ${randomSuffix()}`,
          platform,
          keyId,
          publicKey,
        },
      },
    }),
  });
  const body = (await response.json()) as {
    data?: { enrollDevice?: { device: { id: string } } };
    errors?: Array<{ extensions?: { code?: string } }>;
  };
  return body;
}

test("device enrollment enforces the platform role matrix", async () => {
  const server = await startServer();
  const cases: Array<{
    role: Role;
    platform: "ANDROID" | "TAURI";
    code: string | null;
  }> = [
    { role: "CASHIER", platform: "TAURI", code: "FORBIDDEN" },
    { role: "WAREHOUSE", platform: "TAURI", code: "FORBIDDEN" },
    { role: "CASHIER", platform: "ANDROID", code: "FORBIDDEN" },
    { role: "OWNER", platform: "TAURI", code: null },
    { role: "ADMIN", platform: "TAURI", code: null },
    { role: "WAREHOUSE", platform: "ANDROID", code: null },
  ];

  try {
    for (const entry of cases) {
      const user = await createUser(entry.role);
      const keyId = `kid-role-${randomSuffix()}`;
      const body = await enroll(server.baseUrl, user, entry.platform, keyId);
      const code = body.errors?.[0]?.extensions?.code ?? null;
      assert.equal(
        code,
        entry.code,
        `${entry.role}/${entry.platform}: ${JSON.stringify(body.errors)}`,
      );
      const [row] = await testSql`
        select count(*)::int as total from devices
        where enrolled_by_user_id = ${user.id} and name like 'Role matrix %'`;
      assert.equal(
        row.total,
        entry.code === null ? 1 : 0,
        `${entry.role}/${entry.platform} device rows`,
      );
    }
  } finally {
    await server.close();
  }
});
