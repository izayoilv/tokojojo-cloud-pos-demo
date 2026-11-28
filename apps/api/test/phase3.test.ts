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
  const username = `phase3-${suffix}`;
  const password = "phase3-password";
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
      ${`Phase3 ${suffix}`}, ${username}, ${passwordHash},
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
  return {
    user,
    headers: { cookie, "x-csrf-token": csrf },
  };
}

async function createCategory(auth: WebAuth, server: TestServer) {
  const result = await graphql(
    server,
    `
      mutation ($input: CategoryInput!) {
        createCategory(input: $input) {
          id
          name
        }
      }
    `,
    {
      variables: { input: { name: `Category ${randomSuffix()}` } },
      headers: auth.headers,
    },
  );
  assert.equal(result.body.errors, undefined, JSON.stringify(result.body));
  return result.body.data?.createCategory as { id: string; name: string };
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
      variables: { input: { name: `Supplier ${randomSuffix()}` } },
      headers: auth.headers,
    },
  );
  assert.equal(result.body.errors, undefined, JSON.stringify(result.body));
  return result.body.data?.createSupplier as { id: string; name: string };
}

async function createProduct(
  auth: WebAuth,
  server: TestServer,
  options: { categoryId?: string } = {},
) {
  const suffix = randomSuffix();
  const categoryId =
    options.categoryId ?? (await createCategory(auth, server)).id;
  const result = await graphql(
    server,
    `
      mutation ($input: CreateProductInput!) {
        createProduct(input: $input) {
          id
          name
          sku
          baseUnit
          avgCost
          isActive
          units {
            id
            unitName
            conversionQty
            sellingPrice
            barcode
          }
          thresholds {
            location
            minQty
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
            {
              unitName: "pcs",
              conversionQty: "1",
              sellingPrice: "1000",
              barcode: `BAR-${suffix}`,
            },
            {
              unitName: "dus",
              conversionQty: "12",
              sellingPrice: "12000",
            },
          ],
          thresholds: [
            { location: "WAREHOUSE", minQty: "5" },
            { location: "STORE", minQty: "3" },
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
    units: Array<{
      id: string;
      unitName: string;
      conversionQty: string;
      sellingPrice: string;
    }>;
  };
}

function unit(
  product: { units: Array<{ id: string; unitName: string }> },
  name: string,
) {
  const value = product.units.find((unit) => unit.unitName === name);
  assert.ok(value);
  return value;
}

test("catalog CRUD enforces the base-unit rule and allow-listed sorting", async () => {
  const user = await createUser("OWNER");
  const server = await startServer();

  try {
    const auth = await webLogin(server, user);
    const category = await createCategory(auth, server);
    const product = await createProduct(auth, server, {
      categoryId: category.id,
    });
    assert.equal(product.units[0]?.conversionQty, "1.000");

    const invalidBase = await graphql(
      server,
      `
        mutation ($input: CreateProductInput!) {
          createProduct(input: $input) {
            id
          }
        }
      `,
      {
        variables: {
          input: {
            sku: `BAD-${randomSuffix()}`,
            name: "Bad base",
            categoryId: category.id,
            baseUnit: "pcs",
            units: [
              { unitName: "pcs", conversionQty: "1", sellingPrice: "1000" },
              { unitName: "box", conversionQty: "1", sellingPrice: "5000" },
            ],
          },
        },
        headers: auth.headers,
      },
    );
    assert.equal(errorCode(invalidBase.body), "VALIDATION_FAILED");

    const list = await graphql(
      server,
      `
        query ($filter: ProductFilter) {
          products(
            filter: $filter
            page: { page: 1, pageSize: 1 }
            sort: { field: "name", direction: ASC }
          ) {
            items {
              id
              name
            }
            pageInfo {
              page
              pageSize
              total
              totalPages
            }
          }
        }
      `,
      {
        variables: { filter: { search: product.name } },
        headers: auth.headers,
      },
    );
    assert.equal(list.body.errors, undefined, JSON.stringify(list.body));
    const page = list.body.data?.products as {
      items: Array<{ id: string; name: string }>;
      pageInfo: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    };
    assert.equal(page.pageInfo.total, 1);
    assert.equal(page.pageInfo.pageSize, 1);
    assert.equal(page.pageInfo.totalPages, 1);

    const invalidSort = await graphql(
      server,
      `
        {
          products(sort: { field: "dropTable", direction: ASC }) {
            pageInfo {
              total
            }
          }
        }
      `,
      { headers: auth.headers },
    );
    assert.equal(errorCode(invalidSort.body), "VALIDATION_FAILED");

    const updated = await graphql(
      server,
      `
        mutation ($id: ID!, $input: UpdateProductInput!) {
          updateProduct(id: $id, input: $input) {
            id
            name
            isActive
            units {
              unitName
              sellingPrice
            }
          }
        }
      `,
      {
        variables: {
          id: product.id,
          input: {
            name: `${product.name} updated`,
            units: [
              {
                productUnitId: unit(product, "pcs").id,
                unitName: "pcs",
                conversionQty: "1",
                sellingPrice: "1500",
              },
              {
                productUnitId: unit(product, "dus").id,
                unitName: "dus",
                conversionQty: "12",
                sellingPrice: "15000",
              },
            ],
          },
        },
        headers: auth.headers,
      },
    );
    assert.equal(updated.body.errors, undefined, JSON.stringify(updated.body));

    const archived = await graphql(
      server,
      `
        mutation ($id: ID!) {
          setProductActive(id: $id, active: false) {
            id
            isActive
          }
        }
      `,
      { variables: { id: product.id }, headers: auth.headers },
    );
    assert.equal(
      (archived.body.data?.setProductActive as { isActive: boolean }).isActive,
      false,
    );

    const supplier = await createSupplier(auth, server);
    const customer = await graphql(
      server,
      `
        mutation ($input: CustomerInput!) {
          createCustomer(input: $input) {
            id
            name
            outstandingReceivable
          }
        }
      `,
      {
        variables: { input: { name: `Customer ${randomSuffix()}` } },
        headers: auth.headers,
      },
    );
    assert.equal(customer.body.errors, undefined);
    const customerId = (customer.body.data?.createCustomer as { id: string })
      .id;
    const customerUpdated = await graphql(
      server,
      `
        mutation ($id: ID!, $input: CustomerInput!) {
          updateCustomer(id: $id, input: $input) {
            id
            name
            isActive
          }
          setCustomerActive(id: $id, active: false) {
            id
            isActive
          }
        }
      `,
      {
        variables: { id: customerId, input: { name: "Customer Updated" } },
        headers: auth.headers,
      },
    );
    assert.equal(customerUpdated.body.errors, undefined);

    const lists = await graphql(
      server,
      `
        {
          suppliers(
            filter: { search: "" }
            page: { page: 1, pageSize: 10 }
            sort: { field: "name", direction: ASC }
          ) {
            items {
              id
              name
            }
            pageInfo {
              total
            }
          }
          customers(
            page: { page: 1, pageSize: 10 }
            sort: { field: "name", direction: ASC }
          ) {
            items {
              id
              name
              outstandingReceivable
            }
            pageInfo {
              total
            }
          }
          categories {
            id
            name
          }
        }
      `,
      { headers: auth.headers },
    );
    assert.equal(lists.body.errors, undefined, JSON.stringify(lists.body));

    const sync = await graphql(
      server,
      `
        {
          catalogSync {
            serverTime
            products {
              id
              updatedAt
              units {
                barcode
                conversionQty
              }
            }
            categories {
              id
              name
              updatedAt
            }
            suppliers {
              id
              updatedAt
            }
            tombstones {
              entityType
              entityId
              deletedAt
            }
          }
        }
      `,
      { headers: auth.headers },
    );
    assert.equal(sync.body.errors, undefined, JSON.stringify(sync.body));
    assert.ok(supplier.id);
  } finally {
    await server.close();
  }
});

test("receive creates qty_base, purchase, movements, and negative stock flags", async () => {
  const user = await createUser("OWNER");
  const server = await startServer();

  try {
    const auth = await webLogin(server, user);
    const product = await createProduct(auth, server);
    const supplier = await createSupplier(auth, server);

    const received = await graphql(
      server,
      `
        mutation ($input: ReceiveStockInput!) {
          receiveStock(input: $input) {
            purchase {
              id
              purchaseNo
              totalAmount
              paid
              outstanding
              paymentStatus
              items {
                qty
                qtyBase
                unitCost
                subtotal
                unit {
                  unitName
                }
              }
            }
            movements {
              id
              qtyChange
              movementType
              location
              flagged
              product {
                id
              }
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
                productUnitId: unit(product, "dus").id,
                qty: "2",
                unitCost: "10000",
              },
            ],
          },
        },
        headers: auth.headers,
      },
    );
    assert.equal(
      received.body.errors,
      undefined,
      JSON.stringify(received.body),
    );
    const payload = received.body.data?.receiveStock as {
      purchase: {
        id: string;
        totalAmount: string;
        outstanding: string;
        items: Array<{ qty: string; qtyBase: string; subtotal: string }>;
      };
      movements: Array<{
        id: string;
        qtyChange: string;
        movementType: string;
        location: string;
        flagged: boolean;
      }>;
    };
    assert.equal(payload.purchase.totalAmount, "20000");
    assert.equal(payload.purchase.outstanding, "20000");
    assert.equal(payload.purchase.items[0]?.qtyBase, "24.000");
    assert.equal(payload.purchase.items[0]?.subtotal, "20000");
    assert.equal(payload.movements.length, 1);
    assert.equal(payload.movements[0]?.qtyChange, "24.000");
    assert.equal(payload.movements[0]?.movementType, "PURCHASE");
    assert.equal(payload.movements[0]?.flagged, false);

    const balance = await graphql(
      server,
      `
        query ($id: ID!) {
          stockBalances(filter: { productId: $id }) {
            items {
              qty
              location
              status
              isNegative
              minQty
            }
            pageInfo {
              total
            }
          }
        }
      `,
      { variables: { id: product.id }, headers: auth.headers },
    );
    const balanceItem = (
      balance.body.data?.stockBalances as {
        items: Array<{ qty: string; location: string; status: string }>;
      }
    ).items.find((item) => item.location === "WAREHOUSE");
    assert.equal(balanceItem?.qty, "24.000");
    assert.equal(balanceItem?.status, "OK");

    const summary = await graphql(
      server,
      `
        {
          lowStockProducts(location: WAREHOUSE) {
            qty
            status
          }
          stockSummary(location: WAREHOUSE) {
            okCount
            lowCount
            outCount
            negativeCount
            totalValue
            byLocation {
              location
              totalQty
              value
            }
          }
        }
      `,
      { headers: auth.headers },
    );
    assert.equal(summary.body.errors, undefined, JSON.stringify(summary.body));
    assert.ok(
      (summary.body.data?.stockSummary as { okCount: number }).okCount >= 1,
    );

    const transfer = await graphql(
      server,
      `
        mutation ($input: CreateTransferInput!) {
          createTransfer(input: $input) {
            id
            status
          }
        }
      `,
      {
        variables: {
          input: {
            fromLocation: "WAREHOUSE",
            toLocation: "STORE",
            items: [
              {
                productId: product.id,
                productUnitId: unit(product, "dus").id,
                qty: "3",
              },
            ],
          },
        },
        headers: auth.headers,
      },
    );
    const transferId = (transfer.body.data?.createTransfer as { id: string })
      .id;

    const completed = await graphql(
      server,
      `
        mutation ($id: ID!) {
          completeTransfer(id: $id) {
            id
            status
            items {
              qty
              qtyBase
            }
          }
        }
      `,
      { variables: { id: transferId }, headers: auth.headers },
    );
    assert.equal(
      completed.body.errors,
      undefined,
      JSON.stringify(completed.body),
    );
    assert.equal(
      (completed.body.data?.completeTransfer as { status: string }).status,
      "COMPLETED",
    );

    const after = await graphql(
      server,
      `
        query ($id: ID!) {
          stockBalances(filter: { productId: $id }) {
            items {
              qty
              location
              status
              isNegative
            }
          }
          stockMovements(filter: { productId: $id, flagged: true }) {
            items {
              id
              qtyChange
              movementType
              flagged
              flagReason
            }
          }
        }
      `,
      { variables: { id: product.id }, headers: auth.headers },
    );
    const afterData = after.body.data as {
      stockBalances: {
        items: Array<{
          qty: string;
          location: string;
          status: string;
          isNegative: boolean;
        }>;
      };
      stockMovements: {
        items: Array<{
          qtyChange: string;
          movementType: string;
          flagged: boolean;
          flagReason: string;
        }>;
      };
    };
    const warehouse = afterData.stockBalances.items.find(
      (item) => item.location === "WAREHOUSE",
    );
    const store = afterData.stockBalances.items.find(
      (item) => item.location === "STORE",
    );
    assert.equal(warehouse?.qty, "-12.000");
    assert.equal(warehouse?.status, "OUT");
    assert.equal(warehouse?.isNegative, true);
    assert.equal(store?.qty, "36.000");
    assert.ok(
      afterData.stockMovements.items.some(
        (movement) =>
          movement.movementType === "TRANSFER_OUT" &&
          movement.flagged &&
          movement.flagReason === "NEGATIVE_STOCK",
      ),
    );
  } finally {
    await server.close();
  }
});

