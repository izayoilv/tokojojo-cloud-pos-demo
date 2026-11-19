import { sql } from "drizzle-orm";
import {
  check,
  decimal,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants.js";

export const cashFlowTypeEnum = pgEnum("cash_flow_type", ["IN", "OUT"]);
export const walletSourceEnum = pgEnum("wallet_source", [
  "CASH_DRAWER",
  "QRIS_BALANCE",
]);
export const cashCategoryEnum = pgEnum("cash_category", [
  "SALES",
  "DEBT_PAYMENT",
  "CAPITAL_IN",
  "RESTOCK",
  "SALARY",
  "OPERATIONAL",
  "QRIS_WITHDRAWAL",
]);

export const cashFlows = pgTable(
  "cash_flows",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: cashFlowTypeEnum("type").notNull(),
    walletSource: walletSourceEnum("wallet_source").notNull(),
    category: cashCategoryEnum("category").notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    referenceId: uuid("reference_id"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("cash_flows_tenant_date_idx").on(t.tenantId, t.createdAt),
    index("cash_flows_reference_idx").on(t.referenceId),
    check("cash_flows_amount_positive", sql`${t.amount} > 0`),
  ],
);
