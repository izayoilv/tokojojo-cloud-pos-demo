import assert from "node:assert/strict";
import {
  createHash,
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
import { CSRF_COOKIE } from "../src/auth/tokens.ts";
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

interface WebAuth {
  user: TestUser;
  headers: Record<string, string>;
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
  const username = `phase4-${suffix}`;
  const password = "phase4-password";
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
      ${`Phase4 ${suffix}`}, ${username}, ${passwordHash},
      ${config.currentVersion}, ${role}
    )
    returning id`;
  return { id: row.id, username, password, role };
}

async function webLogin(server: TestServer, user: TestUser): Promise<WebAuth> {
  const result = await graphql(
    server,
    `
      mutation Login($input: LoginInput!) {
        login(input: $input) {
          user {
            id
          }
        }
      }
    `,
    {
      variables: {
        input: { username: user.username, password: user.password },
      },
      headers: { "x-client-platform": "WEB" },
    },
  );
  assert.equal(result.body.errors, undefined);
  const cookies = result.response.headers.getSetCookie();
  const cookie = cookies
    .filter((value) => !value.includes("Max-Age=0"))
    .map((value) => value.split(";")[0])
    .join("; ");
  const csrf = decodeURIComponent(
    cookies
      .find((value) => value.startsWith(`${CSRF_COOKIE}=`))!
      .slice(CSRF_COOKIE.length + 1)
      .split(";")[0] ?? "",
  );
  return { user, headers: { cookie, "x-csrf-token": csrf } };
}

async function createProduct(auth: WebAuth, server: TestServer) {
  const suffix = randomSuffix();
  const category = await graphql(
    server,
    `
      mutation ($input: CategoryInput!) {
        createCategory(input: $input) {
          id
        }
      }
    `,
    {
      variables: { input: { name: `Category ${suffix}` } },
      headers: auth.headers,
    },
  );
  const categoryId = (category.body.data?.createCategory as { id: string }).id;
  const result = await graphql(
    server,
    `
      mutation ($input: CreateProductInput!) {
        createProduct(input: $input) {
          id
          name
          units {
            id
            unitName
            conversionQty
            sellingPrice
          }
        }
      }
    `,
    {
      variables: {
        input: {
          sku: `SKU-${suffix}`,
          name: `Product ${suffix}`,
          categoryId,
          baseUnit: "pcs",
          units: [
            { unitName: "pcs", conversionQty: "1", sellingPrice: "10000" },
            { unitName: "dus", conversionQty: "12", sellingPrice: "120000" },
          ],
        },
      },
      headers: auth.headers,
    },
  );
  assert.equal(result.body.errors, undefined, JSON.stringify(result.body));
  return result.body.data?.createProduct as {
    id: string;
    name: string;
    units: Array<{ id: string; unitName: string }>;
  };
}

function unit(
  product: { units: Array<{ id: string; unitName: string }> },
  name: string,
) {
  const value = product.units.find((item) => item.unitName === name);
  assert.ok(value);
  return value;
}

async function createCustomer(auth: WebAuth, server: TestServer) {
  const result = await graphql(
    server,
    `
      mutation ($input: CustomerInput!) {
        createCustomer(input: $input) {
          id
          name
        }
      }
    `,
    {
      variables: { input: { name: `Customer ${randomSuffix()}` } },
      headers: auth.headers,
    },
  );
  assert.equal(result.body.errors, undefined);
  return result.body.data?.createCustomer as { id: string; name: string };
}

async function openShift(
  auth: WebAuth,
  server: TestServer,
  options: {
    userId?: string;
    openingCash?: string;
    id?: string;
    openedAtClient?: string;
  } = {},
) {
  const result = await graphql(
    server,
    `
      mutation ($input: OpenShiftInput!) {
        openShift(input: $input) {
          id
          status
          userId
          openingCash
          expectedCash
          actualCash
          source
        }
      }
    `,
    {
      variables: {
        input: {
          userId: options.userId,
          openingCash: options.openingCash ?? "100000",
          id: options.id,
          openedAtClient: options.openedAtClient,
        },
      },
      headers: auth.headers,
    },
  );
  assert.equal(result.body.errors, undefined, JSON.stringify(result.body));
  return result.body.data?.openShift as {
    id: string;
    status: string;
    userId: string;
    expectedCash: string | null;
    actualCash: string | null;
    source: string;
  };
}

const SALE_MUTATION = `
  mutation($input: CreateSaleInput!) {
    createSale(input: $input) {
      duplicate
      sale {
        id invoiceNo shiftId subtotal discount totalAmount
        settlementMethod paid outstanding paymentStatus status
        deviceId clientOrderId source
        user { id }
        customer { id }
        items { id qty qtyBase unitPrice discount unitCost subtotal }
        payments { id method amount cashReceived change shiftId }
        returns { id totalRefund cashRefund refundMethod }
      }
    }
  }
`;

async function createSale(
  server: TestServer,
  headers: Record<string, string>,
  input: Record<string, unknown>,
) {
  return graphql(server, SALE_MUTATION, { variables: { input }, headers });
}

function createDeviceKey() {
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

function signDevice(
  deviceId: string,
  keyId: string,
  privateKey: KeyObject,
  operation: string,
  nonce: string,
  clientTime: Date,
  payload: string,
) {
  const hash = createHash("sha256").update(payload, "utf8").digest("hex");
  const time = clientTime.toISOString().replace(/\.\d{3}Z$/, "Z");
  const canonical = ["v1", operation, deviceId, keyId, nonce, time, hash].join(
    "\n",
  );
  return {
    "x-nonce": nonce,
    "x-client-time": time,
    "x-device-signature": `v1:${cryptoSign(
      null,
      Buffer.from(canonical, "utf8"),
      privateKey,
    ).toString("base64url")}`,
  };
}

async function nativeHeaders(
  server: TestServer,
  user: TestUser,
): Promise<{ headers: Record<string, string>; deviceId: string }> {
  const key = createDeviceKey();
  const enrollment = await graphql(
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
          name: `Device ${randomSuffix()}`,
          platform: "ANDROID",
          keyId: key.keyId,
          publicKey: key.publicKey,
        },
      },
    },
  );
  const deviceId = (
    enrollment.body.data?.enrollDevice as { device: { id: string } }
  ).device.id;
  await testSql`
    update devices set status = 'ACTIVE', enrolled_at = now()
    where id = ${deviceId}`;
  const nonceResponse = await fetch(`${server.baseUrl}/auth/nonce`, {
    headers: { "x-device-id": deviceId, "x-device-key-id": key.keyId },
  });
  const nonce = ((await nonceResponse.json()) as { nonce: string }).nonce;
  const login = await graphql(
    server,
    `
      mutation ($input: LoginInput!) {
        login(input: $input) {
          accessToken
        }
      }
    `,
    {
      variables: {
        input: { username: user.username, password: user.password },
      },
      headers: {
        "x-client-platform": "ANDROID",
        "x-device-id": deviceId,
        "x-device-key-id": key.keyId,
        ...signDevice(
          deviceId,
          key.keyId,
          key.privateKey,
          "login",
          nonce,
          new Date(),
          user.username,
        ),
      },
    },
  );
  const accessToken = (login.body.data?.login as { accessToken: string })
    .accessToken;
  return {
    headers: {
      authorization: `Bearer ${accessToken}`,
      "x-client-platform": "ANDROID",
    },
    deviceId,
  };
}

test("shift lifecycle enforces one open shift, close rules, and cash derivation", async () => {
  const owner = await createUser("OWNER");
  const cashier = await createUser("CASHIER");
  const server = await startServer();

  try {
    const ownerAuth = await webLogin(server, owner);
    const cashierAuth = await webLogin(server, cashier);
    const product = await createProduct(ownerAuth, server);

    const shift = await openShift(cashierAuth, server, {
      openingCash: "100000",
    });
    assert.equal(shift.status, "OPEN");
    assert.equal(shift.userId, cashier.id);

    const duplicate = await graphql(
      server,
      `
        mutation ($input: OpenShiftInput!) {
          openShift(input: $input) {
            id
          }
        }
      `,
      {
        variables: { input: { openingCash: "100000" } },
        headers: cashierAuth.headers,
      },
    );
    assert.equal(errorCode(duplicate.body), "CONFLICT");

    const missingShift = await createSale(server, cashierAuth.headers, {
      shiftId: crypto.randomUUID(),
      items: [
        {
          productId: product.id,
          productUnitId: unit(product, "pcs").id,
          qty: "1",
          unitPrice: "10000",
        },
      ],
      payments: [{ method: "CASH", amount: "10000", cashReceived: "10000" }],
    });
    assert.equal(errorCode(missingShift.body), "SHIFT_NOT_FOUND");

    const sale = await createSale(server, cashierAuth.headers, {
      shiftId: shift.id,
      items: [
        {
          productId: product.id,
          productUnitId: unit(product, "pcs").id,
          qty: "1",
          unitPrice: "10000",
        },
      ],
      payments: [{ method: "CASH", amount: "10000", cashReceived: "10000" }],
    });
    assert.equal(sale.body.errors, undefined, JSON.stringify(sale.body));

    const badClose = await graphql(
      server,
      `
        mutation ($input: CloseShiftInput!) {
          closeShift(input: $input) {
            id
          }
        }
      `,
      {
        variables: { input: { shiftId: shift.id, actualCash: "-1" } },
        headers: cashierAuth.headers,
      },
    );
    assert.equal(errorCode(badClose.body), "VALIDATION_FAILED");

    const closed = await graphql(
      server,
      `
        mutation ($input: CloseShiftInput!) {
          closeShift(input: $input) {
            id
            status
            expectedCash
            actualCash
            closedAt
          }
        }
      `,
      {
        variables: { input: { shiftId: shift.id, actualCash: "110000" } },
        headers: ownerAuth.headers,
      },
    );
    assert.equal(closed.body.errors, undefined, JSON.stringify(closed.body));
    const closedShift = closed.body.data?.closeShift as {
      status: string;
      expectedCash: string;
      actualCash: string;
    };
    assert.equal(closedShift.status, "CLOSED");
    assert.equal(closedShift.expectedCash, "110000");
    assert.equal(closedShift.actualCash, "110000");

    const closeAgain = await graphql(
      server,
      `
        mutation ($input: CloseShiftInput!) {
          closeShift(input: $input) {
            id
          }
        }
      `,
      {
        variables: { input: { shiftId: shift.id, actualCash: "110000" } },
        headers: cashierAuth.headers,
      },
    );
    assert.equal(errorCode(closeAgain.body), "SHIFT_CLOSED");

    const saleOnClosedShift = await createSale(server, cashierAuth.headers, {
      shiftId: shift.id,
      items: [
        {
          productId: product.id,
          productUnitId: unit(product, "pcs").id,
          qty: "1",
          unitPrice: "10000",
        },
      ],
      payments: [{ method: "CASH", amount: "10000", cashReceived: "10000" }],
    });
    assert.equal(errorCode(saleOnClosedShift.body), "SHIFT_CLOSED");

    const current = await graphql(
      server,
      `
        query ($userId: ID) {
          currentShift(userId: $userId) {
            id
          }
        }
      `,
      { variables: { userId: cashier.id }, headers: cashierAuth.headers },
    );
    assert.equal(current.body.data?.currentShift, null);

    const [device] = await testSql`
      insert into devices (
        name, platform, enrolled_by_user_id, status, enrolled_at
      )
      values (
        ${`Offline ${randomSuffix()}`}, 'ANDROID', ${cashier.id},
        'ACTIVE', now()
      )
      returning id`;
    const [offlineShift] = await testSql`
      insert into cashier_shifts (
        user_id, status, opening_cash, device_id, source, opened_at_client
      )
      values (
        ${cashier.id}, 'OPEN', 0, ${device.id}, 'OFFLINE', now()
      )
      returning id`;
    const offlineClose = await graphql(
      server,
      `
        mutation ($input: CloseShiftInput!) {
          closeShift(input: $input) {
            id
          }
        }
      `,
      {
        variables: { input: { shiftId: offlineShift.id, actualCash: "0" } },
        headers: cashierAuth.headers,
      },
    );
    assert.equal(errorCode(offlineClose.body), "INVALID_SHIFT");
  } finally {
    await server.close();
  }
});

test("sales support cash, partial DEBT, idempotency, discounts, and void rules", async () => {
  const owner = await createUser("OWNER");
  const cashier = await createUser("CASHIER");
  const server = await startServer();

  try {
    const ownerAuth = await webLogin(server, owner);
    const cashierAuth = await webLogin(server, cashier);
    const product = await createProduct(ownerAuth, server);
    const customer = await createCustomer(cashierAuth, server);
    const ownerShift = await openShift(ownerAuth, server, {
      openingCash: "500000",
    });
    const cashierShift = await openShift(cashierAuth, server, {
      openingCash: "0",
    });

    const cashSale = await createSale(server, ownerAuth.headers, {
      shiftId: ownerShift.id,
      items: [
        {
          productId: product.id,
          productUnitId: unit(product, "dus").id,
          qty: "2",
          unitPrice: "120000",
        },
      ],
      payments: [{ method: "CASH", amount: "240000", cashReceived: "250000" }],
    });
    assert.equal(
      cashSale.body.errors,
      undefined,
      JSON.stringify(cashSale.body),
    );
    const cashPayload = cashSale.body.data?.createSale as {
      duplicate: boolean;
      sale: {
        id: string;
        subtotal: string;
        totalAmount: string;
        settlementMethod: string;
        paid: string;
        outstanding: string;
        paymentStatus: string;
        payments: Array<{ change: string; shiftId: string }>;
        items: Array<{ qtyBase: string }>;
      };
    };
    assert.equal(cashPayload.duplicate, false);
    assert.equal(cashPayload.sale.totalAmount, "240000");
    assert.equal(cashPayload.sale.settlementMethod, "CASH");
    assert.equal(cashPayload.sale.paid, "240000");
    assert.equal(cashPayload.sale.outstanding, "0");
    assert.equal(cashPayload.sale.paymentStatus, "PAID");
    assert.equal(cashPayload.sale.items[0]?.qtyBase, "24.000");
    assert.equal(cashPayload.sale.payments[0]?.change, "10000");
    assert.equal(cashPayload.sale.payments[0]?.shiftId, ownerShift.id);

    const partialDebt = await createSale(server, cashierAuth.headers, {
      shiftId: cashierShift.id,
      customerId: customer.id,
      items: [
        {
          productId: product.id,
          productUnitId: unit(product, "pcs").id,
          qty: "3",
          unitPrice: "10000",
        },
      ],
      payments: [{ method: "CASH", amount: "10000", cashReceived: "10000" }],
    });
    const partial = (
      partialDebt.body.data?.createSale as {
        sale: {
          settlementMethod: string;
          paid: string;
          outstanding: string;
          paymentStatus: string;
          customer: { id: string };
        };
      }
    ).sale;
    assert.equal(partial.settlementMethod, "DEBT");
    assert.equal(partial.paid, "10000");
    assert.equal(partial.outstanding, "20000");
    assert.equal(partial.paymentStatus, "PARTIAL");
    assert.equal(partial.customer.id, customer.id);

    const unpaidDebt = await createSale(server, cashierAuth.headers, {
      shiftId: cashierShift.id,
      customerId: customer.id,
      items: [
        {
          productId: product.id,
          productUnitId: unit(product, "pcs").id,
          qty: "1",
          unitPrice: "10000",
        },
      ],
      payments: [],
    });
    const unpaidSaleId = (
      unpaidDebt.body.data?.createSale as {
        sale: { id: string; settlementMethod: string; paymentStatus: string };
      }
    ).sale;
    assert.equal(unpaidSaleId.settlementMethod, "DEBT");
    assert.equal(unpaidSaleId.paymentStatus, "UNPAID");

    const voided = await graphql(
      server,
      `
        mutation ($id: ID!, $reason: String!) {
          voidSale(id: $id, reason: $reason) {
            id
            status
            voidedAt
            voidedBy {
              id
            }
            voidReason
          }
        }
      `,
      {
        variables: { id: unpaidSaleId.id, reason: "unpaid cancellation" },
        headers: ownerAuth.headers,
      },
    );
    assert.equal(voided.body.errors, undefined, JSON.stringify(voided.body));
    assert.equal(
      (voided.body.data?.voidSale as { status: string }).status,
      "VOIDED",
    );
    const [voidMovement] = await testSql`
      select qty_change, movement_type, reference_type
      from stock_movements
      where reference_id = ${unpaidSaleId.id}
      order by created_at desc limit 1`;
    assert.equal(voidMovement.movement_type, "SALE_VOID");
    assert.equal(Number(voidMovement.qty_change), 1);
    assert.equal(voidMovement.reference_type, "SALE");

    const voidPaid = await graphql(
      server,
      `
        mutation ($id: ID!, $reason: String!) {
          voidSale(id: $id, reason: $reason) {
            id
          }
        }
      `,
      {
        variables: { id: cashPayload.sale.id, reason: "should fail" },
        headers: ownerAuth.headers,
      },
    );
    assert.equal(errorCode(voidPaid.body), "CONFLICT");

    const salesPage = await graphql(
      server,
      `query($customerId: ID!) {
        sales(
          filter: { customerId: $customerId }
          page: { page: 1, pageSize: 10 }
          sort: { field: "createdAt", direction: DESC }
        ) {
          items { id settlementMethod paymentStatus }
          pageInfo { total }
        }
        receivables(
          filter: { customerId: $customerId }
          page: { page: 1, pageSize: 10 }
        ) {
          items { invoiceNo outstanding paymentStatus }
          pageInfo { total }
        }
        shifts(
          filter: { userId: "${cashier.id}" }
          page: { page: 1, pageSize: 10 }
        ) {
          items { id status }
          pageInfo { total }
        }
      }`,
      { variables: { customerId: customer.id }, headers: ownerAuth.headers },
    );
    assert.equal(
      salesPage.body.errors,
      undefined,
      JSON.stringify(salesPage.body),
    );
    const receivablePage = salesPage.body.data?.receivables as {
      items: Array<{ outstanding: string }>;
    };
    assert.ok(
      receivablePage.items.some((item) => item.outstanding === "20000"),
    );

    const cashierDiscount = await createSale(server, cashierAuth.headers, {
      shiftId: cashierShift.id,
      items: [
        {
          productId: product.id,
          productUnitId: unit(product, "pcs").id,
          qty: "1",
          unitPrice: "10000",
          discount: "1000",
        },
      ],
      payments: [{ method: "CASH", amount: "9000", cashReceived: "9000" }],
    });
    assert.equal(errorCode(cashierDiscount.body), "FORBIDDEN");

    const ownerDiscount = await createSale(server, ownerAuth.headers, {
      shiftId: ownerShift.id,
      items: [
        {
          productId: product.id,
          productUnitId: unit(product, "pcs").id,
          qty: "3",
          unitPrice: "10000",
          discount: "1000",
        },
      ],
      payments: [{ method: "CASH", amount: "27000", cashReceived: "27000" }],
    });
    assert.equal(ownerDiscount.body.errors, undefined);
    const discounted = (
      ownerDiscount.body.data?.createSale as {
        sale: { subtotal: string; discount: string; totalAmount: string };
      }
    ).sale;
    assert.equal(discounted.subtotal, "30000");
    assert.equal(discounted.discount, "3000");
    assert.equal(discounted.totalAmount, "27000");

    const { headers: native } = await nativeHeaders(server, owner);
    const clientOrderId = crypto.randomUUID();
    const nativeInput = {
      shiftId: ownerShift.id,
      clientOrderId,
      clientSeq: "1",
      clientCreatedAt: new Date().toISOString(),
      items: [
        {
          productId: product.id,
          productUnitId: unit(product, "pcs").id,
          qty: "2",
          unitPrice: "10000",
        },
      ],
      payments: [{ method: "QRIS", amount: "20000" }],
    };
    const first = await createSale(server, native, nativeInput);
    assert.equal(first.body.errors, undefined, JSON.stringify(first.body));
    const firstSale = first.body.data?.createSale as {
      duplicate: boolean;
      sale: { id: string; deviceId: string; clientOrderId: string };
    };
    assert.equal(firstSale.duplicate, false);
    assert.ok(firstSale.sale.deviceId);
    assert.equal(firstSale.sale.clientOrderId, clientOrderId);

    const second = await createSale(server, native, nativeInput);
    const secondSale = second.body.data?.createSale as {
      duplicate: boolean;
      sale: { id: string };
    };
    assert.equal(secondSale.duplicate, true);
    assert.equal(secondSale.sale.id, firstSale.sale.id);
    const [count] = await testSql`
      select count(*)::int as total from sales
      where device_id = ${firstSale.sale.deviceId}
        and client_order_id = ${clientOrderId}`;
    assert.equal(count.total, 1);
    const [movementCount] = await testSql`
      select count(*)::int as total from stock_movements
      where reference_type = 'SALE' and reference_id = ${firstSale.sale.id}`;
    assert.equal(movementCount.total, 1);
  } finally {
    await server.close();
  }
});

test("returns reduce net total before refunding cash and enforce caps", async () => {
  const owner = await createUser("OWNER");
  const cashier = await createUser("CASHIER");
  const server = await startServer();

  try {
    const ownerAuth = await webLogin(server, owner);
    const cashierAuth = await webLogin(server, cashier);
    const product = await createProduct(ownerAuth, server);
    const customer = await createCustomer(cashierAuth, server);
    const shift = await openShift(ownerAuth, server, {
      openingCash: "100000",
    });

    const paidSale = await createSale(server, ownerAuth.headers, {
      shiftId: shift.id,
      items: [
        {
          productId: product.id,
          productUnitId: unit(product, "pcs").id,
          qty: "10",
          unitPrice: "10000",
        },
      ],
      payments: [{ method: "CASH", amount: "100000", cashReceived: "100000" }],
    });
    const paidSaleData = (
      paidSale.body.data?.createSale as {
        sale: { id: string; items: Array<{ id: string; qtyBase: string }> };
      }
    ).sale;

    const partialReturn = await graphql(
      server,
      `
        mutation ($input: CreateSaleReturnInput!) {
          createSaleReturn(input: $input) {
            id
            returnNo
            totalRefund
            cashRefund
            refundMethod
            shiftId
            items {
              qty
              qtyBase
              refundAmount
            }
          }
        }
      `,
      {
        variables: {
          input: {
            saleId: paidSaleData.id,
            reason: "damaged",
            items: [{ saleItemId: paidSaleData.items[0]!.id, qty: "3" }],
            refundMethod: "CASH",
          },
        },
        headers: ownerAuth.headers,
      },
    );
    assert.equal(
      partialReturn.body.errors,
      undefined,
      JSON.stringify(partialReturn.body),
    );
    const partialReturnData = partialReturn.body.data?.createSaleReturn as {
      id: string;
      totalRefund: string;
      cashRefund: string;
      refundMethod: string;
      shiftId: string;
      items: Array<{ qtyBase: string; refundAmount: string }>;
    };
    assert.equal(partialReturnData.totalRefund, "30000");
    assert.equal(partialReturnData.cashRefund, "30000");
    assert.equal(partialReturnData.refundMethod, "CASH");
    assert.equal(partialReturnData.shiftId, shift.id);
    assert.equal(partialReturnData.items[0]?.qtyBase, "3.000");
    assert.equal(partialReturnData.items[0]?.refundAmount, "30000");

    const saleAfter = await graphql(
      server,
      `
        query ($id: ID!) {
          sale(id: $id) {
            totalAmount
            paid
            outstanding
            paymentStatus
            returns {
              id
              totalRefund
              cashRefund
            }
          }
        }
      `,
      { variables: { id: paidSaleData.id }, headers: ownerAuth.headers },
    );
    const afterReturn = saleAfter.body.data?.sale as {
      paid: string;
      outstanding: string;
      paymentStatus: string;
      returns: Array<{ totalRefund: string; cashRefund: string }>;
    };
    assert.equal(afterReturn.paid, "100000");
    assert.equal(afterReturn.outstanding, "0");
    assert.equal(afterReturn.paymentStatus, "PAID");
    assert.equal(afterReturn.returns[0]?.cashRefund, "30000");

    const [refundFlow] = await testSql`
      select type, category, amount, shift_id, source
      from cash_flows
      where reference_type = 'SALE_RETURN' and reference_id = ${partialReturnData.id}`;
    assert.equal(refundFlow.type, "OUT");
    assert.equal(refundFlow.category, "REFUND");
    assert.equal(Number(refundFlow.amount), 30000);
    assert.equal(refundFlow.shift_id, shift.id);
    assert.equal(refundFlow.source, "AUTO");

    const tooMany = await graphql(
      server,
      `
        mutation ($input: CreateSaleReturnInput!) {
          createSaleReturn(input: $input) {
            id
          }
        }
      `,
      {
        variables: {
          input: {
            saleId: paidSaleData.id,
            reason: "too many",
            items: [{ saleItemId: paidSaleData.items[0]!.id, qty: "8" }],
            refundMethod: "CASH",
          },
        },
        headers: ownerAuth.headers,
      },
    );
    assert.equal(errorCode(tooMany.body), "VALIDATION_FAILED");

    const cashierReturn = await graphql(
      server,
      `
        mutation ($input: CreateSaleReturnInput!) {
          createSaleReturn(input: $input) {
            id
          }
        }
      `,
      {
        variables: {
          input: {
            saleId: paidSaleData.id,
            reason: "denied",
            items: [{ saleItemId: paidSaleData.items[0]!.id, qty: "1" }],
            refundMethod: "CASH",
          },
        },
        headers: cashierAuth.headers,
      },
    );
    assert.equal(errorCode(cashierReturn.body), "FORBIDDEN");

    const debtSale = await createSale(server, ownerAuth.headers, {
      shiftId: shift.id,
      customerId: customer.id,
      items: [
        {
          productId: product.id,
          productUnitId: unit(product, "pcs").id,
          qty: "10",
          unitPrice: "10000",
        },
      ],
      payments: [{ method: "CASH", amount: "40000", cashReceived: "40000" }],
    });
    const debtSaleData = (
      debtSale.body.data?.createSale as {
        sale: { id: string; items: Array<{ id: string }> };
      }
    ).sale;
    const debtReturn = await graphql(
      server,
      `
        mutation ($input: CreateSaleReturnInput!) {
          createSaleReturn(input: $input) {
            totalRefund
            cashRefund
            refundMethod
          }
        }
      `,
      {
        variables: {
          input: {
            saleId: debtSaleData.id,
            reason: "kasbon return",
            items: [{ saleItemId: debtSaleData.items[0]!.id, qty: "6" }],
          },
        },
        headers: ownerAuth.headers,
      },
    );
    const debtReturnData = debtReturn.body.data?.createSaleReturn as {
      totalRefund: string;
      cashRefund: string;
      refundMethod: string | null;
    };
    assert.equal(debtReturnData.totalRefund, "60000");
    assert.equal(debtReturnData.cashRefund, "0");
    assert.equal(debtReturnData.refundMethod, null);

    const debtAfter = await graphql(
      server,
      `
        query ($id: ID!) {
          sale(id: $id) {
            paid
            outstanding
            paymentStatus
          }
        }
      `,
      { variables: { id: debtSaleData.id }, headers: ownerAuth.headers },
    );
    assert.deepEqual(debtAfter.body.data?.sale, {
      paid: "40000",
      outstanding: "0",
      paymentStatus: "PAID",
    });
  } finally {
    await server.close();
  }
});

test("cash flows include auto sale/refund rows, manual rows, and close expected cash", async () => {
  const owner = await createUser("OWNER");
  const server = await startServer();

  try {
    const auth = await webLogin(server, owner);
    const product = await createProduct(auth, server);
    const shift = await openShift(auth, server, { openingCash: "50000" });

    const cashSale = await createSale(server, auth.headers, {
      shiftId: shift.id,
      items: [
        {
          productId: product.id,
          productUnitId: unit(product, "pcs").id,
          qty: "10",
          unitPrice: "10000",
        },
      ],
      payments: [{ method: "CASH", amount: "100000", cashReceived: "100000" }],
    });
    const saleData = (
      cashSale.body.data?.createSale as {
        sale: { id: string; items: Array<{ id: string }> };
      }
    ).sale;

    const splitSale = await createSale(server, auth.headers, {
      shiftId: shift.id,
      items: [
        {
          productId: product.id,
          productUnitId: unit(product, "pcs").id,
          qty: "1",
          unitPrice: "10000",
        },
      ],
      payments: [
        { method: "CASH", amount: "5000", cashReceived: "5000" },
        { method: "QRIS", amount: "5000" },
      ],
    });
    const splitData = (
      splitSale.body.data?.createSale as {
        sale: {
          settlementMethod: string;
          payments: Array<{ method: string; shiftId: string | null }>;
        };
      }
    ).sale;
    assert.equal(splitData.settlementMethod, "MIXED");
    assert.equal(
      splitData.payments.find((payment) => payment.method === "QRIS")?.shiftId,
      null,
    );

    const refund = await graphql(
      server,
      `
        mutation ($input: CreateSaleReturnInput!) {
          createSaleReturn(input: $input) {
            id
            cashRefund
          }
        }
      `,
      {
        variables: {
          input: {
            saleId: saleData.id,
            reason: "refund",
            items: [{ saleItemId: saleData.items[0]!.id, qty: "3" }],
            refundMethod: "CASH",
          },
        },
        headers: auth.headers,
      },
    );
    assert.equal(
      (refund.body.data?.createSaleReturn as { cashRefund: string }).cashRefund,
      "30000",
    );

    const manualIn = await graphql(
      server,
      `
        mutation ($input: CreateCashFlowInput!) {
          createCashFlow(input: $input) {
            id
            type
            category
            amount
            source
            referenceType
            shiftId
          }
        }
      `,
      {
        variables: {
          input: {
            type: "IN",
            paymentMethod: "CASH",
            category: "OTHER",
            amount: "5000",
          },
        },
        headers: auth.headers,
      },
    );
    assert.equal(
      manualIn.body.errors,
      undefined,
      JSON.stringify(manualIn.body),
    );
    const manualOut = await graphql(
      server,
      `
        mutation ($input: CreateCashFlowInput!) {
          createCashFlow(input: $input) {
            id
            type
            category
            amount
            source
            referenceType
            shiftId
          }
        }
      `,
      {
        variables: {
          input: {
            type: "OUT",
            paymentMethod: "CASH",
            category: "EXPENSE",
            amount: "2000",
          },
        },
        headers: auth.headers,
      },
    );
    assert.equal(manualOut.body.errors, undefined);

    const close = await graphql(
      server,
      `
        mutation ($input: CloseShiftInput!) {
          closeShift(input: $input) {
            expectedCash
            actualCash
            status
          }
        }
      `,
      {
        variables: { input: { shiftId: shift.id, actualCash: "128000" } },
        headers: auth.headers,
      },
    );
    assert.equal(close.body.errors, undefined, JSON.stringify(close.body));
    const closed = close.body.data?.closeShift as {
      expectedCash: string;
      actualCash: string;
      status: string;
    };
    assert.equal(closed.expectedCash, "128000");
    assert.equal(closed.status, "CLOSED");

    const [saleFlow] = await testSql`
      select id, type, category, amount, shift_id, source, reference_id
      from cash_flows
      where reference_type = 'SALE_PAYMENT'
        and reference_id = (
          select id from sale_payments where sale_id = ${saleData.id} limit 1
        )`;
    assert.equal(saleFlow.type, "IN");
    assert.equal(saleFlow.category, "SALES");
    assert.equal(Number(saleFlow.amount), 100000);
    assert.equal(saleFlow.shift_id, shift.id);
    assert.equal(saleFlow.source, "AUTO");

    await assert.rejects(
      testSql`
        insert into cash_flows (
          type, payment_method, category, amount, shift_id, reference_type,
          reference_id, source, created_by
        )
        values (
          'IN', 'CASH', 'SALES', 100000, ${shift.id}, 'SALE_PAYMENT',
          ${saleFlow.reference_id}, 'AUTO', ${owner.id}
        )`,
      (error: unknown) => (error as { code?: string }).code === "23505",
    );

    const flows = await graphql(
      server,
      `
        {
          cashFlows(filter: {}) {
            items {
              id
              type
              category
              amount
              source
              referenceType
              shiftId
            }
            pageInfo {
              total
            }
          }
        }
      `,
      { headers: auth.headers },
    );
    assert.equal(flows.body.errors, undefined, JSON.stringify(flows.body));
  } finally {
    await server.close();
  }
});

test("role checks and error codes protect shift and sale operations", async () => {
  const owner = await createUser("OWNER");
  const warehouse = await createUser("WAREHOUSE");
  const server = await startServer();

  try {
    const ownerAuth = await webLogin(server, owner);
    const warehouseAuth = await webLogin(server, warehouse);
    const product = await createProduct(ownerAuth, server);
    const shift = await openShift(ownerAuth, server, { openingCash: "0" });

    const warehouseSale = await createSale(server, warehouseAuth.headers, {
      shiftId: shift.id,
      items: [
        {
          productId: product.id,
          productUnitId: unit(product, "pcs").id,
          qty: "1",
          unitPrice: "10000",
        },
      ],
      payments: [{ method: "CASH", amount: "10000" }],
    });
    assert.equal(errorCode(warehouseSale.body), "FORBIDDEN");

    const missingReason = await graphql(
      server,
      `
        mutation ($id: ID!, $reason: String!) {
          voidSale(id: $id, reason: $reason) {
            id
          }
        }
      `,
      {
        variables: { id: crypto.randomUUID(), reason: " " },
        headers: ownerAuth.headers,
      },
    );
    assert.equal(errorCode(missingReason.body), "VALIDATION_FAILED");
  } finally {
    await server.close();
  }
});
