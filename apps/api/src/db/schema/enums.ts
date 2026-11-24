import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "OWNER",
  "ADMIN",
  "CASHIER",
  "WAREHOUSE",
]);

export const stockLocationEnum = pgEnum("stock_location", [
  "WAREHOUSE",
  "STORE",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "CASH",
  "QRIS",
  "TRANSFER",
  "DEBIT",
]);

export const saleSettlementEnum = pgEnum("sale_settlement", [
  "CASH",
  "QRIS",
  "TRANSFER",
  "DEBIT",
  "MIXED",
  "DEBT",
]);

export const purchaseStatusEnum = pgEnum("purchase_status", [
  "OPEN",
  "CANCELLED",
]);

export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "PURCHASE",
  "PURCHASE_CANCEL",
  "SALE",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "OPNAME",
  "RETURN",
  "SALE_VOID",
  "ADJUSTMENT",
]);

export const referenceTypeEnum = pgEnum("reference_type", [
  "PURCHASE",
  "SALE",
  "TRANSFER",
  "OPNAME",
  "RETURN",
  "MANUAL",
]);

export const stockTransferStatusEnum = pgEnum("stock_transfer_status", [
  "PENDING",
  "COMPLETED",
  "CANCELLED",
]);

export const opnameStatusEnum = pgEnum("opname_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const shiftStatusEnum = pgEnum("shift_status", ["OPEN", "CLOSED"]);

export const saleStatusEnum = pgEnum("sale_status", ["COMPLETED", "VOIDED"]);

export const cashFlowTypeEnum = pgEnum("cash_flow_type", ["IN", "OUT"]);

export const cashFlowCategoryEnum = pgEnum("cash_flow_category", [
  "SALES",
  "DEBT_PAYMENT",
  "REFUND",
  "PURCHASE",
  "EXPENSE",
  "CAPITAL",
  "OTHER",
]);

export const cashFlowSourceEnum = pgEnum("cash_flow_source", [
  "AUTO",
  "MANUAL",
]);

export const cashFlowReferenceTypeEnum = pgEnum("cash_flow_reference_type", [
  "SALE_PAYMENT",
  "PURCHASE_PAYMENT",
  "SALE_RETURN",
  "PURCHASE_CANCEL",
  "MANUAL",
]);
