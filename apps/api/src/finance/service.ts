import { findUserById } from "../auth/repository.ts";
import { userRowToContextUser } from "../auth/user-mapper.ts";
import {
  type DbClient,
  getSqlClient,
  money,
  normalizePage,
  type PageInfo,
  pageInfo,
  resolveSort,
  toDate,
} from "../db/query.ts";
import type { ContextUser, RequestContext } from "../graphql/context.ts";
import { validationFailed } from "../graphql/errors.ts";

export interface CashFlowView {
  id: string;
  type: "IN" | "OUT";
  paymentMethod: "CASH" | "QRIS" | "TRANSFER" | "DEBIT";
  category:
    | "SALES"
    | "DEBT_PAYMENT"
    | "REFUND"
    | "PURCHASE"
    | "EXPENSE"
    | "CAPITAL"
    | "OTHER";
  amount: string;
  shiftId: string | null;
  referenceType:
    | "SALE_PAYMENT"
    | "PURCHASE_PAYMENT"
    | "SALE_RETURN"
    | "PURCHASE_CANCEL"
    | "MANUAL";
  referenceId: string | null;
  source: "AUTO" | "MANUAL";
  notes: string | null;
  createdBy: ContextUser;
  createdAt: Date | string;
}

export interface CashFlowPageView {
  items: CashFlowView[];
  pageInfo: PageInfo;
}

interface CashFlowRow {
  id: string;
  type: CashFlowView["type"];
  payment_method: CashFlowView["paymentMethod"];
  category: CashFlowView["category"];
  amount: string;
  shift_id: string | null;
  reference_type: CashFlowView["referenceType"];
  reference_id: string | null;
  source: CashFlowView["source"];
  notes: string | null;
  created_by: string;
  created_at: Date;
}

async function buildCashFlow(row: CashFlowRow): Promise<CashFlowView | null> {
  const user = await findUserById(row.created_by);
  if (!user) return null;
  return {
    id: row.id,
    type: row.type,
    paymentMethod: row.payment_method,
    category: row.category,
    amount: money(row.amount),
    shiftId: row.shift_id,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    source: row.source,
    notes: row.notes,
    createdBy: userRowToContextUser(user, null),
    createdAt: row.created_at,
  };
}

export async function getCashFlow(id: string): Promise<CashFlowView | null> {
  const client = await getSqlClient();
  const [row] = (await client`
    select
      id, type, payment_method, category, amount, shift_id, reference_type,
      reference_id, source, notes, created_by, created_at
    from cash_flows where id = ${id} limit 1`) as CashFlowRow[];
  return row ? buildCashFlow(row) : null;
}

export async function listCashFlows(input: {
  filter?: {
    type?: string | null;
    category?: string | null;
    paymentMethod?: string | null;
    source?: string | null;
    range?: { from?: Date | string | null; to?: Date | string | null } | null;
  } | null;
  page?: { page: number; pageSize: number } | null;
  sort?: { field: string; direction: "ASC" | "DESC" } | null;
}): Promise<CashFlowPageView> {
  const client = await getSqlClient();
  const page = normalizePage(input.page);
  const order = resolveSort(
    input.sort,
    {
      createdAt: "cf.created_at",
      amount: "cf.amount",
      type: "cf.type",
    },
    "cf.created_at",
  );
  const type = input.filter?.type ?? null;
  const category = input.filter?.category ?? null;
  const paymentMethod = input.filter?.paymentMethod ?? null;
  const source = input.filter?.source ?? null;
  const from = toDate(input.filter?.range?.from)?.toISOString() ?? null;
  const to = toDate(input.filter?.range?.to)?.toISOString() ?? null;
  const direction = order.direction === "ASC" ? client`asc` : client`desc`;
  const offset = (page.page - 1) * page.pageSize;

  const [countRow] = await client`
    select count(*)::int as total
    from cash_flows cf
    where (${type}::text is null or cf.type::text = ${type})
      and (${category}::text is null or cf.category::text = ${category})
      and (${paymentMethod}::text is null or cf.payment_method::text = ${paymentMethod})
      and (${source}::text is null or cf.source::text = ${source})
      and (${from}::timestamptz is null or cf.created_at >= ${from}::timestamptz)
      and (${to}::timestamptz is null or cf.created_at <= ${to}::timestamptz)`;

  const rows = (await client`
    select
      id, type, payment_method, category, amount, shift_id, reference_type,
      reference_id, source, notes, created_by, created_at
    from cash_flows cf
    where (${type}::text is null or cf.type::text = ${type})
      and (${category}::text is null or cf.category::text = ${category})
      and (${paymentMethod}::text is null or cf.payment_method::text = ${paymentMethod})
      and (${source}::text is null or cf.source::text = ${source})
      and (${from}::timestamptz is null or cf.created_at >= ${from}::timestamptz)
      and (${to}::timestamptz is null or cf.created_at <= ${to}::timestamptz)
    order by ${client(order.expression)} ${direction}
    limit ${page.pageSize} offset ${offset}`) as CashFlowRow[];

  const items: CashFlowView[] = [];
  for (const row of rows) {
    const view = await buildCashFlow(row);
    if (view) items.push(view);
  }
  return { items, pageInfo: pageInfo(page, Number(countRow.total)) };
}