test("adjust and opname submit/approve/reject follow the review workflow", async () => {
  const owner = await createUser("OWNER");
  const warehouse = await createUser("WAREHOUSE");
  const server = await startServer();

  try {
    const ownerAuth = await webLogin(server, owner);
    const warehouseAuth = await webLogin(server, warehouse);
    const product = await createProduct(ownerAuth, server);

    const adjusted = await graphql(
      server,
      `
        mutation ($input: AdjustStockInput!) {
          adjustStock(input: $input) {
            opname {
              id
              opnameNo
              status
              submittedAt
              items {
                systemQty
                physicalQty
                diffQty
              }
            }
            movements {
              id
            }
          }
        }
      `,
      {
        variables: {
          input: {
            location: "STORE",
            productId: product.id,
            physicalQty: "20",
            systemQty: "0",
            reason: "stock count",
          },
        },
        headers: warehouseAuth.headers,
      },
    );
    assert.equal(
      adjusted.body.errors,
      undefined,
      JSON.stringify(adjusted.body),
    );
    const adjustPayload = adjusted.body.data?.adjustStock as {
      opname: { id: string; status: string; items: Array<{ diffQty: string }> };
      movements: unknown[];
    };
    assert.equal(adjustPayload.opname.status, "PENDING");
    assert.equal(adjustPayload.opname.items[0]?.diffQty, "20.000");
    assert.equal(adjustPayload.movements.length, 0);

    const submit = await graphql(
      server,
      `
        mutation ($id: ID!) {
          submitOpname(id: $id) {
            id
            status
            submittedAt
          }
        }
      `,
      {
        variables: { id: adjustPayload.opname.id },
        headers: warehouseAuth.headers,
      },
    );
    assert.equal(
      (submit.body.data?.submitOpname as { status: string }).status,
      "PENDING",
    );

    const updateLocked = await graphql(
      server,
      `
        mutation ($id: ID!, $input: UpdateOpnameInput!) {
          updateOpname(id: $id, input: $input) {
            id
          }
        }
      `,
      {
        variables: {
          id: adjustPayload.opname.id,
          input: { items: [{ productId: product.id, physicalQty: "10" }] },
        },
        headers: warehouseAuth.headers,
      },
    );
    assert.equal(errorCode(updateLocked.body), "CONFLICT");

    const denied = await graphql(
      server,
      `
        mutation ($id: ID!) {
          approveOpname(id: $id) {
            id
          }
        }
      `,
      {
        variables: { id: adjustPayload.opname.id },
        headers: warehouseAuth.headers,
      },
    );
    assert.equal(errorCode(denied.body), "FORBIDDEN");

    const approved = await graphql(
      server,
      `
        mutation ($id: ID!) {
          approveOpname(id: $id) {
            id
            status
            reviewedAt
            items {
              diffQty
            }
          }
        }
      `,
      {
        variables: { id: adjustPayload.opname.id },
        headers: ownerAuth.headers,
      },
    );
    assert.equal(
      (approved.body.data?.approveOpname as { status: string }).status,
      "APPROVED",
    );

    const balance = await graphql(
      server,
      `{ stockBalances(filter: { productId: "${product.id}", location: STORE }) {
        items { qty }
      } }`,
      { headers: ownerAuth.headers },
    );
    assert.equal(
      (balance.body.data?.stockBalances as { items: Array<{ qty: string }> })
        .items[0]?.qty,
      "20.000",
    );

    const rejectedOpname = await graphql(
      server,
      `
        mutation ($input: CreateOpnameInput!) {
          createOpname(input: $input) {
            id
            status
          }
        }
      `,
      {
        variables: {
          input: {
            location: "STORE",
            items: [{ productId: product.id, physicalQty: "15" }],
          },
        },
        headers: warehouseAuth.headers,
      },
    );
    const rejectedId = (
      rejectedOpname.body.data?.createOpname as { id: string }
    ).id;
    await graphql(
      server,
      `
        mutation ($id: ID!) {
          submitOpname(id: $id) {
            id
          }
        }
      `,
      {
        variables: { id: rejectedId },
        headers: warehouseAuth.headers,
      },
    );
    const rejected = await graphql(
      server,
      `
        mutation ($id: ID!) {
          rejectOpname(id: $id) {
            id
            status
          }
        }
      `,
      { variables: { id: rejectedId }, headers: ownerAuth.headers },
    );
    assert.equal(
      (rejected.body.data?.rejectOpname as { status: string }).status,
      "REJECTED",
    );

    const afterReject = await graphql(
      server,
      `{ stockBalances(filter: { productId: "${product.id}", location: STORE }) {
        items { qty }
      } }`,
      { headers: ownerAuth.headers },
    );
    assert.equal(
      (
        afterReject.body.data?.stockBalances as {
          items: Array<{ qty: string }>;
        }
      ).items[0]?.qty,
      "20.000",
    );
  } finally {
    await server.close();
  }
});

