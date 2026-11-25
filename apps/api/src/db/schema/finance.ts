import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  cashFlowCategoryEnum,
  cashFlowReferenceTypeEnum,
  cashFlowSourceEnum,
  cashFlowTypeEnum,
  paymentMethodEnum,
} from "./enums.ts";
import { users } from "./identity.ts";
import { cashierShifts } from "./pos.ts";

export const cashFlows = pgTable(
  "cash_flows",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    type: cashFlowTypeEnum("type").notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    category: cashFlowCategoryEnum("category").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    shiftId: uuid("shift_id").references(() => cashierShifts.id, {
      onDelete: "restrict",
    }),
    referenceType: cashFlowReferenceTypeEnum("reference_type").notNull(),
    referenceId: uuid("reference_id"),
    source: cashFlowSourceEnum("source").notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cash_flows_source_created_at_idx").on(table.source, table.createdAt),
    index("cash_flows_created_at_category_idx").on(
      table.createdAt,
      table.category,
    ),
    index("cash_flows_shift_id_idx").on(table.shiftId),
    index("cash_flows_reference_type_reference_id_idx").on(
      table.referenceType,
      table.referenceId,
    ),
    uniqueIndex("cash_flows_auto_reference_unique")
      .on(table.referenceType, table.referenceId, table.category, table.type)
      .where(sql`${table.source} = 'AUTO'`),
    check("cash_flows_amount_positive", sql`${table.amount} > 0`),
    check(
      "cash_flows_reference_consistency",
      sql`(${table.source} = 'MANUAL'
          AND ${table.referenceType} = 'MANUAL'
          AND ${table.referenceId} IS NULL)
        OR (${table.source} = 'AUTO'
          AND ${table.referenceType} <> 'MANUAL'
          AND ${table.referenceId} IS NOT NULL)`,
    ),
    check(
      "cash_flows_non_cash_shift_null",
      sql`${table.paymentMethod} = 'CASH' OR ${table.shiftId} IS NULL`,
    ),
  ],
);
