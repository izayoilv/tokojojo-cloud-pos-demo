import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { receiptPaperSizeEnum, stockLocationEnum } from "./enums.ts";
import { users } from "./identity.ts";

export const storeSettings = pgTable(
  "store_settings",
  {
    id: boolean("id").primaryKey().default(true),
    storeName: text("store_name").notNull(),
    tagline: text("tagline"),
    address: text("address"),
    city: text("city"),
    phone: text("phone"),
    npwp: text("npwp"),
    defaultLocation: stockLocationEnum("default_location")
      .notNull()
      .default("STORE"),
    lowStockGuidance: text("low_stock_guidance"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    check("store_settings_singleton", sql`${table.id} = true`),
    check(
      "store_settings_name_not_blank",
      sql`btrim(${table.storeName}) <> ''`,
    ),
  ],
);

export const receiptSettings = pgTable(
  "receipt_settings",
  {
    id: boolean("id").primaryKey().default(true),
    paperSize: receiptPaperSizeEnum("paper_size").notNull().default("MM80"),
    showPrice: boolean("show_price").notNull().default(true),
    footerText: text("footer_text"),
    autoPrint: boolean("auto_print").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [check("receipt_settings_singleton", sql`${table.id} = true`)],
);
