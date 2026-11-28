import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  type KeyObject,
  sign as cryptoSign,
} from "node:crypto";
import { createServer, type Server } from "node:http";
import { after, test } from "node:test";

import { createApp, type CreateAppOptions } from "../src/app.ts";
import {
  getPepper,
  hashPassword,
  loadPepperConfigFromEnv,
} from "../src/auth/passwords.ts";
import { canonicalJson, sha256Hex } from "../src/sync/canonical.ts";
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
  role: "OWNER" | "ADMIN" | "CASHIER" | "WAREHOUSE";
}

interface NativeSession {
  user: TestUser;
  deviceId: string;
  keyId: string;
  privateKey: KeyObject;
  accessToken: string;
  offlineToken: string;
  offlineExpiresAt: string;
  graceUntil: string;
}

interface GraphQLBody {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
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
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
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

async function createUser(role: TestUser["role"] = "OWNER"): Promise<TestUser> {
  const suffix = randomSuffix();
  const username = `offline-${suffix}`;
  const password = "offline-password";
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
      ${`Offline ${suffix}`}, ${username}, ${passwordHash},
      ${config.currentVersion}, ${role}
    )
    returning id`;
  return { id: row.id, username, password, role };
}

function newDeviceKey() {
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

function signDeviceCanonical(
  deviceId: string,
  keyId: string,
  privateKey: KeyObject,
  operation: string,
  nonce: string,
  clientTime: string,
  payloadHash: string,
): string {
  const canonical = [
    "v1",
    operation,
    deviceId,
    keyId,
    nonce,
    clientTime,
    payloadHash,
  ].join("\n");
  return `v1:${cryptoSign(
    null,
    Buffer.from(canonical, "utf8"),
    privateKey,
  ).toString("base64url")}`;
}

async function nonceFor(
  server: TestServer,
  deviceId: string,
  keyId: string,
): Promise<string> {
  const response = await fetch(`${server.baseUrl}/auth/nonce`, {
    headers: { "x-device-id": deviceId, "x-device-key-id": keyId },
  });
  assert.equal(response.status, 200);
  return ((await response.json()) as { nonce: string }).nonce;
}

async function signedDeviceHeaders(
  server: TestServer,
  session: Pick<NativeSession, "deviceId" | "keyId" | "privateKey">,
  operation: string,
  payload: string,
): Promise<Record<string, string>> {
  const nonce = await nonceFor(server, session.deviceId, session.keyId);
  const clientTime = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  return {
    "x-nonce": nonce,
    "x-client-time": clientTime,
    "x-device-signature": signDeviceCanonical(
      session.deviceId,
      session.keyId,
      session.privateKey,
      operation,
      nonce,
      clientTime,
      sha256Hex(payload),
    ),
  };
}

async function enrollAndLogin(
  server: TestServer,
  user: TestUser,
  platform: "TAURI" | "ANDROID" = "TAURI",
): Promise<NativeSession> {
  const key = newDeviceKey();
  const enroll = await graphql(
    server,
    `
      mutation ($input: EnrollDeviceInput!) {
        enrollDevice(input: $input) {
          device {
            id
          }
        }
      }
    `,
    {
      variables: {
        input: {
          username: user.username,
          password: user.password,
          name: `Offline ${randomSuffix()}`,
          platform,
          keyId: key.keyId,
          publicKey: key.publicKey,
        },
      },
    },
  );
  const deviceId = (
    enroll.body.data?.enrollDevice as { device: { id: string } }
  ).device.id;
  await testSql`
    update devices set status = 'ACTIVE', enrolled_at = now()
    where id = ${deviceId}`;

  return loginDevice(
    server,
    user,
    deviceId,
    key.keyId,
    key.privateKey,
    platform,
  );
}

async function loginDevice(
  server: TestServer,
  user: TestUser,
  deviceId: string,
  keyId: string,
  privateKey: KeyObject,
  platform: "TAURI" | "ANDROID" = "TAURI",
): Promise<NativeSession> {
  const nonce = await nonceFor(server, deviceId, keyId);
  const clientTime = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const login = await graphql(
    server,
    `
      mutation ($input: LoginInput!) {
        login(input: $input) {
          accessToken
          refreshToken
          offlineToken
          offlineExpiresAt
          graceUntil
          device {
            id
            status
            platform
          }
          user {
            id
            role
          }
          keySet {
            kid
            publicKey
          }
        }
      }
    `,
    {
      variables: {
        input: { username: user.username, password: user.password },
      },
      headers: {
        "x-client-platform": platform,
        "x-device-id": deviceId,
        "x-device-key-id": keyId,
        "x-nonce": nonce,
        "x-client-time": clientTime,
        "x-device-signature": signDeviceCanonical(
          deviceId,
          keyId,
          privateKey,
          "login",
          nonce,
          clientTime,
          sha256Hex(user.username),
        ),
      },
    },
  );
  assert.equal(login.body.errors, undefined, JSON.stringify(login.body));
  const payload = login.body.data?.login as {
    accessToken: string;
    offlineToken: string | null;
    offlineExpiresAt: string | null;
    graceUntil: string | null;
  };
  return {
    user,
    deviceId,
    keyId,
    privateKey,
    accessToken: payload.accessToken,
    offlineToken: payload.offlineToken ?? "",
    offlineExpiresAt: payload.offlineExpiresAt ?? "",
    graceUntil: payload.graceUntil ?? "",
  };
}

async function upgrade(
  server: TestServer,
  session: NativeSession,
  signatureHeaders?: Record<string, string>,
): Promise<{ response: Response; body: GraphQLBody }> {
  const headers =
    signatureHeaders ??
    (await signedDeviceHeaders(
      server,
      session,
      "upgradeOfflineSession",
      session.offlineToken,
    ));
  return graphql(
    server,
    `
      mutation ($input: UpgradeOfflineSessionInput!) {
        upgradeOfflineSession(input: $input) {
          accessToken
          refreshToken
          offlineToken
          offlineExpiresAt
          graceUntil
          device {
            id
            status
          }
          user {
            id
          }
        }
      }
    `,
    {
      variables: {
        input: {
          username: session.user.username,
          password: session.user.password,
        },
      },
      headers: {
        "x-client-platform": "TAURI",
        "x-device-id": session.deviceId,
        "x-device-key-id": session.keyId,
        "x-offline-token": session.offlineToken,
        ...headers,
      },
    },
  );
}

async function productFixture() {
  const suffix = randomSuffix();
  const [category] = await testSql`
    insert into categories (name) values (${`Category ${suffix}`})
    returning id`;
  const [product] = await testSql`
    insert into products (sku, name, category_id, base_unit, avg_cost)
    values (
      ${`SKU-${suffix}`}, ${`Product ${suffix}`}, ${category.id}, 'pcs', 0
    )
    returning id`;
  const [unit] = await testSql`
    insert into product_units (
      product_id, unit_name, conversion_qty, selling_price
    )
    values (${product.id}, 'pcs', 1, 10000)
    returning id`;
  return { productId: product.id, productUnitId: unit.id };
}

function makeOrder(input: {
  session: NativeSession;
  shiftId: string;
  cashierId: string;
  productId: string;
  productUnitId: string;
  clientCreatedAt?: Date;
  clientOrderId?: string;
  qty?: string;
  unitPrice?: string;
}): Record<string, unknown> {
  const qty = Number(input.qty ?? "2");
  const unitPrice = Number(input.unitPrice ?? "10000");
  const base: Record<string, unknown> = {
    clientOrderId: input.clientOrderId ?? crypto.randomUUID(),
    clientSeq: "1",
    clientCreatedAt: (input.clientCreatedAt ?? new Date())
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z"),
    shiftId: input.shiftId,
    items: [
      {
        productId: input.productId,
        productUnitId: input.productUnitId,
        qty: input.qty ?? "2",
        unitPrice: String(unitPrice),
      },
    ],
    payments: [
      {
        method: "CASH",
        amount: String(qty * unitPrice),
        cashReceived: String(qty * unitPrice),
      },
    ],
    signature: "",
  };
  const signingObject = { ...base, userId: input.cashierId } as Record<
    string,
    unknown
  >;
  delete signingObject.signature;
  const canonical = canonicalJson(signingObject);
  base.signature = `v1:${input.session.keyId}:${cryptoSign(
    null,
    Buffer.from(canonical, "utf8"),
    input.session.privateKey,
  ).toString("base64url")}`;
  return base;
}

function makeBatch(input: {
  shifts: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
}): Record<string, unknown> {
  const base = {
    clientBatchId: crypto.randomUUID(),
    shifts: input.shifts,
    orders: input.orders,
  };
  return { ...base, batchHash: sha256Hex(canonicalJson(base)) };
}

async function syncBatch(
  server: TestServer,
  session: NativeSession,
  input: Record<string, unknown>,
): Promise<{ response: Response; body: GraphQLBody }> {
  const batchHash = input.batchHash as string;
  const signatureHeaders = await signedDeviceHeaders(
    server,
    session,
    "syncOfflineBatch",
    batchHash,
  );
  return graphql(
    server,
    `
      mutation ($input: SyncOfflineBatchInput!) {
        syncOfflineBatch(input: $input) {
          batchId
          shifts {
            clientId
            status
            serverId
            code
            message
          }
          orders {
            clientId
            status
            serverId
            code
            message
          }
        }
      }
    `,
    {
      variables: { input },
      headers: {
        "x-client-platform": "TAURI",
        "x-device-id": session.deviceId,
        "x-device-key-id": session.keyId,
        ...signatureHeaders,
      },
    },
  );
}

function shiftInput(input: {
  id: string;
  userId: string;
  openedAtClient: Date;
  closedAtClient?: Date;
  openingCash?: string;
  expectedCash?: string;
  actualCash?: string;
}) {
  return {
    id: input.id,
    userId: input.userId,
    openingCash: input.openingCash ?? "100000",
    openedAtClient: input.openedAtClient
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z"),
    ...(input.closedAtClient
      ? {
          closedAtClient: input.closedAtClient
            .toISOString()
            .replace(/\.\d{3}Z$/, "Z"),
          expectedCash: input.expectedCash ?? "100000",
          actualCash: input.actualCash ?? "100000",
        }
      : {}),
  };
}

test("TAURI receives an offline token and upgrade rotates it", async () => {
  const owner = await createUser("OWNER");
  const server = await startServer();

  try {
    const session = await enrollAndLogin(server, owner, "TAURI");
    assert.ok(session.offlineToken.startsWith("v4.public."));
    assert.ok(Date.parse(session.offlineExpiresAt) > Date.now());
    assert.ok(
      Date.parse(session.graceUntil) > Date.parse(session.offlineExpiresAt),
    );

    const tokenBody = Buffer.from(
      session.offlineToken.split(".")[2] ?? "",
      "base64url",
    );
    const claims = JSON.parse(
      tokenBody.subarray(0, -64).toString("utf8"),
    ) as Record<string, unknown>;
    assert.equal(claims.typ, "offline");
    assert.equal(claims.sub, owner.id);
    assert.equal(claims.device_id, session.deviceId);
    assert.equal(claims.device_key_id, session.keyId);
    assert.deepEqual(claims.scope, [
      "sales:create",
      "catalog:read",
      "inventory:read",
    ]);
    assert.equal(claims.grace_until, session.graceUntil);
    assert.ok(String(claims.grace_until) > String(claims.exp));

    const [stored] = await testSql`
      select jti, device_id, issued_to_user_id, scope, rotated_at
      from offline_tokens
      where device_id = ${session.deviceId}
      order by issued_at desc limit 1`;
    assert.equal(stored.issued_to_user_id, owner.id);
    assert.deepEqual(stored.scope, [
      "sales:create",
      "catalog:read",
      "inventory:read",
    ]);
    assert.equal(stored.rotated_at, null);

    const upgraded = await upgrade(server, session);
    assert.equal(
      upgraded.body.errors,
      undefined,
      JSON.stringify(upgraded.body),
    );
    const upgradedPayload = upgraded.body.data?.upgradeOfflineSession as {
      accessToken: string;
      offlineToken: string;
      offlineExpiresAt: string;
      graceUntil: string;
    };
    assert.ok(upgradedPayload.accessToken);
    assert.ok(upgradedPayload.offlineToken.startsWith("v4.public."));
    assert.notEqual(upgradedPayload.offlineToken, session.offlineToken);

    const oldToken = await testSql`
      select rotated_at from offline_tokens where jti = ${stored.jti}`;
    assert.ok(oldToken[0]?.rotated_at instanceof Date);
    const [count] = await testSql`
      select count(*)::int as total from offline_tokens
      where device_id = ${session.deviceId}`;
    assert.equal(count.total, 2);

    const [audit] = await testSql`
      select event_type from audit_events
      where device_id = ${session.deviceId}
        and event_type in (
          'OFFLINE_TOKEN_ISSUED', 'OFFLINE_TOKEN_ROTATED',
          'OFFLINE_SESSION_UPGRADED'
        )
      order by event_type`;
    assert.ok(audit);

    const nextSession: NativeSession = {
      ...session,
      offlineToken: upgradedPayload.offlineToken,
    };

    await testSql`
      update offline_tokens
      set expires_at = now() - interval '1 hour',
          grace_until = now() + interval '1 day'
      where device_id = ${session.deviceId} and rotated_at is null`;
    const grace = await upgrade(server, nextSession);
    assert.equal(grace.body.errors, undefined, JSON.stringify(grace.body));
    const gracePayload = grace.body.data?.upgradeOfflineSession as {
      accessToken: string;
      offlineToken: string | null;
      offlineExpiresAt: string | null;
      graceUntil: string | null;
    };
    assert.ok(gracePayload.accessToken);
    assert.equal(gracePayload.offlineToken, null);
    assert.equal(gracePayload.offlineExpiresAt, null);
    assert.ok(Date.parse(gracePayload.graceUntil ?? "") > Date.now());
    const [graceToken] = await testSql`
      select rotated_at from offline_tokens
      where device_id = ${session.deviceId} and rotated_at is null`;
    assert.equal(graceToken?.rotated_at, null);

    await testSql`
      update offline_tokens
      set grace_until = now() - interval '1 hour'
      where device_id = ${session.deviceId} and rotated_at is null`;
    const graceExpired = await upgrade(server, nextSession);
    assert.equal(errorCode(graceExpired.body), "GRACE_EXPIRED");

    const revokedHeaders = await signedDeviceHeaders(
      server,
      nextSession,
      "upgradeOfflineSession",
      nextSession.offlineToken,
    );
    await testSql`
      update devices set status = 'REVOKED', revoked_at = now()
      where id = ${session.deviceId}`;
    const revoked = await upgrade(server, nextSession, revokedHeaders);
    assert.equal(errorCode(revoked.body), "DEVICE_REVOKED");
  } finally {
    await server.close();
  }
});

test("TAURI login rotates the previous offline token", async () => {
  const owner = await createUser("OWNER");
  const server = await startServer();

  try {
    const first = await enrollAndLogin(server, owner, "TAURI");
    const [before] = await testSql`
      select jti, rotated_at from offline_tokens
      where device_id = ${first.deviceId}
      order by issued_at desc limit 1`;
    assert.equal(before.rotated_at, null);

    const second = await loginDevice(
      server,
      owner,
      first.deviceId,
      first.keyId,
      first.privateKey,
      "TAURI",
    );
    assert.notEqual(second.offlineToken, first.offlineToken);

    const [rotated] = await testSql`
      select rotated_at from offline_tokens where jti = ${before.jti}`;
    assert.ok(rotated.rotated_at instanceof Date);
    const [active] = await testSql`
      select count(*)::int as total from offline_tokens
      where device_id = ${first.deviceId} and rotated_at is null`;
    assert.equal(active.total, 1);
  } finally {
    await server.close();
  }
});

test("sync processes shifts before orders and is idempotent per batch", async () => {
  const owner = await createUser("OWNER");
  const cashier = await createUser("CASHIER");
  const server = await startServer();

  try {
    const session = await enrollAndLogin(server, owner, "TAURI");
    const product = await productFixture();
    const shiftId = crypto.randomUUID();
    const openedAt = new Date();
    const shift = shiftInput({
      id: shiftId,
      userId: cashier.id,
      openedAtClient: openedAt,
    });
    const order = makeOrder({
      session,
      shiftId,
      cashierId: cashier.id,
      productId: product.productId,
      productUnitId: product.productUnitId,
      qty: "2",
    });
    const batch = makeBatch({ shifts: [shift], orders: [order] });

    const first = await syncBatch(server, session, batch);
    assert.equal(first.body.errors, undefined, JSON.stringify(first.body));
    const firstPayload = first.body.data?.syncOfflineBatch as {
      batchId: string;
      shifts: Array<{ status: string; serverId: string }>;
      orders: Array<{ status: string; serverId: string; code: string | null }>;
    };
    assert.equal(firstPayload.shifts[0]?.status, "ACCEPTED");
    assert.equal(firstPayload.orders[0]?.status, "ACCEPTED");

    const [sale] = await testSql`
      select
        id, source, user_id, device_id, signature_verified, client_order_id,
        sync_batch_id, price_variance
      from sales where id = ${firstPayload.orders[0]?.serverId}`;
    assert.equal(sale.source, "OFFLINE");
    assert.equal(sale.user_id, cashier.id);
    assert.equal(sale.device_id, session.deviceId);
    assert.equal(sale.signature_verified, true);
    assert.equal(sale.client_order_id, order.clientOrderId);
    assert.equal(sale.sync_batch_id, firstPayload.batchId);
    assert.equal(Number(sale.price_variance), 0);

    const [movement] = await testSql`
      select count(*)::int as total, sum(qty_change)::numeric(12,3) as qty
      from stock_movements
      where reference_type = 'SALE' and reference_id = ${sale.id}`;
    assert.equal(movement.total, 1);
    assert.equal(Number(movement.qty), -2);

    const second = await syncBatch(server, session, batch);
    assert.equal(second.body.errors, undefined, JSON.stringify(second.body));
    const secondPayload = second.body.data?.syncOfflineBatch as {
      batchId: string;
      shifts: Array<{ status: string }>;
      orders: Array<{ status: string }>;
    };
    assert.equal(secondPayload.batchId, firstPayload.batchId);
    assert.equal(secondPayload.shifts[0]?.status, "DUPLICATE");
    assert.equal(secondPayload.orders[0]?.status, "DUPLICATE");

    const [salesCount] = await testSql`
      select count(*)::int as total from sales where device_id = ${session.deviceId}`;
    const [movementCount] = await testSql`
      select count(*)::int as total from stock_movements
      where reference_type = 'SALE' and reference_id = ${sale.id}`;
    const [batchCount] = await testSql`
      select count(*)::int as total from sync_batches
      where device_id = ${session.deviceId}`;
    assert.equal(salesCount.total, 1);
    assert.equal(movementCount.total, 1);
    assert.equal(batchCount.total, 1);

    const originalClientBatchId = batch.clientBatchId as string;
    const conflictingBase = {
      clientBatchId: originalClientBatchId,
      shifts: [],
      orders: [],
    };
    const conflicting = await syncBatch(server, session, {
      ...conflictingBase,
      batchHash: sha256Hex(canonicalJson(conflictingBase)),
    });
    assert.equal(errorCode(conflicting.body), "CONFLICT");

    const duplicateOrderBatch = makeBatch({
      shifts: [shift],
      orders: [order],
    });
    const duplicate = await syncBatch(server, session, duplicateOrderBatch);
    const duplicatePayload = duplicate.body.data?.syncOfflineBatch as {
      batchId: string;
      orders: Array<{ status: string; code: string | null }>;
    };
    assert.notEqual(duplicatePayload.batchId, firstPayload.batchId);
    assert.equal(duplicatePayload.orders[0]?.status, "DUPLICATE");
    assert.equal(duplicatePayload.orders[0]?.code, "DUPLICATE_ORDER");

    const status = await graphql(
      server,
      `
        {
          syncStatus {
            serverTime
            deviceStatus
            offlineExpiresAt
            graceUntil
            lastSyncAt
            lastBatch {
              id
              acceptedCount
              flaggedCount
              rejectedCount
            }
          }
        }
      `,
      {
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          "x-client-platform": "TAURI",
        },
      },
    );
    assert.equal(status.body.errors, undefined, JSON.stringify(status.body));
    const syncStatus = status.body.data?.syncStatus as {
      deviceStatus: string;
      offlineExpiresAt: string;
      lastBatch: { id: string };
    };
    assert.equal(syncStatus.deviceStatus, "ACTIVE");
    assert.ok(syncStatus.offlineExpiresAt);
    assert.equal(syncStatus.lastBatch.id, duplicatePayload.batchId);
  } finally {
    await server.close();
  }
});

test("grace orders are accepted as FLAGGED and audited", async () => {
  const owner = await createUser("OWNER");
  const cashier = await createUser("CASHIER");
  const server = await startServer();

  try {
    const session = await enrollAndLogin(server, owner, "TAURI");
    const product = await productFixture();
    await testSql`
      update offline_tokens
      set expires_at = now() - interval '1 hour',
          grace_until = now() + interval '1 day'
      where device_id = ${session.deviceId} and rotated_at is null`;

    const shiftId = crypto.randomUUID();
    const clientCreatedAt = new Date(Date.now() - 30 * 60 * 1000);
    const shift = shiftInput({
      id: shiftId,
      userId: cashier.id,
      openedAtClient: new Date(Date.now() - 40 * 60 * 1000),
    });
    const order = makeOrder({
      session,
      shiftId,
      cashierId: cashier.id,
      productId: product.productId,
      productUnitId: product.productUnitId,
      clientCreatedAt,
    });
    const batch = makeBatch({ shifts: [shift], orders: [order] });
    const renewed = await loginDevice(
      server,
      owner,
      session.deviceId,
      session.keyId,
      session.privateKey,
      "TAURI",
    );
    assert.notEqual(renewed.offlineToken, session.offlineToken);

    const result = await syncBatch(server, renewed, batch);
    assert.equal(result.body.errors, undefined, JSON.stringify(result.body));
    const payload = result.body.data?.syncOfflineBatch as {
      orders: Array<{ status: string; code: string | null; serverId: string }>;
    };
    assert.equal(payload.orders[0]?.status, "FLAGGED");
    assert.equal(payload.orders[0]?.code, "ORDER_FLAGGED");

    const [sale] = await testSql`
      select source from sales where id = ${payload.orders[0]?.serverId}`;
    assert.equal(sale.source, "GRACE");

    const [event] = await testSql`
      select type from device_events
      where device_id = ${session.deviceId}
        and type = 'GRACE_ORDER_FLAGGED'`;
    assert.ok(event);
  } finally {
    await server.close();
  }
});

test("price variance is recorded and flagged for review", async () => {
  const owner = await createUser("OWNER");
  const cashier = await createUser("CASHIER");
  const server = await startServer();

  try {
    const session = await enrollAndLogin(server, owner, "TAURI");
    const product = await productFixture();
    const shiftId = crypto.randomUUID();
    const shift = shiftInput({
      id: shiftId,
      userId: cashier.id,
      openedAtClient: new Date(Date.now() - 10 * 60 * 1000),
    });
    const order = makeOrder({
      session,
      shiftId,
      cashierId: cashier.id,
      productId: product.productId,
      productUnitId: product.productUnitId,
      qty: "2",
      unitPrice: "9000",
    });
    const batch = makeBatch({ shifts: [shift], orders: [order] });
    const result = await syncBatch(server, session, batch);
    assert.equal(result.body.errors, undefined, JSON.stringify(result.body));
    const payload = result.body.data?.syncOfflineBatch as {
      orders: Array<{ status: string; code: string | null; serverId: string }>;
    };
    assert.equal(payload.orders[0]?.status, "FLAGGED");
    assert.equal(payload.orders[0]?.code, "ORDER_FLAGGED");

    const [sale] = await testSql`
      select source, price_variance, sync_batch_id
      from sales where id = ${payload.orders[0]?.serverId}`;
    assert.equal(sale.source, "OFFLINE");
    assert.equal(Number(sale.price_variance), -2000);
    assert.ok(sale.sync_batch_id);

    const [event] = await testSql`
      select metadata from device_events
      where device_id = ${session.deviceId} and type = 'ORDER_FLAGGED'
      order by created_at desc limit 1`;
    assert.deepEqual(event?.metadata.reasons, ["PRICE_VARIANCE"]);
  } finally {
    await server.close();
  }
});

test("bad order signatures reject only that item and quarantine it", async () => {
  const owner = await createUser("OWNER");
  const cashier = await createUser("CASHIER");
  const server = await startServer();

  try {
    const session = await enrollAndLogin(server, owner, "TAURI");
    const product = await productFixture();
    const shiftId = crypto.randomUUID();
    const shift = shiftInput({
      id: shiftId,
      userId: cashier.id,
      openedAtClient: new Date(),
    });
    const validOrder = makeOrder({
      session,
      shiftId,
      cashierId: cashier.id,
      productId: product.productId,
      productUnitId: product.productUnitId,
      qty: "1",
    });
    const badOrder = makeOrder({
      session,
      shiftId,
      cashierId: cashier.id,
      productId: product.productId,
      productUnitId: product.productUnitId,
      qty: "1",
    });
    const [version, keyId, encoded] = String(badOrder.signature).split(":");
    assert.ok(version && keyId && encoded);
    badOrder.signature = `${version}:${keyId}:${
      encoded[0] === "A" ? "B" : "A"
    }${encoded.slice(1)}`;
    const batch = makeBatch({
      shifts: [shift],
      orders: [validOrder, badOrder],
    });
    const result = await syncBatch(server, session, batch);
    assert.equal(result.body.errors, undefined, JSON.stringify(result.body));
    const payload = result.body.data?.syncOfflineBatch as {
      shifts: Array<{ status: string }>;
      orders: Array<{
        status: string;
        code: string | null;
        clientId: string;
        serverId: string | null;
      }>;
    };
    assert.equal(payload.shifts[0]?.status, "ACCEPTED");
    assert.equal(payload.orders[0]?.status, "ACCEPTED");
    assert.equal(payload.orders[1]?.status, "REJECTED");
    assert.equal(payload.orders[1]?.code, "INVALID_SIGNATURE");
    assert.equal(payload.orders[1]?.serverId, null);

    const [salesCount] = await testSql`
      select count(*)::int as total from sales
      where device_id = ${session.deviceId}`;
    assert.equal(salesCount.total, 1);
    const [quarantine] = await testSql`
      select type, metadata from device_events
      where device_id = ${session.deviceId} and type = 'SYNC_QUARANTINE'
      order by created_at desc limit 1`;
    assert.ok(quarantine);
    assert.equal(
      quarantine.metadata.clientOrderId,
      payload.orders[1]?.clientId,
    );

    const mismatchBatch = makeBatch({ shifts: [], orders: [] });
    mismatchBatch.batchHash = "0".repeat(64);
    const mismatch = await syncBatch(server, session, mismatchBatch);
    assert.equal(errorCode(mismatch.body), "INVALID_SIGNATURE");
  } finally {
    await server.close();
  }
});

test("batch size above the maximum returns QUEUE_LIMIT", async () => {
  const server = await startServer();

  try {
    const fakeOrders = Array.from({ length: 101 }, () => ({
      clientOrderId: crypto.randomUUID(),
      clientSeq: "1",
      clientCreatedAt: new Date().toISOString(),
      shiftId: crypto.randomUUID(),
      items: [
        {
          productId: crypto.randomUUID(),
          productUnitId: crypto.randomUUID(),
          qty: "1",
          unitPrice: "1000",
        },
      ],
      payments: [{ method: "CASH", amount: "1000", cashReceived: "1000" }],
      signature: "v1:bad:bad",
    }));
    const result = await graphql(
      server,
      `
        mutation ($input: SyncOfflineBatchInput!) {
          syncOfflineBatch(input: $input) {
            batchId
          }
        }
      `,
      {
        variables: {
          input: {
            clientBatchId: crypto.randomUUID(),
            batchHash: "0".repeat(64),
            shifts: [],
            orders: fakeOrders,
          },
        },
        headers: { "x-client-platform": "TAURI" },
      },
    );
    assert.equal(errorCode(result.body), "QUEUE_LIMIT");
  } finally {
    await server.close();
  }
});
