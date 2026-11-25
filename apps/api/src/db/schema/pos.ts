import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { productUnits } from "./catalog.ts";
import { devices } from "./devices.ts";
import {
  paymentMethodEnum,
  saleSettlementEnum,
  saleSourceEnum,
  saleStatusEnum,
  shiftSourceEnum,
  shiftStatusEnum,
} from "./enums.ts";
import { customers, users } from "./identity.ts";
import { syncBatches } from "./sync.ts";

export const cashierShifts = pgTable(
  "cashier_shifts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: shiftStatusEnum("status").notNull().default("OPEN"),
    openedAt: timestamp("opened_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    openingCash: bigint("opening_cash", { mode: "number" })
      .notNull()
      .default(0),
    expectedCash: bigint("expected_cash", { mode: "number" }),
    actualCash: bigint("actual_cash", { mode: "number" }),
    deviceId: uuid("device_id").references(() => devices.id, {
      onDelete: "restrict",
    }),
    source: shiftSourceEnum("source").notNull().default("ONLINE"),
    openedAtClient: timestamp("opened_at_client", { withTimezone: true }),
    closedAtClient: timestamp("closed_at_client", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cashier_shifts_user_id_status_idx").on(table.userId, table.status),
    uniqueIndex("cashier_shifts_open_per_user_unique")
      .on(table.userId)
      .where(sql`${table.status} = 'OPEN'`),
    check(
      "cashier_shifts_opening_cash_non_negative",
      sql`${table.openingCash} >= 0`,
    ),
    check(
      "cashier_shifts_actual_cash_non_negative",
      sql`${table.actualCash} >= 0`,
    ),
    check(
      "cashier_shifts_close_fields_consistent",
      sql`(${table.status} = 'OPEN'
          AND ${table.closedAt} IS NULL
          AND ${table.expectedCash} IS NULL
          AND ${table.actualCash} IS NULL)
        OR (${table.status} = 'CLOSED'
          AND ${table.closedAt} IS NOT NULL
          AND ${table.expectedCash} IS NOT NULL
          AND ${table.actualCash} IS NOT NULL)`,
    ),
    check(
      "cashier_shifts_offline_fields_required",
      sql`${table.source} <> 'OFFLINE'
        OR (${table.deviceId} IS NOT NULL
          AND ${table.openedAtClient} IS NOT NULL)`,
    ),
    check(
      "cashier_shifts_offline_close_requires_client",
      sql`${table.source} <> 'OFFLINE'
        OR ${table.status} <> 'CLOSED'
        OR ${table.closedAtClient} IS NOT NULL`,
    ),
  ],
);

export const sales = pgTable(
  "sales",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    invoiceNo: text("invoice_no").notNull().unique(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => cashierShifts.id, {
        onDelete: "restrict",
      }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "restrict",
    }),
    subtotal: bigint("subtotal", { mode: "number" }).notNull(),
    discount: bigint("discount", { mode: "number" }).notNull().default(0),
    totalAmount: bigint("total_amount", { mode: "number" }).notNull(),
    settlementMethod: saleSettlementEnum("settlement_method").notNull(),
    status: saleStatusEnum("status").notNull().default("COMPLETED"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    voidReason: text("void_reason"),
    source: saleSourceEnum("source").notNull().default("ONLINE"),
    deviceId: uuid("device_id").references(() => devices.id, {
      onDelete: "restrict",
    }),
    clientOrderId: uuid("client_order_id"),
    clientSeq: bigint("client_seq", { mode: "number" }),
    clientCreatedAt: timestamp("client_created_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    signatureVerified: boolean("signature_verified").notNull().default(false),
    priceVariance: bigint("price_variance", { mode: "number" })
      .notNull()
      .default(0),
    syncBatchId: uuid("sync_batch_id").references(() => syncBatches.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sales_created_at_idx").on(table.createdAt),
    index("sales_shift_id_idx").on(table.shiftId),
    index("sales_customer_id_idx").on(table.customerId),
    index("sales_settlement_method_idx").on(table.settlementMethod),
    index("sales_status_idx").on(table.status),
    uniqueIndex("sales_device_client_order_unique")
      .on(table.deviceId, table.clientOrderId)
      .where(sql`${table.clientOrderId} IS NOT NULL`),
    index("sales_device_id_client_seq_idx").on(table.deviceId, table.clientSeq),
    index("sales_sync_batch_id_idx").on(table.syncBatchId),
    check("sales_invoice_no_not_blank", sql`btrim(${table.invoiceNo}) <> ''`),
    check("sales_subtotal_non_negative", sql`${table.subtotal} >= 0`),
    check("sales_discount_non_negative", sql`${table.discount} >= 0`),
    check(
      "sales_discount_within_subtotal",
      sql`${table.discount} <= ${table.subtotal}`,
    ),
    check(
      "sales_total_matches_subtotal_discount",
      sql`${table.totalAmount} = ${table.subtotal} - ${table.discount}`,
    ),
    check(
      "sales_debt_requires_customer",
      sql`${table.settlementMethod} <> 'DEBT' OR ${table.customerId} IS NOT NULL`,
    ),
    check(
      "sales_void_fields_consistent",
      sql`(${table.status} = 'COMPLETED'
          AND ${table.voidedAt} IS NULL
          AND ${table.voidedBy} IS NULL
          AND ${table.voidReason} IS NULL)
        OR (${table.status} = 'VOIDED'
          AND ${table.voidedAt} IS NOT NULL
          AND ${table.voidedBy} IS NOT NULL
          AND ${table.voidReason} IS NOT NULL)`,
    ),
    check(
      "sales_offline_fields_required",
      sql`${table.source} = 'ONLINE'
        OR (${table.deviceId} IS NOT NULL
          AND ${table.clientOrderId} IS NOT NULL
          AND ${table.clientSeq} IS NOT NULL
          AND ${table.clientCreatedAt} IS NOT NULL)`,
    ),
    check(
      "sales_client_seq_non_negative",
      sql`${table.clientSeq} IS NULL OR ${table.clientSeq} >= 0`,
    ),
    check(
      "sales_client_order_requires_device",
      sql`${table.clientOrderId} IS NULL OR ${table.deviceId} IS NOT NULL`,
    ),
  ],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "restrict" }),
    productId: uuid("product_id").notNull(),
    productUnitId: uuid("product_unit_id").notNull(),
    productName: text("product_name").notNull(),
    unitName: text("unit_name").notNull(),
    qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
    qtyBase: numeric("qty_base", { precision: 12, scale: 3 }).notNull(),
    unitPrice: bigint("unit_price", { mode: "number" }).notNull(),
    discount: bigint("discount", { mode: "number" }).notNull().default(0),
    unitCost: bigint("unit_cost", { mode: "number" }).notNull(),
    subtotal: bigint("subtotal", { mode: "number" }).notNull(),
  },
  (table) => [
    index("sale_items_sale_id_idx").on(table.saleId),
    index("sale_items_product_id_idx").on(table.productId),
    foreignKey({
      name: "sale_items_product_unit_fk",
      columns: [table.productId, table.productUnitId],
      foreignColumns: [productUnits.productId, productUnits.id],
    }).onDelete("restrict"),
    check("sale_items_qty_positive", sql`${table.qty} > 0`),
    check("sale_items_qty_base_positive", sql`${table.qtyBase} > 0`),
    check(
      "sale_items_product_name_not_blank",
      sql`btrim(${table.productName}) <> ''`,
    ),
    check(
      "sale_items_unit_name_not_blank",
      sql`btrim(${table.unitName}) <> ''`,
    ),
    check("sale_items_unit_price_non_negative", sql`${table.unitPrice} >= 0`),
    check("sale_items_discount_non_negative", sql`${table.discount} >= 0`),
    check(
      "sale_items_discount_within_unit_price",
      sql`${table.discount} <= ${table.unitPrice}`,
    ),
    check("sale_items_unit_cost_non_negative", sql`${table.unitCost} >= 0`),
    check(
      "sale_items_subtotal_matches_qty_price",
      sql`${table.subtotal} = ROUND(${table.qty} * ${table.unitPrice})::bigint`,
    ),
  ],
);

