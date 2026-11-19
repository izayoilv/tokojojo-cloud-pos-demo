import { sql } from "drizzle-orm";
import {
  check,
  decimal,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { devices, users } from "./auth.js";
import { products, productUnits } from "./catalog.js";
import { tenants } from "./tenants.js";

export const customerTable = pgTable(
  "customers",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    addressNote: text("address_note"),
    totalDebt: decimal("total_debt", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
  },
  (t) => [
    index("customers_tenant_idx").on(t.tenantId),
    index("customers_tenant_name_idx").on(t.tenantId, t.name),
  ],
);

export const paymentMethodEnum = pgEnum("payment_method", [
  "CASH",
  "QRIS",
  "DEBT",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "PAID",
  "PARTIAL",
  "UNPAID",
]);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    deviceId: uuid("device_id").references(() => devices.id, {
      onDelete: "restrict",
    }),
    clientOrderId: uuid("client_order_id"),

    invoiceNo: text("invoice_no").notNull(),
    customerId: uuid("customer_id").references(() => customerTable.id, {
      onDelete: "restrict",
    }),

    subtotal: decimal("subtotal", { precision: 14, scale: 2 }).notNull(),
    discount: decimal("discount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    totalAmount: decimal("total_amount", { precision: 14, scale: 2 }).notNull(),

    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    paymentStatus: paymentStatusEnum("payment_status").notNull(),
    amountPaid: decimal("amount_paid", { precision: 14, scale: 2 }).notNull(),
    cashReceived: decimal("cash_received", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    changeAmount: decimal("change_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("transactions_tenant_invoice_uq").on(t.tenantId, t.invoiceNo),
    uniqueIndex("transactions_tenant_device_client_uq")
      .on(t.tenantId, t.deviceId, t.clientOrderId)
      .where(sql`${t.clientOrderId} IS NOT NULL`),
    index("transactions_tenant_date_idx").on(t.tenantId, t.createdAt),
    index("transactions_customer_idx").on(t.customerId),
    index("transactions_device_idx").on(t.deviceId),
    index("transactions_user_idx").on(t.userId),
    check(
      "transactions_amounts_nonnegative",
      sql`${t.subtotal} >= 0 AND ${t.discount} >= 0 AND ${t.totalAmount} >= 0 AND ${t.amountPaid} >= 0 AND ${t.cashReceived} >= 0 AND ${t.changeAmount} >= 0`,
    ),
    check(
      "transactions_discount_lte_subtotal",
      sql`${t.discount} <= ${t.subtotal}`,
    ),
    check(
      "transactions_total_matches",
      sql`${t.totalAmount} = ${t.subtotal} - ${t.discount}`,
    ),
    check(
      "transactions_debt_requires_customer",
      sql`${t.paymentMethod} <> 'DEBT' OR ${t.customerId} IS NOT NULL`,
    ),
    check(
      "transactions_client_order_requires_device",
      sql`${t.clientOrderId} IS NULL OR ${t.deviceId} IS NOT NULL`,
    ),
    check(
      "transactions_status_amount_consistent",
      sql`(${t.paymentStatus} = 'PAID' AND ${t.amountPaid} >= ${t.totalAmount}) OR (${t.paymentStatus} = 'PARTIAL' AND ${t.amountPaid} > 0 AND ${t.amountPaid} < ${t.totalAmount}) OR (${t.paymentStatus} = 'UNPAID' AND ${t.amountPaid} = 0)`,
    ),
    check(
      "transactions_cash_consistent",
      sql`${t.paymentMethod} <> 'CASH' OR (${t.amountPaid} = ${t.totalAmount} AND ${t.cashReceived} >= ${t.totalAmount} AND ${t.changeAmount} = ${t.cashReceived} - ${t.totalAmount})`,
    ),
    check(
      "transactions_qris_consistent",
      sql`${t.paymentMethod} <> 'QRIS' OR (${t.amountPaid} = ${t.totalAmount} AND ${t.cashReceived} = 0 AND ${t.changeAmount} = 0)`,
    ),
    check(
      "transactions_debt_amount_lte_total",
      sql`${t.paymentMethod} <> 'DEBT' OR (${t.customerId} IS NOT NULL AND ${t.amountPaid} <= ${t.totalAmount})`,
    ),
  ],
);

export const transactionItems = pgTable(
  "transaction_items",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productUnitId: uuid("product_unit_id")
      .notNull()
      .references(() => productUnits.id, { onDelete: "restrict" }),
    qty: decimal("qty", { precision: 12, scale: 2 }).notNull(),
    unitPrice: decimal("unit_price", { precision: 14, scale: 2 }).notNull(),
    subtotal: decimal("subtotal", { precision: 14, scale: 2 }).notNull(),
  },
  (t) => [
    index("transaction_items_transaction_idx").on(t.transactionId),
    index("transaction_items_product_idx").on(t.productId),
    index("transaction_items_product_unit_idx").on(t.productUnitId),
    check("transaction_items_qty_positive", sql`${t.qty} > 0`),
    check("transaction_items_unit_price_nonnegative", sql`${t.unitPrice} >= 0`),
    check("transaction_items_subtotal_nonnegative", sql`${t.subtotal} >= 0`),
    check(
      "transaction_items_subtotal_matches",
      sql`${t.subtotal} = ${t.qty} * ${t.unitPrice}`,
    ),
  ],
);

export const debtPayments = pgTable(
  "debt_payments",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customerTable.id, { onDelete: "restrict" }),
    amountPaid: decimal("amount_paid", { precision: 14, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("debt_payments_transaction_idx").on(t.transactionId),
    index("debt_payments_customer_created_idx").on(t.customerId, t.createdAt),
    check("debt_payments_amount_positive", sql`${t.amountPaid} > 0`),
    check("debt_payments_method_not_debt", sql`${t.paymentMethod} <> 'DEBT'`),
  ],
);
