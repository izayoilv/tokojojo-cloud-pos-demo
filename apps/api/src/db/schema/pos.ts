import { sql } from "drizzle-orm";
import {
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

export const customerTable = pgTable("customers", {
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
});

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
      onDelete: "set null",
    }),
    clientOrderId: uuid("client_order_id"),

    invoiceNo: text("invoice_no").notNull(),
    customerId: uuid("customer_id").references(() => customerTable.id, {
      onDelete: "set null",
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
  ],
);

export const transactionItems = pgTable("transaction_items", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuidv7()`),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  productUnitId: uuid("product_unit_id")
    .notNull()
    .references(() => productUnits.id, { onDelete: "restrict" }),
  qty: decimal("qty", { precision: 12, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 14, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 14, scale: 2 }).notNull(),
});

export const debtPayments = pgTable("debt_payments", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuidv7()`),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customerTable.id, { onDelete: "cascade" }),
  amountPaid: decimal("amount_paid", { precision: 14, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