export const salePayments = pgTable(
  "sale_payments",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "restrict" }),
    method: paymentMethodEnum("method").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    cashReceived: bigint("cash_received", { mode: "number" })
      .notNull()
      .default(0),
    change: bigint("change", { mode: "number" }).notNull().default(0),
    shiftId: uuid("shift_id").references(() => cashierShifts.id, {
      onDelete: "restrict",
    }),
    receivedBy: uuid("received_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    paymentRef: text("payment_ref"),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sale_payments_sale_id_paid_at_idx").on(table.saleId, table.paidAt),
    index("sale_payments_shift_id_idx").on(table.shiftId),
    index("sale_payments_paid_at_idx").on(table.paidAt),
    check("sale_payments_amount_positive", sql`${table.amount} > 0`),
    check(
      "sale_payments_cash_tender_consistent",
      sql`(${table.method} = 'CASH'
          AND ${table.cashReceived} >= ${table.amount}
          AND ${table.change} = ${table.cashReceived} - ${table.amount})
        OR (${table.method} <> 'CASH'
          AND ${table.cashReceived} = 0
          AND ${table.change} = 0)`,
    ),
    check(
      "sale_payments_non_cash_shift_null",
      sql`${table.method} = 'CASH' OR ${table.shiftId} IS NULL`,
    ),
  ],
);

