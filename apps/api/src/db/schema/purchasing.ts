import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { productUnits } from "./catalog.ts";
import { paymentMethodEnum, purchaseStatusEnum } from "./enums.ts";
import { users } from "./identity.ts";
import { suppliers } from "./suppliers.ts";

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    purchaseNo: text("purchase_no").notNull().unique(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    supplierName: text("supplier_name").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    supplierInvoiceNo: text("supplier_invoice_no"),
    dueDate: date("due_date"),
    totalAmount: bigint("total_amount", { mode: "number" }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: purchaseStatusEnum("status").notNull().default("OPEN"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("purchases_supplier_id_created_at_idx").on(
      table.supplierId,
      table.createdAt,
    ),
    index("purchases_created_at_idx").on(table.createdAt),
    check(
      "purchases_supplier_name_not_blank",
      sql`btrim(${table.supplierName}) <> ''`,
    ),
    check(
      "purchases_purchase_no_not_blank",
      sql`btrim(${table.purchaseNo}) <> ''`,
    ),
    check(
      "purchases_total_amount_non_negative",
      sql`${table.totalAmount} >= 0`,
    ),
  ],
);

export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "restrict" }),
    productId: uuid("product_id").notNull(),
    productUnitId: uuid("product_unit_id").notNull(),
    productName: text("product_name").notNull(),
    unitName: text("unit_name").notNull(),
    qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
    qtyBase: numeric("qty_base", { precision: 12, scale: 3 }).notNull(),
    unitCost: bigint("unit_cost", { mode: "number" }).notNull(),
    subtotal: bigint("subtotal", { mode: "number" }).notNull(),
  },
  (table) => [
    index("purchase_items_purchase_id_idx").on(table.purchaseId),
    index("purchase_items_product_id_idx").on(table.productId),
    foreignKey({
      name: "purchase_items_product_unit_fk",
      columns: [table.productId, table.productUnitId],
      foreignColumns: [productUnits.productId, productUnits.id],
    }).onDelete("restrict"),
    check("purchase_items_qty_positive", sql`${table.qty} > 0`),
    check("purchase_items_qty_base_positive", sql`${table.qtyBase} > 0`),
    check(
      "purchase_items_product_name_not_blank",
      sql`btrim(${table.productName}) <> ''`,
    ),
    check(
      "purchase_items_unit_name_not_blank",
      sql`btrim(${table.unitName}) <> ''`,
    ),
    check("purchase_items_unit_cost_non_negative", sql`${table.unitCost} >= 0`),
    check(
      "purchase_items_subtotal_matches_qty_cost",
      sql`${table.subtotal} = ROUND(${table.qty} * ${table.unitCost})::bigint`,
    ),
  ],
);

export const purchasePayments = pgTable(
  "purchase_payments",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "restrict" }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    reference: text("reference"),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
  },
  (table) => [
    index("purchase_payments_purchase_id_paid_at_idx").on(
      table.purchaseId,
      table.paidAt,
    ),
    index("purchase_payments_paid_at_idx").on(table.paidAt),
    check("purchase_payments_amount_positive", sql`${table.amount} > 0`),
  ],
);
