import assert from "node:assert/strict";
import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";
import { createServer, type Server } from "node:http";
import { after, test } from "node:test";

import { createApp, type CreateAppOptions } from "../src/app.ts";
import { createPasetoService } from "../src/auth/paseto.ts";
import {
  getPepper,
  hashPassword,
  loadPepperConfigFromEnv,
} from "../src/auth/passwords.ts";
import { CSRF_COOKIE } from "../src/auth/tokens.ts";
import { randomSuffix, testSql } from "./db.ts";

const sharedSql = await import("../src/db/client.ts").then(
  (module) => module.sql,
);

after(async () => {
  await Promise.all([testSql.end(), sharedSql.end({ timeout: 5 })]);
});

const PASETO_HEADER = "v4.public.";

interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

interface TestUser {
  id: string;
  username: string;
  password: string;
}

interface TestDeviceKey {
  keyId: string;
  publicKey: string;
  privateKey: KeyObject;
}

interface ActiveDevice {
  id: string;
  key: TestDeviceKey;
}

async function startServer(
  options: CreateAppOptions = {},
): Promise<TestServer> {
  const app = createApp({ checkDatabase: async () => {}, ...options });
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
  role: "OWNER" | "ADMIN" | "CASHIER" | "WAREHOUSE" = "WAREHOUSE",
): Promise<TestUser> {
  const suffix = randomSuffix();
  const username = `native-${suffix}`;
  const password = "native-password";
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
      ${`Native ${suffix}`}, ${username}, ${passwordHash},
      ${config.currentVersion}, ${role}
    )
    returning id`;

  return { id: row.id, username, password };
}

function createDeviceKey(): TestDeviceKey {
  const pair = generateKeyPairSync("ed25519");
  const publicKey = (pair.publicKey.export({ format: "jwk" }) as { x?: string })
    .x;
  assert.ok(publicKey);

  return {
    keyId: `kid-${randomSuffix()}`,
    publicKey,
    privateKey: pair.privateKey,
  };
}

interface GraphQLBody {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

async function graphql(
  server: TestServer,
  query: string,
  options: {
    variables?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
): Promise<{ response: Response; body: GraphQLBody }> {
  const response = await fetch(`${server.baseUrl}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json", ...options.headers },
    body: JSON.stringify({ query, variables: options.variables }),
  });
  return { response, body: (await response.json()) as GraphQLBody };
}

function errorCode(body: GraphQLBody): string | undefined {
  return body.errors?.[0]?.extensions?.code;
}

const ENROLL_MUTATION = `
  mutation Enroll($input: EnrollDeviceInput!) {
    enrollDevice(input: $input) {
      user { id username role }
      device {
        id
        status
        platform
        keys { keyId status publicKey }
      }
      accessToken
      refreshToken
      accessExpiresAt
      serverTime
    }
  }
`;

const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
      accessExpiresAt
      refreshExpiresAt
      offlineToken
      offlineExpiresAt
      graceUntil
      user { id username role }
      device { id status }
      keySet { kid publicKey alg }
    }
  }
`;

const REFRESH_MUTATION = `
  mutation Refresh($input: RefreshInput!) {
    refresh(input: $input) {
      accessToken
      refreshToken
      accessExpiresAt
      refreshExpiresAt
      user { id username role }
      device { id status }
    }
  }
