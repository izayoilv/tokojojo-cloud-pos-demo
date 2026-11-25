import { readFileSync } from "node:fs";
import {
  buildSchema,
  getNamedType,
  GraphQLFloat,
  isEnumType,
  isInputObjectType,
  isObjectType,
  parse,
  validateSchema,
  visit,
} from "graphql";

const schemaPath = new URL("../schema.graphql", import.meta.url);
const errors = [];

let source;
try {
  source = readFileSync(schemaPath, "utf8");
} catch {
  console.error(`check-schema: cannot read ${schemaPath.pathname}`);
  process.exit(1);
}

let schema;
try {
  schema = buildSchema(source);
} catch (error) {
  console.error(`check-schema: SDL parse failed: ${error.message}`);
  process.exit(1);
}

for (const error of validateSchema(schema)) {
  errors.push(`invalid schema: ${error.message}`);
}

visit(parse(source), {
  Name(node) {
    if (/tenant/i.test(node.value)) {
      errors.push(
        `single-store violation: name "${node.value}" contains "tenant"`,
      );
    }
  },
  StringValue(node) {
    if (/tenant/i.test(node.value)) {
      errors.push(`single-store violation: string value contains "tenant"`);
    }
  },
});

if (!schema.getQueryType()) errors.push("missing Query root");
if (!schema.getMutationType()) errors.push("missing Mutation root");

const requiredQueries = [
  "me",
  "device",
  "devices",
  "sessions",
  "syncStatus",
  "products",
  "product",
  "categories",
  "suppliers",
  "supplier",
  "customers",
  "customer",
  "catalogSync",
  "stockBalances",
  "stockMovements",
  "lowStockProducts",
  "stockSummary",
  "transfers",
  "transfer",
  "opnames",
  "opname",
  "purchases",
  "purchase",
  "payables",
  "sales",
  "sale",
  "receivables",
  "shifts",
  "shift",
  "currentShift",
  "cashFlows",
  "dashboardSummary",
  "salesReport",
  "inventoryReport",
  "financeReport",
  "users",
  "user",
  "auditEvents",
  "storeSettings",
  "receiptSettings",
];

const requiredMutations = [
  "login",
  "logout",
  "refresh",
  "enrollDevice",
  "approveDevice",
  "revokeDevice",
  "rotateDeviceKey",
  "upgradeOfflineSession",
  "revokeSession",
  "createProduct",
  "updateProduct",
  "setProductActive",
  "createCategory",
  "updateCategory",
  "createSupplier",
  "updateSupplier",
  "setSupplierActive",
  "createCustomer",
  "updateCustomer",
  "setCustomerActive",
  "receiveStock",
  "adjustStock",
  "createTransfer",
  "completeTransfer",
  "cancelTransfer",
  "createOpname",
  "updateOpname",
  "submitOpname",
  "approveOpname",
  "rejectOpname",
  "createPurchase",
  "cancelPurchase",
  "addPurchasePayment",
  "createSale",
  "createSaleReturn",
  "voidSale",
  "openShift",
  "closeShift",
  "createCashFlow",
  "createUser",
  "updateUser",
  "setUserActive",
  "resetUserPassword",
  "updateStoreSettings",
  "updateReceiptSettings",
  "syncOfflineBatch",
];

function requireFields(typeName, fieldNames) {
  const type = schema.getType(typeName);
  if (!type || !(isObjectType(type) || isInputObjectType(type))) {
    errors.push(`missing type ${typeName}`);
    return;
  }
  const fields = type.getFields();
  for (const name of fieldNames) {
    if (!fields[name]) errors.push(`${typeName}.${name} is missing`);
  }
}

const queryFields = schema.getQueryType()?.getFields() ?? {};
for (const name of requiredQueries) {
  if (!queryFields[name]) errors.push(`Query.${name} is missing`);
}
const mutationFields = schema.getMutationType()?.getFields() ?? {};
for (const name of requiredMutations) {
  if (!mutationFields[name]) errors.push(`Mutation.${name} is missing`);
}

