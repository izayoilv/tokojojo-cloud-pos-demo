export const PERMISSIONS = [
  "catalog:read",
  "catalog:write",
  "customers:read",
  "customers:write",
  "suppliers:read",
  "suppliers:write",
  "stock:read",
  "stock:receive",
  "stock:adjust",
  "stock:transfer",
  "stock:opname",
  "stock:opname:review",
  "purchases:read",
  "purchases:write",
  "purchases:pay",
  "sales:read",
  "sales:create",
  "sales:discount",
  "sales:return",
  "sales:void",
  "shifts:read",
  "shifts:write",
  "finance:read",
  "finance:write",
  "reports:read",
  "dashboard:read",
  "users:read",
  "users:manage",
  "audit:read",
  "settings:read",
  "settings:write",
  "devices:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type Role = "OWNER" | "ADMIN" | "CASHIER" | "WAREHOUSE";

export type Policy =
  | { kind: "public" }
  | { kind: "authenticated" }
  | { kind: "permission"; permission: Permission }
  | { kind: "device" }
  | { kind: "deviceSelf" }
  | { kind: "selfOrAdmin" };

const ALL_PERMISSIONS = new Set<Permission>(PERMISSIONS);

const CASHIER_PERMISSIONS = new Set<Permission>([
  "catalog:read",
  "customers:read",
  "customers:write",
  "stock:read",
  "sales:read",
  "sales:create",
  "shifts:read",
  "shifts:write",
  "dashboard:read",
  "settings:read",
]);

const WAREHOUSE_PERMISSIONS = new Set<Permission>([
  "catalog:read",
  "suppliers:read",
  "suppliers:write",
  "stock:read",
  "stock:receive",
  "stock:adjust",
  "stock:transfer",
  "stock:opname",
  "purchases:read",
  "purchases:write",
  "purchases:pay",
  "dashboard:read",
  "settings:read",
]);

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS,
  CASHIER: CASHIER_PERMISSIONS,
  WAREHOUSE: WAREHOUSE_PERMISSIONS,
};

const permission = (value: Permission): Policy => ({
  kind: "permission",
  permission: value,
});

export const OPERATION_POLICIES = {
  me: { kind: "authenticated" },
  device: { kind: "selfOrAdmin" },
  devices: permission("devices:manage"),
  sessions: permission("devices:manage"),
  syncStatus: { kind: "authenticated" },
  products: permission("catalog:read"),
  product: permission("catalog:read"),
  categories: permission("catalog:read"),
  suppliers: permission("suppliers:read"),
  supplier: permission("suppliers:read"),
  customers: permission("customers:read"),
  customer: permission("customers:read"),
  catalogSync: permission("catalog:read"),
  stockBalances: permission("stock:read"),
  stockMovements: permission("stock:read"),
  lowStockProducts: permission("stock:read"),
  stockSummary: permission("stock:read"),
  transfers: permission("stock:read"),
  transfer: permission("stock:read"),
  opnames: permission("stock:read"),
  opname: permission("stock:read"),
  purchases: permission("purchases:read"),
  purchase: permission("purchases:read"),
  payables: permission("purchases:read"),
  sales: permission("sales:read"),
  sale: permission("sales:read"),
  receivables: permission("sales:read"),
  shifts: permission("shifts:read"),
  shift: permission("shifts:read"),
  currentShift: permission("shifts:read"),
  cashFlows: permission("finance:read"),
  dashboardSummary: permission("dashboard:read"),
  salesReport: permission("reports:read"),
  inventoryReport: permission("reports:read"),
  financeReport: permission("reports:read"),
  users: permission("users:read"),
  user: permission("users:read"),
  auditEvents: permission("audit:read"),
  storeSettings: permission("settings:read"),
  receiptSettings: permission("settings:read"),

  login: { kind: "public" },
  refresh: { kind: "device" },
  logout: { kind: "authenticated" },
  enrollDevice: { kind: "public" },
  approveDevice: permission("devices:manage"),
  revokeDevice: permission("devices:manage"),
  rotateDeviceKey: { kind: "deviceSelf" },
  upgradeOfflineSession: { kind: "device" },
  revokeSession: permission("devices:manage"),
  createProduct: permission("catalog:write"),
  updateProduct: permission("catalog:write"),
  setProductActive: permission("catalog:write"),
  createCategory: permission("catalog:write"),
  updateCategory: permission("catalog:write"),
  createSupplier: permission("suppliers:write"),
  updateSupplier: permission("suppliers:write"),
  setSupplierActive: permission("suppliers:write"),
  createCustomer: permission("customers:write"),
  updateCustomer: permission("customers:write"),
  setCustomerActive: permission("customers:write"),
  receiveStock: permission("stock:receive"),
  adjustStock: permission("stock:adjust"),
  createTransfer: permission("stock:transfer"),
  completeTransfer: permission("stock:transfer"),
  cancelTransfer: permission("stock:transfer"),
  createOpname: permission("stock:opname"),
  updateOpname: permission("stock:opname"),
  submitOpname: permission("stock:opname"),
  approveOpname: permission("stock:opname:review"),
  rejectOpname: permission("stock:opname:review"),
  createPurchase: permission("purchases:write"),
  cancelPurchase: permission("purchases:write"),
  addPurchasePayment: permission("purchases:pay"),
  createSale: permission("sales:create"),
  createSaleReturn: permission("sales:return"),
  voidSale: permission("sales:void"),
  openShift: permission("shifts:write"),
  closeShift: permission("shifts:write"),
  createCashFlow: permission("finance:write"),
  createUser: permission("users:manage"),
  updateUser: permission("users:manage"),
  setUserActive: permission("users:manage"),
  resetUserPassword: permission("users:manage"),
  updateStoreSettings: permission("settings:write"),
  updateReceiptSettings: permission("settings:write"),
  syncOfflineBatch: { kind: "device" },
} satisfies Record<string, Policy>;

export const WEB_SESSION_ONLY_OPERATIONS = new Set([
  "users",
  "user",
  "auditEvents",
  "salesReport",
  "inventoryReport",
  "financeReport",
  "cashFlows",
  "createCashFlow",
  "devices",
  "sessions",
  "approveDevice",
  "revokeDevice",
  "revokeSession",
  "createUser",
  "updateUser",
  "setUserActive",
  "resetUserPassword",
  "updateStoreSettings",
  "updateReceiptSettings",
]);

export function hasPermission(role: Role, value: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(value);
}

export function policyForOperation(operation: string): Policy | undefined {
  return OPERATION_POLICIES[operation as keyof typeof OPERATION_POLICIES];
}

export function isWebSessionOnly(operation: string): boolean {
  return WEB_SESSION_ONLY_OPERATIONS.has(operation);
}

export type UserManagementAction =
  "create" | "update" | "deactivate" | "resetPassword";

export function canManageUser(
  actorRole: Role,
  targetRole: Role,
  action: UserManagementAction,
): boolean {
  void action;
  if (actorRole === "OWNER") return true;
  if (actorRole !== "ADMIN") return false;
  return targetRole !== "OWNER";
}
