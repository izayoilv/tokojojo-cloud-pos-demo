import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { stockLocationEnum } from "./enums.ts";

export const categories = pgTable(
  "categories",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    name: text("name").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("categories_name_not_blank", sql`btrim(${table.name}) <> ''`),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    baseUnit: text("base_unit").notNull(),
    avgCost: bigint("avg_cost", { mode: "number" }).notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("products_category_id_idx").on(table.categoryId),
    index("products_name_idx").on(table.name),
    check("products_sku_not_blank", sql`btrim(${table.sku}) <> ''`),
    check("products_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check("products_base_unit_not_blank", sql`btrim(${table.baseUnit}) <> ''`),
    check("products_avg_cost_non_negative", sql`${table.avgCost} >= 0`),
  ],
);

export const productUnits = pgTable(
  "product_units",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    unitName: text("unit_name").notNull(),
    conversionQty: numeric("conversion_qty", {
      precision: 12,
      scale: 3,
    }).notNull(),
    sellingPrice: bigint("selling_price", { mode: "number" }).notNull(),
    barcode: text("barcode"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("product_units_product_id_idx").on(table.productId),
    uniqueIndex("product_units_product_id_unit_name_unique").on(
      table.productId,
      table.unitName,
    ),
    uniqueIndex("product_units_product_id_id_unique").on(
      table.productId,
      table.id,
    ),
    uniqueIndex("product_units_barcode_unique")
      .on(table.barcode)
      .where(sql`${table.barcode} is not null`),
    check(
      "product_units_conversion_qty_positive",
      sql`${table.conversionQty} > 0`,
    ),
    check(
      "product_units_selling_price_non_negative",
      sql`${table.sellingPrice} >= 0`,
    ),
    check(
      "product_units_unit_name_not_blank",
      sql`btrim(${table.unitName}) <> ''`,
    ),
  ],
);

export const productStockThresholds = pgTable(
  "product_stock_thresholds",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    location: stockLocationEnum("location").notNull(),
    minQty: numeric("min_qty", { precision: 12, scale: 3 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.location] }),
    check(
      "product_stock_thresholds_min_qty_non_negative",
      sql`${table.minQty} >= 0`,
    ),
  ],
);