requireFields("AuthPayload", [
  "accessToken",
  "accessExpiresAt",
  "refreshToken",
  "refreshExpiresAt",
  "offlineToken",
  "offlineExpiresAt",
  "graceUntil",
  "device",
  "serverTime",
  "keySet",
  "user",
]);
requireFields("Session", [
  "id",
  "user",
  "createdAt",
  "expiresAt",
  "lastSeenAt",
  "revokedAt",
]);
requireFields("Device", [
  "id",
  "name",
  "platform",
  "status",
  "enrolledBy",
  "enrolledAt",
  "lastSeenAt",
  "revokedAt",
]);
requireFields("DeviceKey", [
  "id",
  "deviceId",
  "keyId",
  "publicKey",
  "keyAlg",
  "status",
  "acceptedUntil",
]);
requireFields("SyncStatus", [
  "serverTime",
  "offlineExpiresAt",
  "graceUntil",
  "lastSyncAt",
]);
requireFields("SyncOfflineBatchInput", [
  "clientBatchId",
  "batchHash",
  "shifts",
  "orders",
]);
requireFields("SyncOfflineBatchPayload", ["batchId", "shifts", "orders"]);
requireFields("SyncItemResult", ["clientId", "status", "serverId", "code"]);
requireFields("CashierShift", [
  "deviceId",
  "source",
  "openedAtClient",
  "closedAtClient",
  "receivedAt",
]);
requireFields("Sale", [
  "source",
  "deviceId",
  "clientOrderId",
  "clientSeq",
  "clientCreatedAt",
  "receivedAt",
  "signatureVerified",
  "priceVariance",
  "syncBatchId",
]);
requireFields("CreateSaleItemInput", [
  "productId",
  "productUnitId",
  "qty",
  "unitPrice",
]);
requireFields("ReceiveStockItemInput", [
  "productId",
  "productUnitId",
  "qty",
  "unitCost",
]);
requireFields("SyncOrderItemInput", [
  "productId",
  "productUnitId",
  "qty",
  "unitPrice",
]);
requireFields("PageInput", ["page", "pageSize"]);
requireFields("PageInfo", ["page", "pageSize", "total", "totalPages"]);
requireFields("SortInput", ["field", "direction"]);
requireFields("DateRangeInput", ["from", "to"]);

const requiredEnums = {
  DevicePlatform: ["ANDROID", "TAURI"],
  DeviceStatus: ["PENDING", "ACTIVE", "REVOKED"],
  DeviceKeyStatus: ["ACTIVE", "RETIRED", "REVOKED"],
  ShiftSource: ["ONLINE", "OFFLINE"],
  SaleSource: ["ONLINE", "OFFLINE", "GRACE"],
  SyncItemStatus: ["ACCEPTED", "DUPLICATE", "FLAGGED", "REJECTED"],
  UserRole: ["OWNER", "ADMIN", "CASHIER", "WAREHOUSE"],
};
for (const [name, values] of Object.entries(requiredEnums)) {
  const type = schema.getType(name);
  if (!type || !isEnumType(type)) {
    errors.push(`missing enum ${name}`);
    continue;
  }
  const actual = type.getValues().map((value) => value.name);
  for (const value of values) {
    if (!actual.includes(value))
      errors.push(`enum ${name} is missing value ${value}`);
  }
}

for (const type of Object.values(schema.getTypeMap())) {
  if (type.name.startsWith("__")) continue;
  if (isObjectType(type) || isInputObjectType(type)) {
    for (const field of Object.values(type.getFields())) {
      if (getNamedType(field.type) === GraphQLFloat) {
        errors.push(
          `${type.name}.${field.name} uses Float; money and quantities must be String`,
        );
      }
      for (const arg of field.args ?? []) {
        if (getNamedType(arg.type) === GraphQLFloat) {
          errors.push(`${type.name}.${field.name}(${arg.name}:) uses Float`);
        }
      }
    }
    if (isObjectType(type) && type.name.endsWith("Page")) {
      const fields = type.getFields();
      if (!fields.items || !fields.pageInfo) {
        errors.push(`${type.name} must expose { items, pageInfo }`);
      }
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`check-schema: ${error}`);
  console.error(`check-schema: FAILED with ${errors.length} error(s)`);
  process.exit(1);
}

console.log(
  `check-schema: OK — ${requiredQueries.length} queries, ${requiredMutations.length} mutations, ` +
    `${Object.keys(schema.getTypeMap()).filter((name) => !name.startsWith("__")).length} types, no tenant fields, no Float`,
);
