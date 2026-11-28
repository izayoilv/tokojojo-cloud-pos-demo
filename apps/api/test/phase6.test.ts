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
import { purgeExpiredAuditEvents } from "../src/audit/service.ts";
import {
  getPepper,
  hashPassword,
  loadPepperConfigFromEnv,
} from "../src/auth/passwords.ts";
import { createAuthServices } from "../src/auth/services.ts";
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
  name: string;
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

function jakartaDay(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

async function createUser(
  role: TestUser["role"] = "OWNER",
  password = "phase6-password",
): Promise<TestUser> {
  const suffix = randomSuffix();
  const name = `Phase6 ${role} ${suffix}`;
  const username = `phase6-${suffix}`;
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
      ${name}, ${username}, ${passwordHash},
      ${config.currentVersion}, ${role}
    )
    returning id`;
  return { id: row.id, name, username, password, role };
}

async function webLogin(server: TestServer, user: TestUser): Promise<WebAuth> {
  const result = await graphql(
    server,
    `
      mutation Login($input: LoginInput!) {
        login(input: $input) {
          user {
            id
            role
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
  assert.equal(result.body.errors, undefined, JSON.stringify(result.body));
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
      variables: { input: { name: `Phase6 Category ${suffix}` } },
      headers: auth.headers,
    },
  );
  assert.equal(category.body.errors, undefined, JSON.stringify(category.body));
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
          name: `Phase6 Product ${suffix}`,
          categoryId,
          baseUnit: "pcs",
          units: [
            { unitName: "pcs", conversionQty: "1", sellingPrice: "10000" },
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

async function createSupplier(auth: WebAuth, server: TestServer) {
  const result = await graphql(
    server,
    `
      mutation ($input: SupplierInput!) {
        createSupplier(input: $input) {
          id
          name
        }
      }
    `,
    {
      variables: { input: { name: `Phase6 Supplier ${randomSuffix()}` } },
      headers: auth.headers,
    },
  );
  assert.equal(result.body.errors, undefined, JSON.stringify(result.body));
  return result.body.data?.createSupplier as { id: string; name: string };
}

async function openShift(
  auth: WebAuth,
  server: TestServer,
): Promise<{ id: string }> {
  const result = await graphql(
    server,
    `
      mutation ($input: OpenShiftInput!) {
        openShift(input: $input) {
          id
          status
        }
      }
    `,
    {
      variables: { input: { openingCash: "100000" } },
      headers: auth.headers,
    },
  );
  assert.equal(result.body.errors, undefined, JSON.stringify(result.body));
  return result.body.data?.openShift as { id: string };
}

async function createSale(
  server: TestServer,
  auth: WebAuth,
  input: Record<string, unknown>,
): Promise<{ sale: { id: string; totalAmount: string } }> {
  const result = await graphql(
    server,
    `
      mutation ($input: CreateSaleInput!) {
        createSale(input: $input) {
          sale {
            id
            totalAmount
          }
        }
      }
    `,
    { variables: { input }, headers: auth.headers },
  );
  assert.equal(result.body.errors, undefined, JSON.stringify(result.body));
  return result.body.data?.createSale as {
    sale: { id: string; totalAmount: string };
  };
}

function productUnit(product: {
  units: Array<{ id: string; unitName: string }>;
}): string {
  const unit = product.units.find((item) => item.unitName === "pcs");
  assert.ok(unit);
  return unit.id;
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
  payload: string,
) {
  const hash = createHash("sha256").update(payload, "utf8").digest("hex");
  const time = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
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

test("reports aggregate sales, inventory, and finance from the views", async () => {
  const owner = await createUser("OWNER");
  const server = await startServer();

  try {
    const auth = await webLogin(server, owner);
    const suffix = randomSuffix();
    const [category] = await testSql`
      insert into categories (name) values (${`Report Category ${suffix}`})
      returning id`;
    const [product] = await testSql`
      insert into products (sku, name, category_id, base_unit, avg_cost)
      values (
        ${`REPORT-${suffix}`}, ${`Report Product ${suffix}`},
        ${category.id}, 'pcs', 6000
      )
      returning id`;
    const [unit] = await testSql`
      insert into product_units (
        product_id, unit_name, conversion_qty, selling_price
      )
      values (${product.id}, 'pcs', 1, 10000)
      returning id`;

    const day = new Date(
      Date.UTC(2015, 0, 1) +
        Math.floor(Math.random() * 3000) * 24 * 60 * 60 * 1000,
    );
    const date = day.toISOString().slice(0, 10);
    const soldAt = `${date}T03:00:00.000Z`;
    const openedAt = `${date}T02:00:00.000Z`;

    const [shift] = await testSql`
      insert into cashier_shifts (
        user_id, status, opened_at, closed_at, opening_cash, expected_cash,
        actual_cash, created_at, updated_at
      )
      values (
        ${owner.id}, 'CLOSED', ${openedAt}::timestamptz,
        ${soldAt}::timestamptz, 0, 0, 0,
        ${openedAt}::timestamptz, ${soldAt}::timestamptz
      )
      returning id`;
    const [sale] = await testSql`
      insert into sales (
        invoice_no, shift_id, user_id, subtotal, discount, total_amount,
        settlement_method, status, created_at, updated_at
      )
      values (
        ${`INV-REPORT-${suffix}`}, ${shift.id}, ${owner.id},
        20000, 0, 20000, 'CASH', 'COMPLETED',
        ${soldAt}::timestamptz, ${soldAt}::timestamptz
      )
      returning id`;
    await testSql`
      insert into sale_items (
        sale_id, product_id, product_unit_id, product_name, unit_name,
        qty, qty_base, unit_price, discount, unit_cost, subtotal
      )
      values (
        ${sale.id}, ${product.id}, ${unit.id},
        ${`Report Product ${suffix}`}, 'pcs', 2, 2, 10000, 0, 6000, 20000
      )`;
    const [payment] = await testSql`
      insert into sale_payments (
        sale_id, method, amount, cash_received, change, shift_id, received_by,
        paid_at, created_at
      )
      values (
        ${sale.id}, 'CASH', 20000, 20000, 0, ${shift.id}, ${owner.id},
        ${soldAt}::timestamptz, ${soldAt}::timestamptz
      )
      returning id`;
    await testSql`
      insert into cash_flows (
        type, payment_method, category, amount, shift_id, reference_type,
        reference_id, source, created_by, created_at
      )
      values (
        'IN', 'CASH', 'SALES', 20000, ${shift.id}, 'SALE_PAYMENT',
        ${payment.id}, 'AUTO', ${owner.id}, ${soldAt}::timestamptz
      )`;
    await testSql`
      insert into cash_flows (
        type, payment_method, category, amount, reference_type, source,
        created_by, created_at
      )
      values (
        'OUT', 'CASH', 'EXPENSE', 3000, 'MANUAL', 'MANUAL',
        ${owner.id}, ${soldAt}::timestamptz
      )`;
    await testSql`
      insert into stock_movements (
        product_id, location, qty_change, movement_type, reference_type,
        created_by, created_at
      )
      values (
        ${product.id}, 'STORE', 10, 'PURCHASE', 'MANUAL',
        ${owner.id}, ${`${date}T01:00:00.000Z`}::timestamptz
      )`;
    await testSql`
      insert into stock_movements (
        product_id, location, qty_change, movement_type, reference_type,
        reference_id, created_by, created_at
      )
      values (
        ${product.id}, 'STORE', -2, 'SALE', 'SALE',
        ${sale.id}, ${owner.id}, ${soldAt}::timestamptz
      )`;
    const [recentSale] = await testSql`
      insert into sales (
        invoice_no, shift_id, user_id, subtotal, discount, total_amount,
        settlement_method, status, created_at, updated_at
      )
      values (
        ${`INV-RECENT-${suffix}`}, ${shift.id}, ${owner.id},
        1000, 0, 1000, 'CASH', 'COMPLETED', now(), now()
      )
      returning id`;
    const [dueSupplier] = await testSql`
      insert into suppliers (name)
      values (${`Due Supplier ${suffix}`})
      returning id`;
    const duePurchaseNos: Record<"overdue" | "today" | "future", string> = {
      overdue: `PO-DUE-OVERDUE-${suffix}`,
      today: `PO-DUE-TODAY-${suffix}`,
      future: `PO-DUE-FUTURE-${suffix}`,
    };
    for (const [bucket, dueDate] of [
      ["overdue", jakartaDay(-1)],
      ["today", jakartaDay(0)],
      ["future", jakartaDay(1)],
    ] as const) {
      await testSql`
        insert into purchases (
          purchase_no, supplier_id, supplier_name, created_by, due_date,
          total_amount, status, received_at, created_at, updated_at
        )
        values (
          ${duePurchaseNos[bucket]}, ${dueSupplier.id},
          ${`Due Supplier ${suffix}`}, ${owner.id},
          ${dueDate}::date, 5000, 'OPEN', now(), now(), now()
        )`;
    }

    const dashboard = await graphql(
      server,
      `
        query ($range: DateRangeInput!) {
          dashboardSummary(range: $range, location: STORE) {
            asOf
            salesTotal
            cogsTotal
            grossProfit
            marginPercent
            salesSeries {
              date
              saleCount
              total
            }
            stockStatus {
              ok
              low
              out
            }
            lowStock {
              productId
            }
            payablesDue {
              purchaseNo
            }
            recentSales {
              id
            }
            pendingTransfers {
              id
            }
            pendingOpnames {
              id
            }
          }
        }
      `,
      {
        variables: { range: { from: date, to: date } },
        headers: auth.headers,
      },
    );
    assert.equal(
      dashboard.body.errors,
      undefined,
      JSON.stringify(dashboard.body),
    );
    const summary = dashboard.body.data?.dashboardSummary as {
      salesTotal: string;
      cogsTotal: string;
      grossProfit: string;
      marginPercent: string;
      salesSeries: Array<{ date: string; saleCount: number; total: string }>;
    };
    assert.equal(summary.salesTotal, "20000");
    assert.equal(summary.cogsTotal, "12000");
    assert.equal(summary.grossProfit, "8000");
    assert.equal(summary.marginPercent, "40.00");
    assert.deepEqual(
      summary.salesSeries.map((point) => ({
        date: point.date,
        saleCount: point.saleCount,
        total: point.total,
      })),
      [{ date, saleCount: 1, total: "20000" }],
    );

    for (const groupBy of ["DAY", "PRODUCT", "CASHIER"] as const) {
      const report = await graphql(
        server,
        `
          query ($range: DateRangeInput!, $groupBy: SalesReportGroupBy!) {
            salesReport(range: $range, groupBy: $groupBy) {
              saleCount
              salesTotal
              discountTotal
              returnsTotal
              cogsTotal
              grossProfitTotal
              rows {
                groupKey
                groupLabel
                saleCount
                qtyBase
                sales
                discount
                returns
                cogs
                grossProfit
              }
            }
          }
        `,
        {
          variables: { range: { from: date, to: date }, groupBy },
          headers: auth.headers,
        },
      );
      assert.equal(report.body.errors, undefined, JSON.stringify(report.body));
      const payload = report.body.data?.salesReport as {
        saleCount: number;
        salesTotal: string;
        cogsTotal: string;
        grossProfitTotal: string;
        rows: Array<{
          groupKey: string;
          groupLabel: string;
          saleCount: number;
          qtyBase: string;
          sales: string;
          cogs: string;
          grossProfit: string;
        }>;
      };
      assert.equal(payload.saleCount, 1);
      assert.equal(payload.salesTotal, "20000");
      assert.equal(payload.cogsTotal, "12000");
      assert.equal(payload.grossProfitTotal, "8000");
      assert.equal(payload.rows.length, 1);
      if (groupBy === "PRODUCT") {
        assert.equal(payload.rows[0]?.groupKey, product.id);
      } else if (groupBy === "CASHIER") {
        assert.equal(payload.rows[0]?.groupKey, owner.id);
      } else {
        assert.equal(payload.rows[0]?.groupKey, date);
      }
      assert.equal(payload.rows[0]?.qtyBase, "2.000");
      assert.equal(payload.rows[0]?.sales, "20000");
      assert.equal(payload.rows[0]?.cogs, "12000");
      assert.equal(payload.rows[0]?.grossProfit, "8000");
    }

    const inventory = await graphql(
      server,
      `
        query ($range: DateRangeInput!) {
          inventoryReport(range: $range, location: STORE) {
            totalValue
            lowCount
            outCount
            rows {
              product {
                id
                name
              }
              location
              openingQty
              receivedQty
              soldQty
              adjustedQty
              closingQty
              avgCost
              value
              minQty
              status
            }
          }
        }
      `,
      {
        variables: { range: { from: date, to: date } },
        headers: auth.headers,
      },
    );
    assert.equal(
      inventory.body.errors,
      undefined,
      JSON.stringify(inventory.body),
    );
    const inventoryPayload = inventory.body.data?.inventoryReport as {
      totalValue: string;
      rows: Array<{
        product: { id: string };
        openingQty: string;
        receivedQty: string;
        soldQty: string;
        adjustedQty: string;
        closingQty: string;
        avgCost: string;
        value: string;
        minQty: string | null;
        status: string;
      }>;
    };
    const inventoryRow = inventoryPayload.rows.find(
      (row) => row.product.id === product.id,
    );
    assert.ok(inventoryRow);
    assert.equal(inventoryRow.openingQty, "0.000");
    assert.equal(inventoryRow.receivedQty, "10.000");
    assert.equal(inventoryRow.soldQty, "2.000");
    assert.equal(inventoryRow.adjustedQty, "0.000");
    assert.equal(inventoryRow.closingQty, "8.000");
    assert.equal(inventoryRow.avgCost, "6000");
    assert.equal(inventoryRow.value, "48000");
    assert.equal(inventoryRow.minQty, null);
    assert.equal(inventoryRow.status, "OK");
    assert.ok(Number(inventoryPayload.totalValue) >= 48000);

    const finance = await graphql(
      server,
      `
        query ($range: DateRangeInput!) {
          financeReport(range: $range) {
            cashIn
            cashOut
            netCash
            receivablesOutstanding
            payablesOutstanding
            byCategory {
              category
              type
              amount
              count
            }
          }
        }
      `,
      {
        variables: { range: { from: date, to: date } },
        headers: auth.headers,
      },
    );
    assert.equal(finance.body.errors, undefined, JSON.stringify(finance.body));
    const financePayload = finance.body.data?.financeReport as {
      cashIn: string;
      cashOut: string;
      netCash: string;
      receivablesOutstanding: string;
      payablesOutstanding: string;
      byCategory: Array<{ category: string; type: string; amount: string }>;
    };
    assert.equal(financePayload.cashIn, "20000");
    assert.equal(financePayload.cashOut, "3000");
    assert.equal(financePayload.netCash, "17000");
    assert.ok(financePayload.receivablesOutstanding.length > 0);
    assert.ok(financePayload.payablesOutstanding.length > 0);
    assert.ok(
      financePayload.byCategory.some(
        (row) =>
          row.category === "SALES" &&
          row.type === "IN" &&
          row.amount === "20000",
      ),
    );
    assert.ok(
      financePayload.byCategory.some(
        (row) =>
          row.category === "EXPENSE" &&
          row.type === "OUT" &&
          row.amount === "3000",
      ),
    );

    const admin = await createUser("ADMIN");
    const cashier = await createUser("CASHIER");
    const warehouse = await createUser("WAREHOUSE");
    const adminAuth = await webLogin(server, admin);
    const cashierAuth = await webLogin(server, cashier);
    const warehouseAuth = await webLogin(server, warehouse);

    for (const [role, roleAuth] of [
      ["OWNER", auth],
      ["ADMIN", adminAuth],
      ["CASHIER", cashierAuth],
      ["WAREHOUSE", warehouseAuth],
    ] as const) {
      const dashboard = await graphql(
        server,
        `
          {
            dashboardSummary {
              salesTotal
              payablesDue {
                purchaseNo
              }
              recentSales {
                id
              }
            }
          }
        `,
        { headers: roleAuth.headers },
      );
      assert.equal(
        dashboard.body.errors,
        undefined,
        `${role}: ${JSON.stringify(dashboard.body.errors)}`,
      );
      const payload = dashboard.body.data?.dashboardSummary as {
        payablesDue: Array<{ purchaseNo: string }>;
        recentSales: Array<{ id: string }>;
      };
      if (role === "OWNER" || role === "ADMIN") {
        assert.ok(
          payload.recentSales.some((item) => item.id === recentSale.id),
          `${role} sees recent sales`,
        );
        const dueNos = payload.payablesDue.map((item) => item.purchaseNo);
        assert.ok(
          dueNos.includes(duePurchaseNos.overdue),
          `${role} includes overdue payable`,
        );
        assert.ok(
          dueNos.includes(duePurchaseNos.today),
          `${role} includes today payable`,
        );
        assert.ok(
          !dueNos.includes(duePurchaseNos.future),
          `${role} excludes future payable`,
        );
      } else {
        assert.deepEqual(payload.payablesDue, [], `${role} payables`);
        assert.deepEqual(payload.recentSales, [], `${role} recent sales`);
      }
    }
    const forbidden = await graphql(
      server,
      `
        {
          salesReport(groupBy: DAY) {
            saleCount
          }
        }
      `,
      { headers: cashierAuth.headers },
    );
    assert.equal(errorCode(forbidden.body), "FORBIDDEN");
  } finally {
    await server.close();
  }
});

test("user administration enforces OWNER protection and audits changes", async () => {
  const owner = await createUser("OWNER");
  const admin = await createUser("ADMIN");
  const server = await startServer();

  try {
    const ownerAuth = await webLogin(server, owner);
    const adminAuth = await webLogin(server, admin);

    for (const result of [
      await graphql(
        server,
        `
          mutation ($input: CreateUserInput!) {
            createUser(input: $input) {
              id
            }
          }
        `,
        {
          variables: {
            input: {
              name: "Bad Owner",
              username: `bad-owner-${randomSuffix()}`,
              password: "bad-owner-password",
              role: "OWNER",
            },
          },
          headers: adminAuth.headers,
        },
      ),
      await graphql(
        server,
        `mutation { updateUser(id: "${owner.id}", input: { name: "Hacked" }) { id } }`,
        { headers: adminAuth.headers },
      ),
      await graphql(
        server,
        `mutation { setUserActive(id: "${owner.id}", active: false) { id } }`,
        { headers: adminAuth.headers },
      ),
      await graphql(
        server,
        `mutation { resetUserPassword(id: "${owner.id}") { temporaryPassword } }`,
        { headers: adminAuth.headers },
      ),
    ]) {
      assert.equal(errorCode(result.body), "FORBIDDEN");
    }

    const created = await graphql(
      server,
      `
        mutation ($input: CreateUserInput!) {
          createUser(input: $input) {
            id
            name
            username
            role
            isActive
          }
        }
      `,
      {
        variables: {
          input: {
            name: "Phase6 Staff",
            username: `phase6-staff-${randomSuffix()}`,
            password: "initial-password",
            role: "CASHIER",
          },
        },
        headers: ownerAuth.headers,
      },
    );
    assert.equal(created.body.errors, undefined, JSON.stringify(created.body));
    const staff = created.body.data?.createUser as {
      id: string;
      name: string;
      username: string;
      role: string;
    };

    const updated = await graphql(
      server,
      `
        mutation ($id: ID!) {
          updateUser(id: $id, input: { name: "Phase6 Staff Updated" }) {
            id
            name
            role
          }
        }
      `,
      { variables: { id: staff.id }, headers: ownerAuth.headers },
    );
    assert.equal(updated.body.errors, undefined);
    assert.equal(
      (updated.body.data?.updateUser as { name: string }).name,
      "Phase6 Staff Updated",
    );

    const listed = await graphql(
      server,
      `
        query ($filter: UserFilter!) {
          users(
            filter: $filter
            page: { page: 1, pageSize: 5 }
            sort: { field: "lastLoginAt", direction: DESC }
          ) {
            items {
              id
              username
              role
              lastLoginAt
            }
            pageInfo {
              total
              page
              pageSize
            }
          }
        }
      `,
      {
        variables: { filter: { search: staff.username } },
        headers: ownerAuth.headers,
      },
    );
    assert.equal(listed.body.errors, undefined);
    const listPayload = listed.body.data?.users as {
      items: Array<{ id: string }>;
      pageInfo: { total: number };
    };
    assert.equal(listPayload.items[0]?.id, staff.id);
    assert.ok(listPayload.pageInfo.total >= 1);

    const reset = await graphql(
      server,
      `
        mutation ($id: ID!) {
          resetUserPassword(id: $id) {
            temporaryPassword
            user {
              id
            }
          }
        }
      `,
      { variables: { id: staff.id }, headers: ownerAuth.headers },
    );
    assert.equal(reset.body.errors, undefined, JSON.stringify(reset.body));
    const resetPayload = reset.body.data?.resetUserPassword as {
      temporaryPassword: string;
    };
    assert.ok(resetPayload.temporaryPassword.length >= 12);

    const tempLogin = await webLogin(server, {
      id: staff.id,
      name: "Phase6 Staff Updated",
      username: staff.username,
      password: resetPayload.temporaryPassword,
      role: "CASHIER",
    });
    assert.ok(tempLogin.headers.cookie);

    const deactivated = await graphql(
      server,
      `
        mutation ($id: ID!) {
          setUserActive(id: $id, active: false) {
            id
            isActive
          }
        }
      `,
      { variables: { id: staff.id }, headers: ownerAuth.headers },
    );
    assert.equal(deactivated.body.errors, undefined);
    assert.equal(
      (deactivated.body.data?.setUserActive as { isActive: boolean }).isActive,
      false,
    );

    const disabledLogin = await graphql(
      server,
      `
        mutation ($input: LoginInput!) {
          login(input: $input) {
            user {
              id
            }
          }
        }
      `,
      {
        variables: {
          input: {
            username: staff.username,
            password: resetPayload.temporaryPassword,
          },
        },
        headers: { "x-client-platform": "WEB" },
      },
    );
    assert.equal(errorCode(disabledLogin.body), "USER_DISABLED");

    const audit = await graphql(
      server,
      `
        query ($filter: AuditEventFilter!) {
          auditEvents(filter: $filter, page: { page: 1, pageSize: 10 }) {
            items {
              id
              eventType
              actor {
                id
              }
              entityId
              metadata
              createdAt
              retentionUntil
            }
            pageInfo {
              total
            }
          }
        }
      `,
      {
        variables: {
          filter: { eventType: "USER_PASSWORD_RESET", entityId: staff.id },
        },
        headers: ownerAuth.headers,
      },
    );
    assert.equal(audit.body.errors, undefined, JSON.stringify(audit.body));
    const auditPayload = audit.body.data?.auditEvents as {
      items: Array<{
        actor: { id: string } | null;
        eventType: string;
        entityId: string;
        metadata: string;
      }>;
    };
    assert.equal(auditPayload.items[0]?.eventType, "USER_PASSWORD_RESET");
    assert.equal(auditPayload.items[0]?.entityId, staff.id);
    assert.equal(auditPayload.items[0]?.actor?.id, owner.id);
    assert.ok(JSON.parse(auditPayload.items[0]!.metadata));

    const [expired] = await testSql`
      insert into audit_events (
        event_type, metadata, created_at, retention_until
      )
      values (
        'TEST_EXPIRED', '{}', now() - interval '200 days',
        now() - interval '1 day'
      )
      returning id`;
    const purged = await purgeExpiredAuditEvents();
    assert.ok(purged >= 1);
    const [stillThere] = await testSql`
      select id from audit_events where id = ${expired.id}`;
    assert.equal(stillThere, undefined);
  } finally {
    await server.close();
  }
});

test("store and receipt settings round-trip and remain role protected", async () => {
  const owner = await createUser("OWNER");
  const cashier = await createUser("CASHIER");
  const server = await startServer();

  try {
    const ownerAuth = await webLogin(server, owner);
    const cashierAuth = await webLogin(server, cashier);
    const suffix = randomSuffix();

    const updatedStore = await graphql(
      server,
      `
        mutation ($input: UpdateStoreSettingsInput!) {
          updateStoreSettings(input: $input) {
            storeName
            tagline
            address
            city
            phone
            npwp
            defaultLocation
            lowStockGuidance
            updatedAt
          }
        }
      `,
      {
        variables: {
          input: {
            storeName: `Toko ${suffix}`,
            tagline: "Tagline Uji",
            address: "Jl. Uji 1",
            city: "Batam",
            phone: "0777-123",
            npwp: "01.234.567.8-901.000",
            defaultLocation: "WAREHOUSE",
            lowStockGuidance: "Segera restok.",
          },
        },
        headers: ownerAuth.headers,
      },
    );
    assert.equal(
      updatedStore.body.errors,
      undefined,
      JSON.stringify(updatedStore.body),
    );
    const store = updatedStore.body.data?.updateStoreSettings as {
      storeName: string;
      defaultLocation: string;
    };
    assert.equal(store.storeName, `Toko ${suffix}`);
    assert.equal(store.defaultLocation, "WAREHOUSE");

    const readStore = await graphql(
      server,
      `
        {
          storeSettings {
            storeName
            tagline
            defaultValue: defaultLocation
            lowStockGuidance
          }
        }
      `,
      { headers: cashierAuth.headers },
    );
    assert.equal(readStore.body.errors, undefined);
    const readStoreValue = readStore.body.data?.storeSettings as {
      storeName: string;
      tagline: string | null;
      defaultValue: string;
    };
    assert.equal(readStoreValue.storeName, `Toko ${suffix}`);
    assert.equal(readStoreValue.tagline, "Tagline Uji");
    assert.equal(readStoreValue.defaultValue, "WAREHOUSE");

    const updatedReceipt = await graphql(
      server,
      `
        mutation ($input: UpdateReceiptSettingsInput!) {
          updateReceiptSettings(input: $input) {
            paperSize
            showPrice
            footerText
            autoPrint
            updatedAt
          }
        }
      `,
      {
        variables: {
          input: {
            paperSize: "MM58",
            showPrice: false,
            footerText: "Terima kasih sudah berbelanja.",
            autoPrint: true,
          },
        },
        headers: ownerAuth.headers,
      },
    );
    assert.equal(
      updatedReceipt.body.errors,
      undefined,
      JSON.stringify(updatedReceipt.body),
    );
    const receipt = updatedReceipt.body.data?.updateReceiptSettings as {
      paperSize: string;
      showPrice: boolean;
      footerText: string;
      autoPrint: boolean;
    };
    assert.equal(receipt.paperSize, "MM58");
    assert.equal(receipt.showPrice, false);
    assert.equal(receipt.footerText, "Terima kasih sudah berbelanja.");
    assert.equal(receipt.autoPrint, true);

    const readReceipt = await graphql(
      server,
      `
        {
          receiptSettings {
            paperSize
            showPrice
            footerText
            autoPrint
          }
        }
      `,
      { headers: cashierAuth.headers },
    );
    assert.equal(readReceipt.body.errors, undefined);
    assert.deepEqual(readReceipt.body.data?.receiptSettings, {
      paperSize: "MM58",
      showPrice: false,
      footerText: "Terima kasih sudah berbelanja.",
      autoPrint: true,
    });

    const forbiddenStore = await graphql(
      server,
      `
        mutation {
          updateStoreSettings(input: { storeName: "Nope" }) {
            storeName
          }
        }
      `,
      { headers: cashierAuth.headers },
    );
    assert.equal(errorCode(forbiddenStore.body), "FORBIDDEN");
    const forbiddenReceipt = await graphql(
      server,
      `
        mutation {
          updateReceiptSettings(input: { showPrice: true }) {
            showPrice
          }
        }
      `,
      { headers: cashierAuth.headers },
    );
    assert.equal(errorCode(forbiddenReceipt.body), "FORBIDDEN");
  } finally {
    await server.close();
  }
});

test("GraphQL depth and complexity limits reject abusive queries", async () => {
  const server = await startServer({
    graphqlMaxDepth: 2,
    graphqlMaxComplexity: 1,
  });

  try {
    const deep = await graphql(
      server,
      `
        {
          products {
            items {
              id
            }
          }
        }
      `,
    );
    assert.equal(deep.response.status, 400);
    assert.equal(errorCode(deep.body), "VALIDATION_FAILED");

    const complex = await graphql(
      server,
      `
        {
          me {
            id
            username
          }
        }
      `,
    );
    assert.equal(complex.response.status, 400);
    assert.equal(errorCode(complex.body), "VALIDATION_FAILED");

    const auth = createAuthServices({
      syncRateLimit: { perIp: 1, perUsername: 1 },
      upgradeRateLimit: { perIp: 1, perUsername: 1 },
    });
    assert.equal(auth.syncRateLimit.check("127.0.0.1", "device"), true);
    auth.syncRateLimit.recordFailure("127.0.0.1", "device");
    assert.equal(auth.syncRateLimit.check("127.0.0.1", "device"), false);
    assert.equal(auth.upgradeRateLimit.check("127.0.0.1", "device"), true);
    auth.upgradeRateLimit.recordFailure("127.0.0.1", "device");
    assert.equal(auth.upgradeRateLimit.check("127.0.0.1", "device"), false);
  } finally {
    await server.close();
  }
});

test("end-to-end smoke: web sale/report and Android receive stock", async () => {
  const owner = await createUser("OWNER");
  const warehouse = await createUser("WAREHOUSE");
  const server = await startServer();

  try {
    const ownerAuth = await webLogin(server, owner);
    const product = await createProduct(ownerAuth, server);

    const products = await graphql(
      server,
      `{ products(filter: { search: "${product.name}" }) { items { id name } } }`,
      { headers: ownerAuth.headers },
    );
    assert.equal(products.body.errors, undefined);
    assert.equal(
      (products.body.data?.products as { items: Array<{ id: string }> })
        .items[0]?.id,
      product.id,
    );

    const shift = await openShift(ownerAuth, server);
    const sale = await createSale(server, ownerAuth, {
      shiftId: shift.id,
      items: [
        {
          productId: product.id,
          productUnitId: productUnit(product),
          qty: "1",
          unitPrice: "10000",
        },
      ],
      payments: [{ method: "CASH", amount: "10000", cashReceived: "10000" }],
    });
    assert.equal(sale.sale.totalAmount, "10000");

    const report = await graphql(
      server,
      `
        query {
          salesReport(groupBy: PRODUCT) {
            rows {
              groupKey
              sales
            }
          }
        }
      `,
      { headers: ownerAuth.headers },
    );
    assert.equal(report.body.errors, undefined, JSON.stringify(report.body));
    const reportRows = (
      report.body.data?.salesReport as {
        rows: Array<{ groupKey: string; sales: string }>;
      }
    ).rows;
    const saleRow = reportRows.find((row) => row.groupKey === product.id);
    assert.ok(saleRow);
    assert.equal(saleRow.sales, "10000");

    const supplier = await createSupplier(ownerAuth, server);
    const key = createDeviceKey();
    const enrollment = await graphql(
      server,
      `
        mutation ($input: EnrollDeviceInput!) {
          enrollDevice(input: $input) {
            device {
              id
              status
            }
          }
        }
      `,
      {
        variables: {
          input: {
            username: warehouse.username,
            password: warehouse.password,
            name: `Android ${randomSuffix()}`,
            platform: "ANDROID",
            keyId: key.keyId,
            publicKey: key.publicKey,
          },
        },
      },
    );
    assert.equal(
      enrollment.body.errors,
      undefined,
      JSON.stringify(enrollment.body),
    );
    const deviceId = (
      enrollment.body.data?.enrollDevice as {
        device: { id: string; status: string };
      }
    ).device.id;

    const approved = await graphql(
      server,
      `
        mutation ($deviceId: ID!) {
          approveDevice(deviceId: $deviceId) {
            id
            status
          }
        }
      `,
      { variables: { deviceId }, headers: ownerAuth.headers },
    );
    assert.equal(
      approved.body.errors,
      undefined,
      JSON.stringify(approved.body),
    );
    assert.equal(
      (approved.body.data?.approveDevice as { status: string }).status,
      "ACTIVE",
    );

    const nonce = await nonceFor(server, deviceId, key.keyId);
    const login = await graphql(
      server,
      `
        mutation ($input: LoginInput!) {
          login(input: $input) {
            accessToken
            offlineToken
            user {
              id
              role
            }
          }
        }
      `,
      {
        variables: {
          input: { username: warehouse.username, password: warehouse.password },
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
            warehouse.username,
          ),
        },
      },
    );
    assert.equal(login.body.errors, undefined, JSON.stringify(login.body));
    const loginPayload = login.body.data?.login as {
      accessToken: string;
      offlineToken: string | null;
      user: { id: string; role: string };
    };
    assert.equal(loginPayload.user.role, "WAREHOUSE");
    assert.equal(loginPayload.offlineToken, null);

    const received = await graphql(
      server,
      `
        mutation ($input: ReceiveStockInput!) {
          receiveStock(input: $input) {
            purchase {
              id
              totalAmount
            }
            movements {
              id
              qtyChange
              movementType
              location
            }
          }
        }
      `,
      {
        variables: {
          input: {
            supplierId: supplier.id,
            location: "WAREHOUSE",
            items: [
              {
                productId: product.id,
                productUnitId: productUnit(product),
                qty: "5",
                unitCost: "7000",
              },
            ],
          },
        },
        headers: {
          authorization: `Bearer ${loginPayload.accessToken}`,
          "x-client-platform": "ANDROID",
        },
      },
    );
    assert.equal(
      received.body.errors,
      undefined,
      JSON.stringify(received.body),
    );
    const receivePayload = received.body.data?.receiveStock as {
      purchase: { totalAmount: string };
      movements: Array<{ qtyChange: string; location: string }>;
    };
    assert.equal(receivePayload.purchase.totalAmount, "35000");
    assert.equal(receivePayload.movements[0]?.qtyChange, "5.000");
    assert.equal(receivePayload.movements[0]?.location, "WAREHOUSE");

    const balances = await graphql(
      server,
      `
        query ($id: ID!) {
          stockBalances(filter: { productId: $id }) {
            items {
              location
              qty
            }
          }
        }
      `,
      {
        variables: { id: product.id },
        headers: {
          authorization: `Bearer ${loginPayload.accessToken}`,
          "x-client-platform": "ANDROID",
        },
      },
    );
    assert.equal(balances.body.errors, undefined);
    const stockRows = (
      balances.body.data?.stockBalances as {
        items: Array<{ location: string; qty: string }>;
      }
    ).items;
    assert.ok(
      stockRows.some(
        (row) => row.location === "WAREHOUSE" && Number(row.qty) === 5,
      ),
    );
  } finally {
    await server.close();
  }
});
