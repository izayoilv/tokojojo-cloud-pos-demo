import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { buildSchema } from "graphql";

import {
  canManageUser,
  hasPermission,
  isWebSessionOnly,
  OPERATION_POLICIES,
  policyForOperation,
  ROLE_PERMISSIONS,
  WEB_SESSION_ONLY_OPERATIONS,
} from "../src/auth/permissions.ts";

const schemaUrl = new URL(
  "../../../packages/graphql/schema.graphql",
  import.meta.url,
);
const schema = buildSchema(readFileSync(schemaUrl, "utf8"));

const queryFields = Object.keys(schema.getQueryType()?.getFields() ?? {});
const mutationFields = Object.keys(schema.getMutationType()?.getFields() ?? {});
const operations = [...queryFields, ...mutationFields].sort();
const policies = Object.keys(OPERATION_POLICIES).sort();

test("every SDL operation has exactly one RBAC policy", () => {
  assert.equal(queryFields.length, 40);
  assert.equal(mutationFields.length, 46);
  assert.equal(operations.length, 86);
  assert.deepEqual(policies, operations);
});

test("device and admin-only operations use the intended policy shape", () => {
  assert.deepEqual(policyForOperation("device"), { kind: "selfOrAdmin" });
  assert.deepEqual(policyForOperation("rotateDeviceKey"), {
    kind: "deviceSelf",
  });
  assert.deepEqual(policyForOperation("syncOfflineBatch"), { kind: "device" });
  assert.deepEqual(policyForOperation("login"), { kind: "public" });
  assert.deepEqual(policyForOperation("syncStatus"), {
    kind: "authenticated",
  });
  assert.equal(isWebSessionOnly("users"), true);
  assert.equal(isWebSessionOnly("dashboardSummary"), false);
  assert.equal(isWebSessionOnly("createSale"), false);
  for (const operation of WEB_SESSION_ONLY_OPERATIONS) {
    assert.ok(operation in OPERATION_POLICIES, operation);
  }
});

test("role matrix matches the approved UI access", () => {
  assert.equal(hasPermission("CASHIER", "sales:create"), true);
  assert.equal(hasPermission("CASHIER", "sales:discount"), false);
  assert.equal(hasPermission("CASHIER", "sales:return"), false);
  assert.equal(hasPermission("CASHIER", "customers:write"), true);
  assert.equal(hasPermission("CASHIER", "dashboard:read"), true);

  assert.equal(hasPermission("WAREHOUSE", "stock:receive"), true);
  assert.equal(hasPermission("WAREHOUSE", "stock:adjust"), true);
  assert.equal(hasPermission("WAREHOUSE", "stock:transfer"), true);
  assert.equal(hasPermission("WAREHOUSE", "stock:opname"), true);
  assert.equal(hasPermission("WAREHOUSE", "stock:opname:review"), false);
  assert.equal(hasPermission("WAREHOUSE", "dashboard:read"), true);
  assert.equal(hasPermission("WAREHOUSE", "sales:read"), false);
  assert.equal(hasPermission("WAREHOUSE", "users:read"), false);

  assert.equal(hasPermission("ADMIN", "settings:write"), true);
  assert.equal(hasPermission("ADMIN", "sales:discount"), true);
  assert.equal(hasPermission("OWNER", "settings:write"), true);
  assert.equal(ROLE_PERMISSIONS.OWNER.size, ROLE_PERMISSIONS.ADMIN.size);
});

test("ADMIN cannot create, modify, deactivate, or reset an OWNER", () => {
  assert.equal(canManageUser("ADMIN", "OWNER", "create"), false);
  assert.equal(canManageUser("ADMIN", "OWNER", "update"), false);
  assert.equal(canManageUser("ADMIN", "OWNER", "deactivate"), false);
  assert.equal(canManageUser("ADMIN", "OWNER", "resetPassword"), false);
  assert.equal(canManageUser("ADMIN", "CASHIER", "create"), true);
  assert.equal(canManageUser("ADMIN", "CASHIER", "update"), true);
  assert.equal(canManageUser("OWNER", "OWNER", "update"), true);
  assert.equal(canManageUser("CASHIER", "CASHIER", "update"), false);
});