export interface AutoCashFlowInput {
  type: "IN" | "OUT";
  paymentMethod: "CASH" | "QRIS" | "TRANSFER" | "DEBIT";
  category: CashFlowView["category"];
  amount: number;
  shiftId?: string | null;
  referenceType: Exclude<CashFlowView["referenceType"], "MANUAL">;
  referenceId: string;
  notes?: string | null;
  createdBy: string;
}

export async function insertAutoCashFlow(
  client: DbClient,
  input: AutoCashFlowInput,
): Promise<void> {
  await client`
    insert into cash_flows (
      type, payment_method, category, amount, shift_id, reference_type,
      reference_id, source, notes, created_by
    )
    values (
      ${input.type}, ${input.paymentMethod}, ${input.category}, ${input.amount},
      ${input.paymentMethod === "CASH" ? (input.shiftId ?? null) : null},
      ${input.referenceType}, ${input.referenceId}, 'AUTO',
      ${input.notes ?? null}, ${input.createdBy}
    )
    on conflict (reference_type, reference_id, category, type)
      where source = 'AUTO'
    do nothing`;
}

export async function createManualCashFlow(
  context: RequestContext,
  input: {
    type: "IN" | "OUT";
    paymentMethod: "CASH" | "QRIS" | "TRANSFER" | "DEBIT";
    category:
      | "SALES"
      | "DEBT_PAYMENT"
      | "REFUND"
      | "PURCHASE"
      | "EXPENSE"
      | "CAPITAL"
      | "OTHER";
    amount: string;
    notes?: string | null;
  },
): Promise<CashFlowView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw validationFailed("amount harus rupiah bulat lebih dari 0.");
  }
  if (!["EXPENSE", "CAPITAL", "OTHER"].includes(input.category)) {
    throw validationFailed("Kategori manual tidak valid.");
  }

  const client = await getSqlClient();
  let shiftId: string | null = null;
  if (input.paymentMethod === "CASH") {
    const [shift] = await client`
      select id from cashier_shifts
      where user_id = ${context.user.id} and status = 'OPEN'
      order by opened_at desc limit 1`;
    shiftId = shift?.id ?? null;
  }

  const [row] = (await client`
    insert into cash_flows (
      type, payment_method, category, amount, shift_id, reference_type,
      source, notes, created_by
    )
    values (
      ${input.type}, ${input.paymentMethod}, ${input.category}, ${amount},
      ${shiftId}, 'MANUAL', 'MANUAL', ${input.notes ?? null},
      ${context.user.id}
    )
    returning
      id, type, payment_method, category, amount, shift_id, reference_type,
      reference_id, source, notes, created_by, created_at`) as CashFlowRow[];

  const view = await buildCashFlow(row);
  if (!view) throw validationFailed("Cash flow gagal dibuat.");
  return view;
}