`;

async function enrollDevice(
  server: TestServer,
  user: TestUser,
  key: TestDeviceKey,
  platform: "ANDROID" | "TAURI" = "ANDROID",
) {
  return graphql(server, ENROLL_MUTATION, {
    variables: {
      input: {
        username: user.username,
        password: user.password,
        name: `Device ${randomSuffix()}`,
        platform,
        keyId: key.keyId,
        publicKey: key.publicKey,
      },
    },
  });
}

async function activateDevice(deviceId: string): Promise<void> {
  await testSql`
    update devices
    set status = 'ACTIVE', enrolled_at = coalesce(enrolled_at, now())
    where id = ${deviceId}`;
}

async function activeDeviceFor(
  server: TestServer,
  user: TestUser,
  platform: "ANDROID" | "TAURI" = "ANDROID",
): Promise<ActiveDevice> {
  const key = createDeviceKey();
  const enrollment = await enrollDevice(server, user, key, platform);
  const device = (
    enrollment.body.data?.enrollDevice as {
      device: { id: string };
    }
  ).device;
  await activateDevice(device.id);
  return { id: device.id, key };
}

async function getNonce(
  server: TestServer,
  device: ActiveDevice,
): Promise<string> {
  const response = await fetch(`${server.baseUrl}/auth/nonce`, {
    headers: {
      "x-device-id": device.id,
      "x-device-key-id": device.key.keyId,
    },
  });
  const body = (await response.json()) as { nonce: string };
  assert.equal(response.status, 200);
  return body.nonce;
}

function payloadHash(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function signDeviceRequest(input: {
  device: ActiveDevice;
  operation:
    | "login"
    | "refresh"
    | "rotateDeviceKey"
    | "upgradeOfflineSession"
    | "syncOfflineBatch";
  payload: string;
  nonce: string;
  clientTime: Date;
}): Record<string, string> {
  const clientTime = input.clientTime.toISOString().replace(/\.\d{3}Z$/, "Z");
  const canonical = [
    "v1",
    input.operation,
    input.device.id,
    input.device.key.keyId,
    input.nonce,
    clientTime,
    payloadHash(input.payload),
  ].join("\n");
  const signature = cryptoSign(
    null,
    Buffer.from(canonical, "utf8"),
    input.device.key.privateKey,
  ).toString("base64url");

  return {
    "x-nonce": input.nonce,
    "x-client-time": clientTime,
    "x-device-signature": `v1:${signature}`,
  };
}

async function signedHeaders(input: {
  server: TestServer;
  device: ActiveDevice;
  operation:
    | "login"
    | "refresh"
    | "rotateDeviceKey"
    | "upgradeOfflineSession"
    | "syncOfflineBatch";
  payload: string;
  clientTime?: Date;
}): Promise<Record<string, string>> {
  const nonce = await getNonce(input.server, input.device);
  return signDeviceRequest({
    ...input,
    nonce,
    clientTime: input.clientTime ?? new Date(),
  });
}

function nativeHeaders(
  device: ActiveDevice,
  platform: "ANDROID" | "TAURI",
  signatureHeaders: Record<string, string>,
): Record<string, string> {
  return {
    "x-client-platform": platform,
    "x-device-id": device.id,
    "x-device-key-id": device.key.keyId,
    ...signatureHeaders,
  };
}

async function nativeLogin(
  server: TestServer,
  user: TestUser,
  device: ActiveDevice,
  platform: "ANDROID" | "TAURI" = "ANDROID",
  clientTime?: Date,
) {
  const headers = nativeHeaders(
    device,
    platform,
    await signedHeaders({
      server,
      device,
      operation: "login",
      payload: user.username,
      clientTime,
    }),
  );
  return graphql(server, LOGIN_MUTATION, {
    variables: { input: { username: user.username, password: user.password } },
    headers,
  });
}

async function refresh(
  server: TestServer,
  device: ActiveDevice,
  refreshToken: string,
) {
  return graphql(server, REFRESH_MUTATION, {
    variables: { input: { refreshToken } },
    headers: nativeHeaders(
      device,
      "ANDROID",
      await signedHeaders({
        server,
        device,
        operation: "refresh",
        payload: refreshToken,
      }),
    ),
  });
}

function cookieValue(setCookies: string[], name: string): string {
  const cookie = setCookies.find((value) => value.startsWith(`${name}=`));
  assert.ok(cookie);
  return decodeURIComponent(cookie.slice(name.length + 1).split(";")[0] ?? "");
}

function cookieHeader(setCookies: string[]): string {
  return setCookies
    .filter((cookie) => !cookie.includes("Max-Age=0"))
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function webLogin(server: TestServer, user: TestUser) {
  const result = await graphql(server, LOGIN_MUTATION, {
    variables: { input: { username: user.username, password: user.password } },
    headers: { "x-client-platform": "WEB" },
  });
  assert.equal(result.body.errors, undefined);
  const cookies = result.response.headers.getSetCookie();
  return {
    cookies,
    cookieHeader: cookieHeader(cookies),
    csrfToken: cookieValue(cookies, CSRF_COOKIE),
    userId: (result.body.data?.login as { user: { id: string } }).user.id,
  };
}

function verifyPasetoToken(token: string, publicKey: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v4" || parts[1] !== "public") {
    return false;
  }

  const body = Buffer.from(parts[2] ?? "", "base64url");
  const message = body.subarray(0, -64);
  const signature = body.subarray(-64);
  const header = Buffer.from(PASETO_HEADER);
  const le64 = (value: number) => {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(BigInt(value));
    return buffer;
  };
  const pae = Buffer.concat([
    le64(4),
    le64(header.length),
    header,
    le64(message.length),
    message,
    le64(0),
    le64(0),
  ]);
  const spki = Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    Buffer.from(publicKey, "base64url"),
  ]);
  const key = createPublicKey({
    key: spki,
    format: "der",
    type: "spki",
  });
  return cryptoVerify(null, pae, key, signature);
}

test("valid device proof works; bad signatures are rejected", async () => {
  const user = await createTestUser();
  const server = await startServer();

  try {
    const device = await activeDeviceFor(server, user);
    const success = await nativeLogin(server, user, device);
    assert.equal(success.body.errors, undefined);

    const login = success.body.data?.login as {
      accessToken: string;
      refreshToken: string;
      offlineToken: string | null;
      keySet: Array<{ kid: string; publicKey: string; alg: string }>;
    };
    assert.match(login.accessToken, /^v4\.public\./);
    assert.ok(login.refreshToken.includes(user.id));
    assert.equal(login.offlineToken, null);
    assert.ok(login.keySet.length >= 1);
    assert.equal(login.keySet[0]?.alg, "Ed25519");
    assert.equal(
      verifyPasetoToken(login.accessToken, login.keySet[0]!.publicKey),
      true,
    );

    const headers = nativeHeaders(
      device,
      "ANDROID",
      await signedHeaders({
        server,
        device,
        operation: "login",
        payload: user.username,
      }),
    );
    const signature = headers["x-device-signature"]!;
    headers["x-device-signature"] = `${signature.slice(0, -1)}${
      signature.endsWith("A") ? "B" : "A"
    }`;

    const invalid = await graphql(server, LOGIN_MUTATION, {
      variables: {
        input: { username: user.username, password: user.password },
      },
      headers,
    });
    assert.equal(errorCode(invalid.body), "INVALID_SIGNATURE");
  } finally {
    await server.close();
  }
});

test("nonce reuse and expiry return INVALID_NONCE", async () => {
  const user = await createTestUser();
  let now = new Date();
  const server = await startServer({ auth: { now: () => now } });

  try {
    const device = await activeDeviceFor(server, user);
    const nonce = await getNonce(server, device);
    const headers = nativeHeaders(
      device,
      "ANDROID",
      signDeviceRequest({
        device,
        operation: "login",
        payload: user.username,
        nonce,
        clientTime: now,
      }),
    );

    const first = await graphql(server, LOGIN_MUTATION, {
      variables: {
        input: { username: user.username, password: user.password },
      },
      headers,
    });
    assert.equal(first.body.errors, undefined);

    const reused = await graphql(server, LOGIN_MUTATION, {
      variables: {
        input: { username: user.username, password: user.password },
      },
      headers,
    });
    assert.equal(errorCode(reused.body), "INVALID_NONCE");

    const expiringNonce = await getNonce(server, device);
    now = new Date(now.getTime() + 3 * 60 * 1000);
    const expired = await graphql(server, LOGIN_MUTATION, {
      variables: {
        input: { username: user.username, password: user.password },
      },
      headers: nativeHeaders(
        device,
        "ANDROID",
        signDeviceRequest({
          device,
          operation: "login",
          payload: user.username,
          nonce: expiringNonce,
          clientTime: now,
        }),
      ),
    });
    assert.equal(errorCode(expired.body), "INVALID_NONCE");
  } finally {
    await server.close();
  }
});

test("clock skew is rejected before nonce consumption", async () => {
  const user = await createTestUser();
  const server = await startServer();

  try {
    const device = await activeDeviceFor(server, user);
    const nonce = await getNonce(server, device);
    const skewed = await graphql(server, LOGIN_MUTATION, {
      variables: {
        input: { username: user.username, password: user.password },
      },
      headers: nativeHeaders(
        device,
        "ANDROID",
        signDeviceRequest({
          device,
          operation: "login",
          payload: user.username,
          nonce,
          clientTime: new Date(Date.now() - 6 * 60 * 1000),
        }),
      ),
    });
    assert.equal(errorCode(skewed.body), "CLOCK_SKEW");
  } finally {
    await server.close();
  }
});

test("successful refreshes never exhaust the refresh attempt budget", async () => {
  const user = await createTestUser();
  const server = await startServer({
    auth: {
      refreshRateLimit: { perIp: 1, perUsername: 1, windowMs: 60_000 },
    },
  });

  try {
    const device = await activeDeviceFor(server, user);
    const login = await nativeLogin(server, user, device);
    let refreshToken = (login.body.data?.login as { refreshToken: string })
      .refreshToken;

    for (let index = 0; index < 5; index += 1) {
      const result = await refresh(server, device, refreshToken);
      assert.equal(
        result.body.errors,
        undefined,
        `refresh ${index}: ${JSON.stringify(result.body.errors)}`,
      );
      refreshToken = (result.body.data?.refresh as { refreshToken: string })
        .refreshToken;
    }
  } finally {
    await server.close();
  }
});

test("refresh failure budget resets on success", async () => {
  const user = await createTestUser();
  const server = await startServer({
    auth: {
      refreshRateLimit: { perIp: 2, perUsername: 2, windowMs: 60_000 },
    },
  });

  try {
    const device = await activeDeviceFor(server, user);
    const login = await nativeLogin(server, user, device);
    const refreshToken = (login.body.data?.login as { refreshToken: string })
      .refreshToken;

    const beforeReset = await refresh(
      server,
      device,
      `invalid-refresh-${randomSuffix()}`,
    );
    assert.equal(errorCode(beforeReset.body), "UNAUTHENTICATED");

    const success = await refresh(server, device, refreshToken);
    assert.equal(
      success.body.errors,
      undefined,
      JSON.stringify(success.body.errors),
    );

    for (let index = 0; index < 2; index += 1) {
      const failed = await refresh(
        server,
        device,
        `invalid-refresh-${randomSuffix()}`,
      );
      assert.equal(
        errorCode(failed.body),
        "UNAUTHENTICATED",
        `post-reset failure ${index}`,
      );
    }

    const limited = await refresh(
      server,
      device,
      `invalid-refresh-${randomSuffix()}`,
    );
    assert.equal(errorCode(limited.body), "RATE_LIMITED");
  } finally {
    await server.close();
  }
});

test("PENDING devices get null tokens, then login works after approval", async () => {
  const user = await createTestUser();
  const admin = await createTestUser("OWNER");
  const server = await startServer();

  try {
    const key = createDeviceKey();
    const enrollment = await enrollDevice(server, user, key);
    const enrolled = enrollment.body.data?.enrollDevice as {
      device: { id: string; status: string };
      accessToken: string | null;
      refreshToken: string | null;
    };
    assert.equal(enrolled.device.status, "PENDING");
    assert.equal(enrolled.accessToken, null);
    assert.equal(enrolled.refreshToken, null);

    const pendingDevice: ActiveDevice = {
      id: enrolled.device.id,
      key,
    };
    const pendingLogin = await nativeLogin(server, user, pendingDevice);
    const pendingPayload = pendingLogin.body.data?.login as {
      accessToken: string | null;
      refreshToken: string | null;
      device: { status: string };
      user: { id: string };
    };
    assert.equal(pendingPayload.accessToken, null);
    assert.equal(pendingPayload.refreshToken, null);
    assert.equal(pendingPayload.device.status, "PENDING");
    assert.equal(pendingPayload.user.id, user.id);

    const adminSession = await webLogin(server, admin);
    const approved = await graphql(
      server,
      "mutation Approve($id: ID!) { approveDevice(deviceId: $id) { id status } }",
      {
        variables: { id: enrolled.device.id },
        headers: {
          cookie: adminSession.cookieHeader,
          "x-csrf-token": adminSession.csrfToken,
        },
      },
    );
    assert.equal(approved.body.errors, undefined);
    assert.equal(
      (approved.body.data?.approveDevice as { status: string }).status,
      "ACTIVE",
    );

    const activeLogin = await nativeLogin(server, user, pendingDevice);
    const activePayload = activeLogin.body.data?.login as {
      accessToken: string | null;
      device: { status: string };
    };
    assert.ok(activePayload.accessToken);
    assert.equal(activePayload.device.status, "ACTIVE");
  } finally {
    await server.close();
  }
});

test("refresh rotates tokens and reuse revokes the family", async () => {
  const user = await createTestUser();
  const server = await startServer();

  try {
    const device = await activeDeviceFor(server, user);
    const login = await nativeLogin(server, user, device);
    const first = login.body.data?.login as {
      accessToken: string;
      refreshToken: string;
    };

    const refreshHeaders = nativeHeaders(
      device,
      "ANDROID",
      await signedHeaders({
        server,
        device,
        operation: "refresh",
        payload: first.refreshToken,
      }),
    );
    const refreshed = await graphql(server, REFRESH_MUTATION, {
      variables: { input: { refreshToken: first.refreshToken } },
      headers: refreshHeaders,
    });
    assert.equal(refreshed.body.errors, undefined);
    const second = refreshed.body.data?.refresh as {
      accessToken: string;
      refreshToken: string;
    };
    assert.ok(second.accessToken);
    assert.notEqual(second.refreshToken, first.refreshToken);

    const reuse = await graphql(server, REFRESH_MUTATION, {
      variables: { input: { refreshToken: first.refreshToken } },
      headers: nativeHeaders(
        device,
        "ANDROID",
        await signedHeaders({
          server,
          device,
          operation: "refresh",
          payload: first.refreshToken,
        }),
      ),
    });
    assert.equal(errorCode(reuse.body), "UNAUTHENTICATED");

    const afterReuse = await graphql(server, REFRESH_MUTATION, {
      variables: { input: { refreshToken: second.refreshToken } },
      headers: nativeHeaders(
        device,
        "ANDROID",
        await signedHeaders({
          server,
          device,
          operation: "refresh",
          payload: second.refreshToken,
        }),
      ),
    });
    assert.equal(errorCode(afterReuse.body), "UNAUTHENTICATED");

    const [audit] = await testSql`
      select event_type
      from audit_events
      where event_type = 'AUTH_REFRESH_REUSE_DETECTED'
        and device_id = ${device.id}`;
    assert.ok(audit);
  } finally {
    await server.close();
  }
});

test("revoked devices and disabled users are blocked with valid tokens", async () => {
  const user = await createTestUser();
  const server = await startServer();

  try {
    const device = await activeDeviceFor(server, user);
    const login = await nativeLogin(server, user, device);
    const tokens = login.body.data?.login as {
      accessToken: string;
      refreshToken: string;
    };

    const before = await graphql(server, "{ me { id } }", {
      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
        "x-client-platform": "ANDROID",
      },
    });
    assert.equal(before.body.errors, undefined);

    await testSql`
      update devices set status = 'REVOKED', revoked_at = now()
      where id = ${device.id}`;

    const revoked = await graphql(server, "{ me { id } }", {
      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
        "x-client-platform": "ANDROID",
      },
    });
    assert.equal(errorCode(revoked.body), "DEVICE_REVOKED");

    await testSql`
      update users set is_active = false where id = ${user.id}`;

    const disabled = await graphql(server, "{ me { id } }", {
      headers: {
        cookie: "",
        authorization: `Bearer ${tokens.accessToken}`,
        "x-client-platform": "ANDROID",
      },
    });
    assert.equal(errorCode(disabled.body), "DEVICE_REVOKED");
  } finally {
    await server.close();
  }
});

test("disabled users are blocked even when the device is active", async () => {
  const user = await createTestUser();
  const server = await startServer();

  try {
    const device = await activeDeviceFor(server, user);
    const login = await nativeLogin(server, user, device);
    const accessToken = (login.body.data?.login as { accessToken: string })
      .accessToken;

    await testSql`
      update users set is_active = false where id = ${user.id}`;

    const me = await graphql(server, "{ me { id } }", {
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-client-platform": "ANDROID",
      },
    });
    assert.equal(errorCode(me.body), "USER_DISABLED");
  } finally {
    await server.close();
  }
});

test("key rotation retires the old key for a 14-day verification window", async () => {
  const user = await createTestUser();
  const server = await startServer();

  try {
    const device = await activeDeviceFor(server, user);
    const login = await nativeLogin(server, user, device);
    const accessToken = (login.body.data?.login as { accessToken: string })
      .accessToken;

    const nextKey = createDeviceKey();
    const rotate = await graphql(
      server,
      `
        mutation Rotate($input: RotateDeviceKeyInput!) {
          rotateDeviceKey(input: $input) {
            id
            keys {
              keyId
              status
              acceptedUntil
            }
          }
        }
      `,
      {
        variables: {
          input: {
            deviceId: device.id,
            keyId: nextKey.keyId,
            publicKey: nextKey.publicKey,
          },
        },
        headers: {
          authorization: `Bearer ${accessToken}`,
          ...nativeHeaders(
            device,
            "ANDROID",
            await signedHeaders({
              server,
              device,
              operation: "rotateDeviceKey",
              payload: `${nextKey.keyId}:${nextKey.publicKey}`,
            }),
          ),
        },
      },
    );
    assert.equal(rotate.body.errors, undefined);
    const keys = (
      rotate.body.data?.rotateDeviceKey as {
        keys: Array<{
          keyId: string;
          status: string;
          acceptedUntil: string | null;
        }>;
      }
    ).keys;
    const retired = keys.find((key) => key.keyId === device.key.keyId);
    const active = keys.find((key) => key.keyId === nextKey.keyId);
    assert.equal(retired?.status, "RETIRED");
    assert.ok(retired?.acceptedUntil);
    assert.equal(active?.status, "ACTIVE");

    const retiredWindowMs =
      new Date(retired.acceptedUntil!).getTime() - Date.now();
    assert.ok(retiredWindowMs > 13 * 24 * 60 * 60 * 1000);
    assert.ok(retiredWindowMs <= 14 * 24 * 60 * 60 * 1000 + 5000);

    const oldKeyLogin = await nativeLogin(server, user, device);
    assert.equal(oldKeyLogin.body.errors, undefined);

    const oldKeyNonce = await getNonce(server, device);
    const oldKeySignature = signDeviceRequest({
      device,
      operation: "login",
      payload: user.username,
      nonce: oldKeyNonce,
      clientTime: new Date(),
    });

    await testSql`
      update device_keys
      set
        retired_at = now() - interval '2 seconds',
        accepted_until = now() - interval '1 second'
      where device_id = ${device.id} and key_id = ${device.key.keyId}`;

    const expiredKeyLogin = await graphql(server, LOGIN_MUTATION, {
      variables: {
        input: { username: user.username, password: user.password },
      },
      headers: nativeHeaders(device, "ANDROID", oldKeySignature),
    });
    assert.equal(errorCode(expiredKeyLogin.body), "INVALID_SIGNATURE");
  } finally {
    await server.close();
  }
});

test("TAURI acting user role comes from the acting user, Android ignores it", async () => {
  const tauriUser = await createTestUser("OWNER");
  const actingUser = await createTestUser("CASHIER");
  const server = await startServer();

  try {
    const tauriDevice = await activeDeviceFor(server, tauriUser, "TAURI");
    const tauriLogin = await nativeLogin(
      server,
      tauriUser,
      tauriDevice,
      "TAURI",
    );
    const tauriAccess = (tauriLogin.body.data?.login as { accessToken: string })
      .accessToken;
    await testSql`
      insert into cashier_shifts (
        user_id, device_id, status, opening_cash
      )
      values (${actingUser.id}, ${tauriDevice.id}, 'OPEN', 0)`;

    const tauriMe = await graphql(server, "{ me { id role } }", {
      headers: {
        authorization: `Bearer ${tauriAccess}`,
        "x-client-platform": "TAURI",
        "x-acting-user-id": actingUser.id,
      },
    });
    assert.deepEqual(tauriMe.body.data?.me, {
      id: actingUser.id,
      role: "CASHIER",
    });

    const adminQuery = await graphql(server, "{ devices { items { id } } }", {
      headers: {
        authorization: `Bearer ${tauriAccess}`,
        "x-client-platform": "TAURI",
        "x-acting-user-id": actingUser.id,
      },
    });
    assert.equal(errorCode(adminQuery.body), "FORBIDDEN");

    const unboundUser = await createTestUser("CASHIER");
    const unbound = await graphql(server, "{ me { id role } }", {
      headers: {
        authorization: `Bearer ${tauriAccess}`,
        "x-client-platform": "TAURI",
        "x-acting-user-id": unboundUser.id,
      },
    });
    assert.equal(errorCode(unbound.body), "FORBIDDEN");

    const cashierEnroller = await createTestUser("CASHIER");
    const cashierDeviceKey = createDeviceKey();
    const [cashierDevice] = await testSql`
      insert into devices (
        name, platform, enrolled_by_user_id, status, enrolled_at
      )
      values (
        ${`Cashier Tauri ${randomSuffix()}`}, 'TAURI',
        ${cashierEnroller.id}, 'ACTIVE', now()
      )
      returning id`;
    await testSql`
      insert into device_keys (
        device_id, key_id, public_key, key_alg, status, activated_at
      )
      values (
        ${cashierDevice.id}, ${cashierDeviceKey.keyId},
        ${cashierDeviceKey.publicKey}, 'Ed25519', 'ACTIVE', now()
      )`;
    const cashierLogin = await nativeLogin(
      server,
      cashierEnroller,
      { id: cashierDevice.id, key: cashierDeviceKey },
      "TAURI",
    );
    const cashierAccess = (
      cashierLogin.body.data?.login as { accessToken: string }
    ).accessToken;
    const ownerActing = await graphql(server, "{ me { id role } }", {
      headers: {
        authorization: `Bearer ${cashierAccess}`,
        "x-client-platform": "TAURI",
        "x-acting-user-id": tauriUser.id,
      },
    });
    assert.equal(errorCode(ownerActing.body), "FORBIDDEN");

    const androidUser = await createTestUser("OWNER");
    const androidDevice = await activeDeviceFor(server, androidUser, "ANDROID");
    const androidLogin = await nativeLogin(
      server,
      androidUser,
      androidDevice,
      "ANDROID",
    );
    const androidAccess = (
      androidLogin.body.data?.login as { accessToken: string }
    ).accessToken;

    const androidMe = await graphql(server, "{ me { id role } }", {
      headers: {
        authorization: `Bearer ${androidAccess}`,
        "x-client-platform": "ANDROID",
        "x-acting-user-id": actingUser.id,
      },
    });
    assert.deepEqual(androidMe.body.data?.me, {
      id: androidUser.id,
      role: "OWNER",
    });
  } finally {
    await server.close();
  }
});

test("nonce endpoint rejects revoked devices and rate limits", async () => {
  const user = await createTestUser();
  const server = await startServer({
    auth: {
      nonceRateLimit: { perIp: 1, perUsername: 1, windowMs: 60_000 },
    },
  });

  try {
    const key = createDeviceKey();
    const enrollment = await enrollDevice(server, user, key);
    const deviceId = (
      enrollment.body.data?.enrollDevice as { device: { id: string } }
    ).device.id;

    const first = await fetch(`${server.baseUrl}/auth/nonce`, {
      headers: {
        "x-device-id": deviceId,
        "x-device-key-id": key.keyId,
      },
    });
    assert.equal(first.status, 200);

    const limited = await fetch(`${server.baseUrl}/auth/nonce`, {
      headers: {
        "x-device-id": deviceId,
        "x-device-key-id": key.keyId,
      },
    });
    assert.equal(limited.status, 429);
    const limitedBody = (await limited.json()) as {
      error?: { code?: string };
    };
    assert.equal(limitedBody.error?.code, "RATE_LIMITED");

    await testSql`
      update devices set status = 'REVOKED', revoked_at = now()
      where id = ${deviceId}`;

    const revokedServer = await startServer();
    try {
      const revoked = await fetch(`${revokedServer.baseUrl}/auth/nonce`, {
        headers: {
          "x-device-id": deviceId,
          "x-device-key-id": key.keyId,
        },
      });
      assert.equal(revoked.status, 403);
      const revokedBody = (await revoked.json()) as {
        error?: { code?: string };
      };
      assert.equal(revokedBody.error?.code, "DEVICE_REVOKED");
    } finally {
      await revokedServer.close();
    }
  } finally {
    await server.close();
  }
});

test("web admins can list devices and sessions and revoke a session", async () => {
  const admin = await createTestUser("OWNER");
  const deviceUser = await createTestUser("WAREHOUSE");
  const server = await startServer();

  try {
    const key = createDeviceKey();
    const enrollment = await enrollDevice(server, deviceUser, key);
    const deviceId = (
      enrollment.body.data?.enrollDevice as { device: { id: string } }
    ).device.id;

    const session = await webLogin(server, admin);
    const headers = {
      cookie: session.cookieHeader,
      "x-csrf-token": session.csrfToken,
    };

    const devices = await graphql(
      server,
      `
        {
          devices {
            items {
              id
              status
            }
            pageInfo {
              total
            }
          }
        }
      `,
      { headers },
    );
    assert.equal(devices.body.errors, undefined);
    const devicePage = devices.body.data?.devices as {
      items: Array<{ id: string; status: string }>;
      pageInfo: { total: number };
    };
    assert.ok(devicePage.items.some((device) => device.id === deviceId));
    assert.ok(devicePage.pageInfo.total >= 1);

    const device = await graphql(
      server,
      `
        query Device($id: ID!) {
          device(deviceId: $id) {
            id
            status
          }
        }
      `,
      { variables: { id: deviceId }, headers },
    );
    assert.deepEqual(device.body.data?.device, {
      id: deviceId,
      status: "PENDING",
    });

    const sessions = await graphql(
      server,
      `
        {
          sessions {
            id
            user {
              id
            }
            revokedAt
          }
        }
      `,
      { headers },
    );
    assert.equal(sessions.body.errors, undefined);
    const sessionRows = sessions.body.data?.sessions as Array<{
      id: string;
      user: { id: string };
    }>;
    assert.ok(sessionRows.some((row) => row.user.id === admin.id));

    const revoked = await graphql(
      server,
      `
        mutation Revoke($id: ID!) {
          revokeSession(sessionId: $id)
        }
      `,
      { variables: { id: sessionRows[0]!.id }, headers },
    );
    assert.equal(revoked.body.errors, undefined);
    assert.equal(revoked.body.data?.revokeSession, true);

    const after = await graphql(server, "{ me { id } }", {
      headers: { cookie: session.cookieHeader },
    });
    assert.equal(errorCode(after.body), "UNAUTHENTICATED");

    const [audit] = await testSql`
      select event_type
      from audit_events
      where event_type = 'SESSION_REVOKED'
        and metadata->>'reason' = 'ADMIN_REVOKED'`;
    assert.ok(audit);
  } finally {
    await server.close();
  }
});

test("a device moved back to PENDING cannot perform writes", async () => {
  const user = await createTestUser();
  const server = await startServer();

  try {
    const device = await activeDeviceFor(server, user);
    const login = await nativeLogin(server, user, device);
    const accessToken = (login.body.data?.login as { accessToken: string })
      .accessToken;

    await testSql`
      update devices set status = 'PENDING', enrolled_at = null
      where id = ${device.id}`;

    const logout = await graphql(server, "mutation { logout }", {
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-client-platform": "ANDROID",
      },
    });
    assert.equal(errorCode(logout.body), "DEVICE_PENDING");
  } finally {
    await server.close();
  }
});

function createRawPasetoKey(kid: string): {
  kid: string;
  privateKey: string;
  publicKey: string;
} {
  const pair = generateKeyPairSync("ed25519");
  const privateJwk = pair.privateKey.export({ format: "jwk" }) as {
    d?: string;
  };
  const publicJwk = pair.publicKey.export({ format: "jwk" }) as {
    x?: string;
  };
  assert.ok(privateJwk.d);
  assert.ok(publicJwk.x);
  return {
    kid,
    privateKey: privateJwk.d,
    publicKey: publicJwk.x,
  };
}

test("the previous PASETO public key keeps old access tokens valid", async () => {
  const user = await createTestUser("CASHIER");
  const [device] = await testSql`
    insert into devices (
      name, platform, enrolled_by_user_id, status, enrolled_at
    )
    values (
      ${`Paseto Device ${randomSuffix()}`}, 'ANDROID', ${user.id},
      'ACTIVE', now()
    )
    returning id`;

  const oldKey = createRawPasetoKey("old-key");
  const newKey = createRawPasetoKey("new-key");
  const oldService = createPasetoService({ active: oldKey });
  const token = oldService.signAccessToken(
    {
      sub: user.id,
      role: "CASHIER",
      deviceId: device.id,
      platform: "ANDROID",
    },
    new Date(),
  ).token;

  const newService = createPasetoService({
    active: newKey,
    previous: [{ kid: oldKey.kid, publicKey: oldKey.publicKey }],
  });
  const server = await startServer({ auth: { paseto: newService } });

  try {
    const me = await graphql(server, "{ me { id role } }", {
      headers: {
        authorization: `Bearer ${token}`,
        "x-client-platform": "ANDROID",
      },
    });
    assert.deepEqual(me.body.data?.me, {
      id: user.id,
      role: "CASHIER",
    });
  } finally {
    await server.close();
  }
});
