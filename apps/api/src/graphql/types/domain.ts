import { builder } from "../builder.ts";

export const StockLocationEnum = builder.enumType("StockLocation", {
  values: ["WAREHOUSE", "STORE"] as const,
});

export const StockStatusEnum = builder.enumType("StockStatus", {
  values: ["OK", "LOW", "OUT"] as const,
});

export const StockMovementTypeEnum = builder.enumType("StockMovementType", {
  values: [
    "PURCHASE",
    "PURCHASE_CANCEL",
    "SALE",
    "TRANSFER_OUT",
    "TRANSFER_IN",
    "OPNAME",
    "RETURN",
    "SALE_VOID",
    "ADJUSTMENT",
  ] as const,
});

export const MovementReferenceTypeEnum = builder.enumType(
  "MovementReferenceType",
  {
    values: [
      "PURCHASE",
      "SALE",
      "TRANSFER",
      "OPNAME",
      "RETURN",
      "MANUAL",
    ] as const,
  },
);

export const TransferStatusEnum = builder.enumType("TransferStatus", {
  values: ["PENDING", "COMPLETED", "CANCELLED"] as const,
});

export const OpnameStatusEnum = builder.enumType("OpnameStatus", {
  values: ["PENDING", "APPROVED", "REJECTED"] as const,
});

export const PaymentMethodEnum = builder.enumType("PaymentMethod", {
  values: ["CASH", "QRIS", "TRANSFER", "DEBIT"] as const,
});

export const PaymentStatusEnum = builder.enumType("PaymentStatus", {
  values: ["PAID", "PARTIAL", "UNPAID"] as const,
});

export const PurchaseStatusEnum = builder.enumType("PurchaseStatus", {
  values: ["OPEN", "CANCELLED"] as const,
});

export const CatalogEntityTypeEnum = builder.enumType("CatalogEntityType", {
  values: ["PRODUCT", "CATEGORY", "SUPPLIER"] as const,
});

export const ShiftStatusEnum = builder.enumType("ShiftStatus", {
  values: ["OPEN", "CLOSED"] as const,
});

export const ShiftSourceEnum = builder.enumType("ShiftSource", {
  values: ["ONLINE", "OFFLINE"] as const,
});

export const SaleStatusEnum = builder.enumType("SaleStatus", {
  values: ["COMPLETED", "VOIDED"] as const,
});

export const SaleSettlementEnum = builder.enumType("SaleSettlement", {
  values: ["CASH", "QRIS", "TRANSFER", "DEBIT", "MIXED", "DEBT"] as const,
});

export const SaleSourceEnum = builder.enumType("SaleSource", {
  values: ["ONLINE", "OFFLINE", "GRACE"] as const,
});

export const CashFlowTypeEnum = builder.enumType("CashFlowType", {
  values: ["IN", "OUT"] as const,
});

export const CashFlowCategoryEnum = builder.enumType("CashFlowCategory", {
  values: [
    "SALES",
    "DEBT_PAYMENT",
    "REFUND",
    "PURCHASE",
    "EXPENSE",
    "CAPITAL",
    "OTHER",
  ] as const,
});

export const CashFlowSourceEnum = builder.enumType("CashFlowSource", {
  values: ["AUTO", "MANUAL"] as const,
});

export const CashFlowReferenceTypeEnum = builder.enumType(
  "CashFlowReferenceType",
  {
    values: [
      "SALE_PAYMENT",
      "PURCHASE_PAYMENT",
      "SALE_RETURN",
      "PURCHASE_CANCEL",
      "MANUAL",
    ] as const,
  },
);

export const SyncItemStatusEnum = builder.enumType("SyncItemStatus", {
  values: ["ACCEPTED", "DUPLICATE", "FLAGGED", "REJECTED"] as const,
});

export const ReceiptPaperSizeEnum = builder.enumType("ReceiptPaperSize", {
  values: ["MM58", "MM80"] as const,
});

export const SalesReportGroupByEnum = builder.enumType("SalesReportGroupBy", {
  values: ["DAY", "PRODUCT", "CASHIER"] as const,
});
