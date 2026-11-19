import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  decimal,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants.js";

export const categories = pgTable(
  "categories",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("categories_tenant_name_uq").on(t.tenantId, t.name)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    baseUnit: text("base_unit").notNull(),
    currentStock: decimal("current_stock", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    baseCostPrice: decimal("base_cost_price", {
      precision: 14,
      scale: 2,
    }).notNull(),
    minStockAlert: decimal("min_stock_alert", { precision: 12, scale: 2 })
      .notNull()
      .default("5"),
    active: boolean("active").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("products_tenant_idx").on(t.tenantId),
    index("products_tenant_category_idx").on(t.tenantId, t.categoryId),
    check("products_base_cost_price_nonnegative", sql`${t.baseCostPrice} >= 0`),
    check("products_min_stock_alert_nonnegative", sql`${t.minStockAlert} >= 0`),
  ],
);

export const productUnits = pgTable(
  "product_units",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    unitName: text("unit_name").notNull(),
    conversionQty: decimal("conversion_qty", {
      precision: 12,
      scale: 2,
    }).notNull(),
    sellingPrice: decimal("selling_price", {
      precision: 14,
      scale: 2,
    }).notNull(),
    barcode: text("barcode"),
  },
  (t) => [
    uniqueIndex("product_units_barcode_uq")
      .on(t.tenantId, t.barcode)
      .where(sql`${t.barcode} IS NOT NULL`),
    uniqueIndex("product_units_tenant_product_name_uq").on(
      t.tenantId,
      t.productId,
      t.unitName,
    ),
    index("product_units_product_idx").on(t.productId),
    check("product_units_conversion_qty_positive", sql`${t.conversionQty} > 0`),
    check(
      "product_units_selling_price_nonnegative",
      sql`${t.sellingPrice} >= 0`,
    ),
  ],
);