export const saleReturns = pgTable(
  "sale_returns",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    returnNo: text("return_no").notNull().unique(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    totalRefund: bigint("total_refund", { mode: "number" }).notNull(),
    cashRefund: bigint("cash_refund", { mode: "number" }).notNull().default(0),
    refundMethod: paymentMethodEnum("refund_method"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    shiftId: uuid("shift_id").references(() => cashierShifts.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sale_returns_sale_id_created_at_idx").on(
      table.saleId,
      table.createdAt,
    ),
    index("sale_returns_shift_id_idx").on(table.shiftId),
    check(
      "sale_returns_return_no_not_blank",
      sql`btrim(${table.returnNo}) <> ''`,
    ),
    check("sale_returns_reason_not_blank", sql`btrim(${table.reason}) <> ''`),
    check("sale_returns_total_refund_positive", sql`${table.totalRefund} > 0`),
    check(
      "sale_returns_cash_refund_non_negative",
      sql`${table.cashRefund} >= 0`,
    ),
    check(
      "sale_returns_cash_refund_within_total",
      sql`${table.cashRefund} <= ${table.totalRefund}`,
    ),
    check(
      "sale_returns_refund_fields_consistent",
      sql`(${table.cashRefund} = 0
          AND ${table.refundMethod} IS NULL
          AND ${table.refundedAt} IS NULL
          AND ${table.shiftId} IS NULL)
        OR (${table.cashRefund} > 0
          AND ${table.refundMethod} IS NOT NULL
          AND ${table.refundedAt} IS NOT NULL)`,
    ),
    check(
      "sale_returns_cash_refund_requires_shift",
      sql`${table.refundMethod} IS DISTINCT FROM 'CASH'
        OR ${table.shiftId} IS NOT NULL`,
    ),
  ],
);

export const saleReturnItems = pgTable(
  "sale_return_items",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    returnId: uuid("return_id")
      .notNull()
      .references(() => saleReturns.id, { onDelete: "restrict" }),
    saleItemId: uuid("sale_item_id")
      .notNull()
      .references(() => saleItems.id, { onDelete: "restrict" }),
    qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
    qtyBase: numeric("qty_base", { precision: 12, scale: 3 }).notNull(),
    refundAmount: bigint("refund_amount", { mode: "number" }).notNull(),
  },
  (table) => [
    index("sale_return_items_return_id_idx").on(table.returnId),
    index("sale_return_items_sale_item_id_idx").on(table.saleItemId),
    check("sale_return_items_qty_positive", sql`${table.qty} > 0`),
    check("sale_return_items_qty_base_positive", sql`${table.qtyBase} > 0`),
    check(
      "sale_return_items_refund_amount_non_negative",
      sql`${table.refundAmount} >= 0`,
    ),
  ],
);