test("transfer completion and cancellation only append movements when completed", async () => {
  const user = await createUser("OWNER");
  const server = await startServer();

  try {
    const auth = await webLogin(server, user);
    const product = await createProduct(auth, server);
    const supplier = await createSupplier(auth, server);

    await graphql(
      server,
      `
        mutation ($input: ReceiveStockInput!) {
          receiveStock(input: $input) {
            purchase {
              id
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
                productUnitId: unit(product, "dus").id,
                qty: "2",
                unitCost: "10000",
              },
            ],
          },
        },
        headers: auth.headers,
      },
    );

    const createTransfer = async () =>
      (
        await graphql(
          server,
          `
            mutation ($input: CreateTransferInput!) {
              createTransfer(input: $input) {
                id
                status
              }
            }
          `,
          {
            variables: {
              input: {
                fromLocation: "WAREHOUSE",
                toLocation: "STORE",
                items: [
                  {
                    productId: product.id,
                    productUnitId: unit(product, "dus").id,
                    qty: "1",
                  },
                ],
              },
            },
            headers: auth.headers,
          },
        )
      ).body.data?.createTransfer as { id: string; status: string };

    const cancelled = await createTransfer();
    const cancelResult = await graphql(
      server,
      `
        mutation ($id: ID!) {
          cancelTransfer(id: $id) {
            id
            status
          }
        }
      `,
      { variables: { id: cancelled.id }, headers: auth.headers },
    );
    assert.equal(
      (cancelResult.body.data?.cancelTransfer as { status: string }).status,
      "CANCELLED",
    );

    const cancelledMovements = await graphql(
      server,
      `
        query ($id: ID!) {
          stockMovements(filter: { referenceType: TRANSFER }) {
            items {
              id
            }
          }
          transfer(id: $id) {
            id
            status
            items {
              id
            }
          }
        }
      `,
      { variables: { id: cancelled.id }, headers: auth.headers },
    );
    assert.equal(
      (cancelledMovements.body.data?.transfer as { status: string }).status,
      "CANCELLED",
    );

    const cancelledMovementCount = await testSql`
      select count(*)::int as total
      from stock_movements
      where reference_type = 'TRANSFER' and reference_id = ${cancelled.id}`;
    assert.equal(cancelledMovementCount[0]?.total, 0);

    const completed = await createTransfer();
    const completeResult = await graphql(
      server,
      `
        mutation ($id: ID!) {
          completeTransfer(id: $id) {
            id
            status
            reviewedAt
            completedAt
            items {
              qty
              qtyBase
            }
          }
        }
      `,
      { variables: { id: completed.id }, headers: auth.headers },
    );
    assert.equal(
      (completeResult.body.data?.completeTransfer as { status: string }).status,
      "COMPLETED",
    );

    const movements = await testSql`
      select movement_type, location, qty_change
      from stock_movements
      where reference_type = 'TRANSFER' and reference_id = ${completed.id}
      order by movement_type`;
    assert.deepEqual(
      movements.map((row) => [
        row.movement_type,
        row.location,
        Number(row.qty_change),
      ]),
      [
        ["TRANSFER_OUT", "WAREHOUSE", -12],
        ["TRANSFER_IN", "STORE", 12],
      ],
    );
  } finally {
    await server.close();
  }
});

test("purchasing payments create auto cash flows and payables stay OPEN-only", async () => {
  const user = await createUser("OWNER");
  const server = await startServer();

  try {
    const auth = await webLogin(server, user);
    const product = await createProduct(auth, server);
    const supplier = await createSupplier(auth, server);

    const created = await graphql(
      server,
      `
        mutation ($input: CreatePurchaseInput!) {
          createPurchase(input: $input) {
            id
            purchaseNo
            status
            totalAmount
            paid
            outstanding
            paymentStatus
            items {
              qty
              qtyBase
              unitCost
              subtotal
            }
          }
        }
      `,
      {
        variables: {
          input: {
            supplierId: supplier.id,
            supplierInvoiceNo: `INV-${randomSuffix()}`,
            dueDate: "2026-12-31",
            items: [
              {
                productId: product.id,
                productUnitId: unit(product, "pcs").id,
                qty: "5",
                unitCost: "1000",
              },
            ],
          },
        },
        headers: auth.headers,
      },
    );
    assert.equal(created.body.errors, undefined, JSON.stringify(created.body));
    const purchase = created.body.data?.createPurchase as {
      id: string;
      totalAmount: string;
      status: string;
    };
    assert.equal(purchase.totalAmount, "5000");
    assert.equal(purchase.status, "OPEN");

    const payment = await graphql(
      server,
      `
        mutation ($input: AddPurchasePaymentInput!) {
          addPurchasePayment(input: $input) {
            id
            totalAmount
            paid
            outstanding
            paymentStatus
            payments {
              id
              amount
              paymentMethod
            }
          }
        }
      `,
      {
        variables: {
          input: {
            purchaseId: purchase.id,
            amount: "2000",
            paymentMethod: "TRANSFER",
            reference: "TRX-1",
          },
        },
        headers: auth.headers,
      },
    );
    assert.equal(payment.body.errors, undefined, JSON.stringify(payment.body));
    const paidPurchase = payment.body.data?.addPurchasePayment as {
      paid: string;
      outstanding: string;
      paymentStatus: string;
      payments: Array<{ id: string }>;
    };
    assert.equal(paidPurchase.paid, "2000");
    assert.equal(paidPurchase.outstanding, "3000");
    assert.equal(paidPurchase.paymentStatus, "PARTIAL");

    const paymentId = paidPurchase.payments[0]!.id;
    const cashFlows = await testSql`
      select id, type, category, source, amount, reference_type, reference_id
      from cash_flows
      where reference_type = 'PURCHASE_PAYMENT' and reference_id = ${paymentId}`;
    assert.equal(cashFlows.length, 1);
    assert.equal(cashFlows[0]?.type, "OUT");
    assert.equal(cashFlows[0]?.category, "PURCHASE");
    assert.equal(cashFlows[0]?.source, "AUTO");
    assert.equal(Number(cashFlows[0]?.amount), 2000);

    await assert.rejects(
      testSql`
        insert into cash_flows (
          type, payment_method, category, amount, reference_type,
          reference_id, source, created_by
        )
        values (
          'OUT', 'TRANSFER', 'PURCHASE', 2000, 'PURCHASE_PAYMENT',
          ${paymentId}, 'AUTO', ${user.id}
        )`,
      (error: unknown) => (error as { code?: string }).code === "23505",
    );

    const listed = await graphql(
      server,
      `
        query ($supplierId: ID!) {
          purchases(
            filter: { supplierId: $supplierId }
            page: { page: 1, pageSize: 10 }
            sort: { field: "createdAt", direction: DESC }
          ) {
            items {
              id
              purchaseNo
              status
              totalAmount
              paid
              outstanding
              paymentStatus
              items {
                qtyBase
              }
            }
            pageInfo {
              total
            }
          }
        }
      `,
      { variables: { supplierId: supplier.id }, headers: auth.headers },
    );
    assert.equal(listed.body.errors, undefined, JSON.stringify(listed.body));
    const listedPage = listed.body.data?.purchases as {
      items: Array<{ id: string; paymentStatus: string }>;
      pageInfo: { total: number };
    };
    assert.ok(listedPage.items.some((item) => item.id === purchase.id));
    assert.equal(
      listedPage.items.find((item) => item.id === purchase.id)?.paymentStatus,
      "PARTIAL",
    );

    const detail = await graphql(
      server,
      `
        query ($id: ID!) {
          purchase(id: $id) {
            id
            purchaseNo
            items {
              id
            }
          }
        }
      `,
      { variables: { id: purchase.id }, headers: auth.headers },
    );
    assert.equal(detail.body.errors, undefined, JSON.stringify(detail.body));

    const payables = await graphql(
      server,
      `
        query ($supplierId: ID!) {
          payables(filter: { supplierId: $supplierId }) {
            items {
              purchaseNo
              outstanding
              paymentStatus
              supplier {
                id
                name
              }
            }
            pageInfo {
              total
            }
          }
        }
      `,
      { variables: { supplierId: supplier.id }, headers: auth.headers },
    );
    assert.equal(
      payables.body.errors,
      undefined,
      JSON.stringify(payables.body),
    );
    const payablePage = payables.body.data?.payables as {
      items: Array<{ purchaseNo: string; outstanding: string }>;
      pageInfo: { total: number };
    };
    assert.ok(
      payablePage.items.some(
        (item) =>
          item.purchaseNo ===
          (created.body.data?.createPurchase as { purchaseNo: string })
            .purchaseNo,
      ),
    );

    const cancelled = await graphql(
      server,
      `
        mutation ($id: ID!) {
          cancelPurchase(id: $id) {
            id
            status
          }
        }
      `,
      { variables: { id: purchase.id }, headers: auth.headers },
    );
    assert.equal(
      (cancelled.body.data?.cancelPurchase as { status: string }).status,
      "CANCELLED",
    );

    const cancelMovements = await testSql`
      select movement_type, sum(qty_change)::numeric(12,3) as qty
      from stock_movements
      where reference_type = 'PURCHASE' and reference_id = ${purchase.id}
      group by movement_type
      order by movement_type`;
    assert.deepEqual(
      cancelMovements.map((row) => [row.movement_type, Number(row.qty)]),
      [
        ["PURCHASE", 5],
        ["PURCHASE_CANCEL", -5],
      ],
    );

    const afterCancel = await graphql(
      server,
      `
        query ($supplierId: ID!) {
          payables(filter: { supplierId: $supplierId }) {
            pageInfo {
              total
            }
          }
        }
      `,
      { variables: { supplierId: supplier.id }, headers: auth.headers },
    );
    assert.equal(
      (afterCancel.body.data?.payables as { pageInfo: { total: number } })
        .pageInfo.total,
      0,
    );
  } finally {
    await server.close();
  }
});

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

async function nativeWarehouseAuth(
  server: TestServer,
  user: TestUser,
): Promise<Record<string, string>> {
  const key = createDeviceKey();
  const enroll = await graphql(
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
          username: user.username,
          password: user.password,
          name: `Warehouse ${randomSuffix()}`,
          platform: "ANDROID",
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

  const nonce = await nonceFor(server, deviceId, key.keyId);
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
  assert.ok(accessToken);
  return {
    authorization: `Bearer ${accessToken}`,
    "x-client-platform": "ANDROID",
  };
}

test("WAREHOUSE can receive and adjust through native auth but cannot approve opname", async () => {
  const warehouse = await createUser("WAREHOUSE");
  const owner = await createUser("OWNER");
  const server = await startServer();

  try {
    const ownerAuth = await webLogin(server, owner);
    const product = await createProduct(ownerAuth, server);
    const supplier = await createSupplier(ownerAuth, server);
    const nativeHeaders = await nativeWarehouseAuth(server, warehouse);

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
              qtyChange
              movementType
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
                productUnitId: unit(product, "pcs").id,
                qty: "10",
                unitCost: "1000",
              },
            ],
          },
        },
        headers: nativeHeaders,
      },
    );
    assert.equal(
      received.body.errors,
      undefined,
      JSON.stringify(received.body),
    );

    const adjusted = await graphql(
      server,
      `
        mutation ($input: AdjustStockInput!) {
          adjustStock(input: $input) {
            opname {
              id
              status
            }
          }
        }
      `,
      {
        variables: {
          input: {
            location: "WAREHOUSE",
            productId: product.id,
            physicalQty: "8",
            reason: "native count",
          },
        },
        headers: nativeHeaders,
      },
    );
    assert.equal(
      adjusted.body.errors,
      undefined,
      JSON.stringify(adjusted.body),
    );
    const opnameId = (
      adjusted.body.data?.adjustStock as { opname: { id: string } }
    ).opname.id;

    const denied = await graphql(
      server,
      `
        mutation ($id: ID!) {
          approveOpname(id: $id) {
            id
          }
        }
      `,
      { variables: { id: opnameId }, headers: nativeHeaders },
    );
    assert.equal(errorCode(denied.body), "FORBIDDEN");

    const transfer = await graphql(
      server,
      `
        mutation ($input: CreateTransferInput!) {
          createTransfer(input: $input) {
            id
            status
          }
        }
      `,
      {
        variables: {
          input: {
            fromLocation: "WAREHOUSE",
            toLocation: "STORE",
            items: [
              {
                productId: product.id,
                productUnitId: unit(product, "pcs").id,
                qty: "2",
              },
            ],
          },
        },
        headers: nativeHeaders,
      },
    );
    assert.equal(
      transfer.body.errors,
      undefined,
      JSON.stringify(transfer.body),
    );
  } finally {
    await server.close();
  }
});
