import { type DeviceView, loadDeviceView } from "../auth/device-view.ts";
import { findUserById, insertAuditEvent } from "../auth/repository.ts";
import { userRowToContextUser } from "../auth/user-mapper.ts";
import {
  type CustomerView,
  getCustomer,
  loadProductsByIds,
  type ProductUnitView,
  type ProductView,
} from "../catalog/service.ts";
import {
  type DbClient,
  decimal,
  documentNumber,
  getSqlClient,
  money,
  normalizePage,
  type PageInfo,
  pageInfo,
  resolveSort,
  toDate,
  toMoney,
  toQuantity,
} from "../db/query.ts";
import { insertAutoCashFlow } from "../finance/service.ts";
import type { ContextUser, RequestContext } from "../graphql/context.ts";
import {
  apiError,
  conflict,
  notFound,
  validationFailed,
} from "../graphql/errors.ts";

const SALE_LOCATION = "STORE" as const;

export interface ShiftView {
  id: string;
  userId: string;
  user: ContextUser;
  status: "OPEN" | "CLOSED";
  openedAt: Date | string;
  closedAt: Date | string | null;
  openingCash: string;
  expectedCash: string | null;
  actualCash: string | null;
  deviceId: string | null;
  device: DeviceView | null;
  source: "ONLINE" | "OFFLINE";
  openedAtClient: Date | string | null;
  closedAtClient: Date | string | null;
  receivedAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface SaleItemView {
  id: string;
  productId: string;
  productUnitId: string;
  product: ProductView;
  unit: ProductUnitView;
  productName: string;
  unitName: string;
  qty: string;
  qtyBase: string;
  unitPrice: string;
  discount: string;
  unitCost: string;
  subtotal: string;
}

export interface SalePaymentView {
  id: string;
  method: "CASH" | "QRIS" | "TRANSFER" | "DEBIT";
  amount: string;
  cashReceived: string;
  change: string;
  paymentRef: string | null;
  receivedBy: ContextUser;
  shiftId: string | null;
  paidAt: Date | string;
}

export interface SaleReturnItemView {
  id: string;
  saleItemId: string;
  saleItem: SaleItemView;
  qty: string;
  qtyBase: string;
  refundAmount: string;
}

export interface SaleReturnView {
  id: string;
  returnNo: string;
  saleId: string;
  createdBy: ContextUser;
  reason: string;
  totalRefund: string;
  cashRefund: string;
  refundMethod: "CASH" | "QRIS" | "TRANSFER" | "DEBIT" | null;
  refundedAt: Date | string | null;
  shiftId: string | null;
  items: SaleReturnItemView[];
  createdAt: Date | string;
}

export interface SaleView {
  id: string;
  invoiceNo: string;
  shiftId: string;
  shift: ShiftView;
  user: ContextUser;
  customer: CustomerView | null;
  items: SaleItemView[];
  payments: SalePaymentView[];
  returns: SaleReturnView[];
  subtotal: string;
  discount: string;
  totalAmount: string;
  paid: string | null;
  outstanding: string | null;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID" | null;
  settlementMethod: "CASH" | "QRIS" | "TRANSFER" | "DEBIT" | "MIXED" | "DEBT";
  status: "COMPLETED" | "VOIDED";
  voidedAt: Date | string | null;
  voidedBy: ContextUser | null;
  voidReason: string | null;
  source: "ONLINE" | "OFFLINE" | "GRACE";
  deviceId: string | null;
  device: DeviceView | null;
  clientOrderId: string | null;
  clientSeq: string | null;
  clientCreatedAt: Date | string | null;
  receivedAt: Date | string;
  signatureVerified: boolean;
  priceVariance: string;
  syncBatchId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface SalePayloadView {
  sale: SaleView;
  duplicate: boolean;
}

export interface ReceivableView {
  sale: SaleView;
  invoiceNo: string;
  customer: CustomerView;
  totalAmount: string;
  paid: string;
  outstanding: string;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
}

export interface ShiftPageView {
  items: ShiftView[];
  pageInfo: PageInfo;
}

export interface SalePageView {
  items: SaleView[];
  pageInfo: PageInfo;
}

export interface ReceivablePageView {
  items: ReceivableView[];
  pageInfo: PageInfo;
}

interface ShiftRow {
  id: string;
  user_id: string;
  status: "OPEN" | "CLOSED";
  opened_at: Date;
  closed_at: Date | null;
  opening_cash: string;
  expected_cash: string | null;
  actual_cash: string | null;
  device_id: string | null;
  source: "ONLINE" | "OFFLINE";
  opened_at_client: Date | null;
  closed_at_client: Date | null;
  received_at: Date;
  created_at: Date;
  updated_at: Date;
}

async function buildShift(row: ShiftRow): Promise<ShiftView | null> {
  const user = await findUserById(row.user_id);
  if (!user) return null;
  const device = row.device_id ? await loadDeviceView(row.device_id) : null;
  return {
    id: row.id,
    userId: row.user_id,
    user: userRowToContextUser(user, null),
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openingCash: money(row.opening_cash),
    expectedCash: row.expected_cash === null ? null : money(row.expected_cash),
    actualCash: row.actual_cash === null ? null : money(row.actual_cash),
    deviceId: row.device_id,
    device,
    source: row.source,
    openedAtClient: row.opened_at_client,
    closedAtClient: row.closed_at_client,
    receivedAt: row.received_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getShift(id: string): Promise<ShiftView | null> {
  const client = await getSqlClient();
  const [row] = (await client`
    select
      id, user_id, status, opened_at, closed_at, opening_cash, expected_cash,
      actual_cash, device_id, source, opened_at_client, closed_at_client,
      received_at, created_at, updated_at
    from cashier_shifts where id = ${id} limit 1`) as ShiftRow[];
  return row ? buildShift(row) : null;
}

export async function openShift(
  context: RequestContext,
  input: {
    id?: string | null;
    userId?: string | null;
    openingCash: string;
    openedAtClient?: Date | string | null;
  },
): Promise<ShiftView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  const userId = input.userId ?? context.user.id;
  const target = await findUserById(userId);
  if (!target) throw notFound("Pengguna tidak ditemukan.");
  if (!target.isActive) throw apiError("USER_DISABLED");

  const openingCash = Number(input.openingCash);
  if (!Number.isInteger(openingCash) || openingCash < 0) {
    throw validationFailed("openingCash harus rupiah bulat non-negatif.");
  }

  const client = await getSqlClient();
  const openedAtClient = toDate(input.openedAtClient);
  const source = openedAtClient ? "OFFLINE" : "ONLINE";
  if (source === "OFFLINE" && !context.device) {
    throw validationFailed("Shift offline memerlukan perangkat.");
  }

  if (input.id) {
    const [existing] = (await client`
      select id, user_id from cashier_shifts where id = ${input.id} limit 1`) as Array<{
      id: string;
      user_id: string;
    }>;
    if (existing) {
      if (existing.user_id !== userId)
        throw conflict("Shift id sudah dipakai.");
      const view = await getShift(existing.id);
      if (view) return view;
    }
  } else {
    const [open] = await client`
      select id from cashier_shifts
      where user_id = ${userId} and status = 'OPEN' limit 1`;
    if (open) throw conflict("Pengguna sudah memiliki shift terbuka.");
  }

  let shiftId: string;
  try {
    const [row] = input.id
      ? await client`
          insert into cashier_shifts (
            id, user_id, status, opening_cash, device_id, source,
            opened_at_client
          )
          values (
            ${input.id}, ${userId}, 'OPEN', ${openingCash},
            ${context.device?.id ?? null}, ${source},
            ${openedAtClient ? openedAtClient.toISOString() : null}::timestamptz
          )
          returning id`
      : await client`
          insert into cashier_shifts (
            user_id, status, opening_cash, device_id, source, opened_at_client
          )
          values (
            ${userId}, 'OPEN', ${openingCash}, ${context.device?.id ?? null},
            ${source}, ${openedAtClient ? openedAtClient.toISOString() : null}::timestamptz
          )
          returning id`;
    shiftId = row.id as string;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      const view = await currentShiftForUser(userId);
      if (view) return view;
      throw conflict("Shift sudah terbuka.");
    }
    throw error;
  }

  await insertAuditEvent(client, {
    eventType: "SHIFT_OPENED",
    actorUserId: context.user.id,
    deviceId: context.device?.id ?? null,
    entityType: "cashier_shift",
    entityId: shiftId,
    metadata: { userId, source, platform: context.clientPlatform ?? "WEB" },
  });

  const shift = await getShift(shiftId);
  if (!shift) throw notFound("Shift tidak ditemukan.");
  return shift;
}

async function currentShiftForUser(userId: string): Promise<ShiftView | null> {
  const client = await getSqlClient();
  const [row] = (await client`
    select
      id, user_id, status, opened_at, closed_at, opening_cash, expected_cash,
      actual_cash, device_id, source, opened_at_client, closed_at_client,
      received_at, created_at, updated_at
    from cashier_shifts
    where user_id = ${userId} and status = 'OPEN'
    order by opened_at desc limit 1`) as ShiftRow[];
  return row ? buildShift(row) : null;
}

export async function currentShift(
  context: RequestContext,
  userId?: string | null,
): Promise<ShiftView | null> {
  if (!context.user) throw apiError("UNAUTHENTICATED");
  return currentShiftForUser(userId ?? context.user.id);
}

export async function listShifts(input: {
  filter?: {
    userId?: string | null;
    status?: string | null;
    source?: string | null;
    deviceId?: string | null;
    range?: { from?: Date | string | null; to?: Date | string | null } | null;
  } | null;
  page?: { page: number; pageSize: number } | null;
  sort?: { field: string; direction: "ASC" | "DESC" } | null;
}): Promise<ShiftPageView> {
  const client = await getSqlClient();
  const page = normalizePage(input.page);
  const order = resolveSort(
    input.sort,
    {
      openedAt: "cs.opened_at",
      createdAt: "cs.created_at",
      status: "cs.status",
    },
    "cs.opened_at",
  );
  const userId = input.filter?.userId ?? null;
  const status = input.filter?.status ?? null;
  const source = input.filter?.source ?? null;
  const deviceId = input.filter?.deviceId ?? null;
  const from = toDate(input.filter?.range?.from)?.toISOString() ?? null;
  const to = toDate(input.filter?.range?.to)?.toISOString() ?? null;
  const direction = order.direction === "ASC" ? client`asc` : client`desc`;
  const offset = (page.page - 1) * page.pageSize;

  const [countRow] = await client`
    select count(*)::int as total
    from cashier_shifts cs
    where (${userId}::uuid is null or cs.user_id = ${userId}::uuid)
      and (${status}::text is null or cs.status::text = ${status})
      and (${source}::text is null or cs.source::text = ${source})
      and (${deviceId}::uuid is null or cs.device_id = ${deviceId}::uuid)
      and (${from}::timestamptz is null or cs.opened_at >= ${from}::timestamptz)
      and (${to}::timestamptz is null or cs.opened_at <= ${to}::timestamptz)`;

  const rows = (await client`
    select
      id, user_id, status, opened_at, closed_at, opening_cash, expected_cash,
      actual_cash, device_id, source, opened_at_client, closed_at_client,
      received_at, created_at, updated_at
    from cashier_shifts cs
    where (${userId}::uuid is null or cs.user_id = ${userId}::uuid)
      and (${status}::text is null or cs.status::text = ${status})
      and (${source}::text is null or cs.source::text = ${source})
      and (${deviceId}::uuid is null or cs.device_id = ${deviceId}::uuid)
      and (${from}::timestamptz is null or cs.opened_at >= ${from}::timestamptz)
      and (${to}::timestamptz is null or cs.opened_at <= ${to}::timestamptz)
    order by ${client(order.expression)} ${direction}
    limit ${page.pageSize} offset ${offset}`) as ShiftRow[];

  const items: ShiftView[] = [];
  for (const row of rows) {
    const view = await buildShift(row);
    if (view) items.push(view);
  }
  return { items, pageInfo: pageInfo(page, Number(countRow.total)) };
}

async function expectedCashForShift(
  client: DbClient,
  shift: { id: string; opening_cash: string },
): Promise<number> {
  const [sales] = await client`
    select coalesce(sum(amount), 0)::bigint as total
    from sale_payments
    where shift_id = ${shift.id} and method = 'CASH'`;
  const [refunds] = await client`
    select coalesce(sum(cash_refund), 0)::bigint as total
    from sale_returns
    where shift_id = ${shift.id} and cash_refund > 0`;
  const [manual] = await client`
    select coalesce(sum(case when type = 'IN' then amount else -amount end), 0)::bigint as total
    from cash_flows
    where shift_id = ${shift.id} and source = 'MANUAL' and payment_method = 'CASH'`;
  return (
    Number(shift.opening_cash) +
    Number(sales.total) -
    Number(refunds.total) +
    Number(manual.total)
  );
}

export async function closeShift(
  context: RequestContext,
  input: {
    shiftId: string;
    actualCash: string;
    closedAtClient?: Date | string | null;
  },
): Promise<ShiftView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  const actualCash = Number(input.actualCash);
  if (!Number.isInteger(actualCash) || actualCash < 0) {
    throw validationFailed("actualCash harus rupiah bulat non-negatif.");
  }
  const client = await getSqlClient();

  await client.begin(async (transaction) => {
    const [shift] = (await transaction`
      select id, status, source, opening_cash
      from cashier_shifts where id = ${input.shiftId} for update`) as Array<{
      id: string;
      status: "OPEN" | "CLOSED";
      source: "ONLINE" | "OFFLINE";
      opening_cash: string;
    }>;
    if (!shift) throw apiError("SHIFT_NOT_FOUND");
    if (shift.status === "CLOSED") throw apiError("SHIFT_CLOSED");
    const closedAtClient = toDate(input.closedAtClient);
    if (shift.source === "OFFLINE" && !closedAtClient) {
      throw apiError("INVALID_SHIFT");
    }

    const expectedCash = await expectedCashForShift(transaction, shift);
    await transaction`
      update cashier_shifts
      set
        status = 'CLOSED',
        closed_at = now(),
        expected_cash = ${expectedCash},
        actual_cash = ${actualCash},
        closed_at_client = ${closedAtClient ? closedAtClient.toISOString() : null}::timestamptz,
        updated_at = now()
      where id = ${input.shiftId}`;

    await insertAuditEvent(transaction, {
      eventType: "SHIFT_CLOSED",
      actorUserId: context.user!.id,
      deviceId: context.device?.id ?? null,
      entityType: "cashier_shift",
      entityId: shift.id,
      metadata: {
        source: shift.source,
        expectedCash,
        actualCash,
        platform: context.clientPlatform ?? "WEB",
      },
    });
  });

  const shift = await getShift(input.shiftId);
  if (!shift) throw apiError("SHIFT_NOT_FOUND");
  return shift;
}

interface PreparedSaleItem {
  productId: string;
  productUnitId: string;
  productName: string;
  unitName: string;
  qty: string;
  qtyBase: string;
  unitPrice: number;
  serverUnitPrice: number;
  discount: number;
  unitCost: number;
  subtotal: number;
}

interface PreparedPayment {
  method: "CASH" | "QRIS" | "TRANSFER" | "DEBIT";
  amount: number;
  cashReceived: number;
  change: number;
  paymentRef: string | null;
}

async function prepareSaleItems(
  client: DbClient,
  items: Array<{
    productId: string;
    productUnitId: string;
    qty: string;
    unitPrice: string;
    discount?: string | null;
  }>,
): Promise<PreparedSaleItem[]> {
  if (items.length === 0) throw validationFailed("Item penjualan wajib diisi.");
  const productIds = [...new Set(items.map((item) => item.productId))].sort();
  const locked = await client`
    select id from products where id = any(${productIds}::uuid[])
    order by id for update`;
  if (locked.length !== productIds.length)
    throw notFound("Produk tidak ditemukan.");

  const units = (await client`
    select
      pu.id, pu.product_id, pu.unit_name, pu.conversion_qty,
      pu.selling_price, p.name as product_name, p.avg_cost
    from product_units pu
    join products p on p.id = pu.product_id
    where pu.product_id = any(${productIds}::uuid[])`) as Array<{
    id: string;
    product_id: string;
    unit_name: string;
    conversion_qty: string;
    product_name: string;
    avg_cost: string;
    selling_price: string;
  }>;
  const unitMap = new Map(units.map((unit) => [unit.id, unit]));

  return items.map((item) => {
    const unit = unitMap.get(item.productUnitId);
    if (!unit || unit.product_id !== item.productId) {
      throw validationFailed("productUnitId tidak sesuai dengan produk.");
    }
    const qty = Number(item.qty);
    const unitPrice = Number(item.unitPrice);
    const discount =
      item.discount === undefined || item.discount === null
        ? 0
        : Number(item.discount);
    if (!(qty > 0)) throw validationFailed("qty harus lebih dari 0.");
    if (!Number.isInteger(unitPrice) || unitPrice < 0) {
      throw validationFailed("unitPrice harus rupiah bulat non-negatif.");
    }
    if (!Number.isInteger(discount) || discount < 0 || discount > unitPrice) {
      throw validationFailed("discount tidak valid.");
    }
    return {
      productId: item.productId,
      productUnitId: item.productUnitId,
      productName: unit.product_name,
      unitName: unit.unit_name,
      qty: toQuantity(qty),
      qtyBase: toQuantity(qty * Number(unit.conversion_qty)),
      unitPrice,
      serverUnitPrice: Number(unit.selling_price),
      discount,
      unitCost: Number(unit.avg_cost),
      subtotal: toMoney(qty * unitPrice),
    };
  });
}

function preparePayments(
  items: Array<{
    method: "CASH" | "QRIS" | "TRANSFER" | "DEBIT";
    amount: string;
    cashReceived?: string | null;
    paymentRef?: string | null;
  }>,
): PreparedPayment[] {
  return items.map((payment) => {
    const amount = Number(payment.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw validationFailed(
        "amount pembayaran harus rupiah bulat lebih dari 0.",
      );
    }
    if (payment.method === "CASH") {
      const cashReceived = Number(payment.cashReceived ?? payment.amount);
      if (!Number.isInteger(cashReceived) || cashReceived < amount) {
        throw validationFailed("cashReceived harus >= amount.");
      }
      return {
        method: payment.method,
        amount,
        cashReceived,
        change: cashReceived - amount,
        paymentRef: payment.paymentRef ?? null,
      };
    }
    if (payment.cashReceived !== undefined && payment.cashReceived !== null) {
      if (Number(payment.cashReceived) !== 0) {
        throw validationFailed(
          "Pembayaran non-tunai tidak boleh cashReceived.",
        );
      }
    }
    return {
      method: payment.method,
      amount,
      cashReceived: 0,
      change: 0,
      paymentRef: payment.paymentRef ?? null,
    };
  });
}

function settlementFor(
  total: number,
  payments: PreparedPayment[],
): "CASH" | "QRIS" | "TRANSFER" | "DEBIT" | "MIXED" | "DEBT" {
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (paid < total) return "DEBT";
  if (payments.length === 0) return "CASH";
  const methods = new Set(payments.map((payment) => payment.method));
  if (methods.size > 1) return "MIXED";
  return payments[0]!.method;
}

export async function createSale(
  context: RequestContext,
  input: {
    shiftId: string;
    customerId?: string | null;
    items: Array<{
      productId: string;
      productUnitId: string;
      qty: string;
      unitPrice: string;
      discount?: string | null;
    }>;
    payments: Array<{
      method: "CASH" | "QRIS" | "TRANSFER" | "DEBIT";
      amount: string;
      cashReceived?: string | null;
      paymentRef?: string | null;
    }>;
    clientOrderId?: string | null;
    clientSeq?: string | null;
    clientCreatedAt?: Date | string | null;
    signature?: string | null;
  },
  options: {
    allowClosedShift?: boolean;
    source?: "ONLINE" | "OFFLINE" | "GRACE";
    signatureVerified?: boolean;
    syncBatchId?: string | null;
  } = {},
): Promise<SalePayloadView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  const clientOrderId = input.clientOrderId ?? null;
  const deviceId = context.device?.id ?? null;
  if (clientOrderId && !deviceId) {
    throw validationFailed("Client order memerlukan perangkat.");
  }

  if (clientOrderId && deviceId) {
    const existing = await findSaleByClientOrder(deviceId, clientOrderId);
    if (existing) return { sale: existing, duplicate: true };
  }

  if (
    input.items.some(
      (item) =>
        item.discount !== undefined &&
        item.discount !== null &&
        Number(item.discount) > 0,
    ) &&
    context.role !== "OWNER" &&
    context.role !== "ADMIN"
  ) {
    throw apiError("FORBIDDEN", "Diskon hanya untuk OWNER/ADMIN.");
  }

  const client = await getSqlClient();
  let saleId: string;
  try {
    saleId = await client.begin(async (transaction) => {
      const [shift] = (await transaction`
        select id, user_id, status from cashier_shifts
        where id = ${input.shiftId} for update`) as Array<{
        id: string;
        user_id: string;
        status: "OPEN" | "CLOSED";
      }>;
      if (!shift) throw apiError("SHIFT_NOT_FOUND");
      if (shift.status !== "OPEN" && !options.allowClosedShift) {
        throw apiError("SHIFT_CLOSED");
      }
      const cashier = await findUserById(shift.user_id);
      if (!cashier || !cashier.isActive) throw apiError("INVALID_SHIFT");

      const customer = input.customerId
        ? await getCustomer(input.customerId)
        : null;
      if (input.customerId && !customer)
        throw notFound("Customer tidak ditemukan.");

      const items = await prepareSaleItems(transaction, input.items);
      const priceVariance =
        options.source && options.source !== "ONLINE"
          ? Math.round(
              items.reduce(
                (sum, item) =>
                  sum +
                  (item.unitPrice - item.serverUnitPrice) * Number(item.qty),
                0,
              ),
            )
          : 0;
      const payments = preparePayments(input.payments);
      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      const discount = items.reduce(
        (sum, item) => sum + toMoney(Number(item.qty) * item.discount),
        0,
      );
      const total = subtotal - discount;
      const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
      if (paid > total) throw validationFailed("Pembayaran melebihi total.");
      const settlement = settlementFor(total, payments);
      if (settlement === "DEBT" && !customer) {
        throw validationFailed("Penjualan DEBT memerlukan customer.");
      }

      const seq =
        input.clientSeq === undefined || input.clientSeq === null
          ? null
          : Number(input.clientSeq);
      if (seq !== null && (!Number.isInteger(seq) || seq < 0)) {
        throw validationFailed("clientSeq tidak valid.");
      }
      const clientCreatedAt = toDate(input.clientCreatedAt);

      const [sale] = await transaction`
        insert into sales (
          invoice_no, shift_id, user_id, customer_id, subtotal, discount,
          total_amount, settlement_method, status, source, device_id,
          client_order_id, client_seq, client_created_at,
          signature_verified, price_variance, sync_batch_id
        )
        values (
          ${documentNumber("INV")}, ${shift.id}, ${shift.user_id},
          ${input.customerId ?? null}, ${subtotal}, ${discount}, ${total},
          ${settlement}, 'COMPLETED', ${options.source ?? "ONLINE"}, ${deviceId},
          ${clientOrderId}, ${seq},
          ${clientCreatedAt ? clientCreatedAt.toISOString() : null}::timestamptz,
          ${options.signatureVerified ?? false}, ${priceVariance},
          ${options.syncBatchId ?? null}
        )
        returning id`;

      const balanceRows = (await transaction`
        select product_id, coalesce(sum(qty_change), 0)::numeric(12,3) as qty
        from stock_movements
        where product_id = any(${[...new Set(items.map((item) => item.productId))]}::uuid[])
          and location = ${SALE_LOCATION}
        group by product_id`) as Array<{ product_id: string; qty: string }>;
      const balances = new Map(
        balanceRows.map((row) => [row.product_id, Number(row.qty)]),
      );

      for (const item of items) {
        const [saleItem] = await transaction`
          insert into sale_items (
            sale_id, product_id, product_unit_id, product_name, unit_name,
            qty, qty_base, unit_price, discount, unit_cost, subtotal
          )
          values (
            ${sale.id}, ${item.productId}, ${item.productUnitId},
            ${item.productName}, ${item.unitName}, ${item.qty}, ${item.qtyBase},
            ${item.unitPrice}, ${item.discount}, ${item.unitCost},
            ${item.subtotal}
          )
          returning id, product_id, qty_base`;
        const next =
          (balances.get(item.productId) ?? 0) - Number(saleItem.qty_base);
        balances.set(item.productId, next);
        await transaction`
          insert into stock_movements (
            product_id, location, qty_change, movement_type, reference_type,
            reference_id, notes, flagged, flag_reason, created_by
          )
          values (
            ${item.productId}, ${SALE_LOCATION}, ${-Number(saleItem.qty_base)},
            'SALE', 'SALE', ${sale.id}, ${sale.id},
            ${next < 0}, ${next < 0 ? "NEGATIVE_STOCK" : null},
            ${shift.user_id}
          )`;
      }

      for (const payment of payments) {
        const [row] = await transaction`
          insert into sale_payments (
            sale_id, method, amount, cash_received, change, shift_id,
            received_by, payment_ref
          )
          values (
            ${sale.id}, ${payment.method}, ${payment.amount},
            ${payment.cashReceived}, ${payment.change},
            ${payment.method === "CASH" ? shift.id : null},
            ${shift.user_id}, ${payment.paymentRef}
          )
          returning id`;
        await insertAutoCashFlow(transaction, {
          type: "IN",
          paymentMethod: payment.method,
          category: "SALES",
          amount: payment.amount,
          shiftId: shift.id,
          referenceType: "SALE_PAYMENT",
          referenceId: row.id,
          notes: sale.id as string,
          createdBy: shift.user_id,
        });
      }

      return sale.id as string;
    });
  } catch (error) {
    if (
      (error as { code?: string }).code === "23505" &&
      clientOrderId &&
      deviceId
    ) {
      const existing = await findSaleByClientOrder(deviceId, clientOrderId);
      if (existing) return { sale: existing, duplicate: true };
    }
    throw error;
  }

  const sale = await getSale(saleId);
  if (!sale) throw notFound("Penjualan tidak ditemukan.");
  return { sale, duplicate: false };
}

async function findSaleByClientOrder(
  deviceId: string,
  clientOrderId: string,
): Promise<SaleView | null> {
  const client = await getSqlClient();
  const [row] = await client`
    select id from sales
    where device_id = ${deviceId} and client_order_id = ${clientOrderId}
    limit 1`;
  return row ? getSale(row.id) : null;
}

export async function getSale(id: string): Promise<SaleView | null> {
  const client = await getSqlClient();
  const [row] = await client`
    select
      s.id, s.invoice_no, s.shift_id, s.user_id, s.customer_id, s.subtotal,
      s.discount, s.total_amount, s.settlement_method, s.status, s.voided_at,
      s.voided_by, s.void_reason, s.source, s.device_id, s.client_order_id,
      s.client_seq, s.client_created_at, s.received_at, s.signature_verified,
      s.price_variance, s.sync_batch_id, s.created_at, s.updated_at,
      b.paid, b.outstanding, b.payment_status
    from sales s
    left join v_sale_balances b on b.sale_id = s.id
    where s.id = ${id}
    limit 1`;
  if (!row) return null;

  const [shift, user, customer, device] = await Promise.all([
    getShift(row.shift_id),
    findUserById(row.user_id),
    row.customer_id ? getCustomer(row.customer_id) : Promise.resolve(null),
    row.device_id ? loadDeviceView(row.device_id) : Promise.resolve(null),
  ]);
  if (!shift || !user) return null;
  const voidedBy = row.voided_by ? await findUserById(row.voided_by) : null;

  const itemRows = (await client`
    select
      id, product_id, product_unit_id, product_name, unit_name, qty,
      qty_base, unit_price, discount, unit_cost, subtotal
    from sale_items where sale_id = ${id} order by id`) as Array<{
    id: string;
    product_id: string;
    product_unit_id: string;
    product_name: string;
    unit_name: string;
    qty: string;
    qty_base: string;
    unit_price: string;
    discount: string;
    unit_cost: string;
    subtotal: string;
  }>;
  const products = await loadProductsByIds([
    ...new Set(itemRows.map((item) => item.product_id)),
  ]);
  const items: SaleItemView[] = [];
  const itemMap = new Map<string, SaleItemView>();
  for (const item of itemRows) {
    const product = products.get(item.product_id);
    const unit = product?.units.find(
      (value) => value.id === item.product_unit_id,
    );
    if (!product || !unit) continue;
    const view: SaleItemView = {
      id: item.id,
      productId: item.product_id,
      productUnitId: item.product_unit_id,
      product,
      unit,
      productName: item.product_name,
      unitName: item.unit_name,
      qty: decimal(item.qty),
      qtyBase: decimal(item.qty_base),
      unitPrice: money(item.unit_price),
      discount: money(item.discount),
      unitCost: money(item.unit_cost),
      subtotal: money(item.subtotal),
    };
    items.push(view);
    itemMap.set(view.id, view);
  }

  const paymentRows = (await client`
    select
      id, method, amount, cash_received, change, shift_id, received_by,
      payment_ref, paid_at
    from sale_payments where sale_id = ${id} order by paid_at, id`) as Array<{
    id: string;
    method: "CASH" | "QRIS" | "TRANSFER" | "DEBIT";
    amount: string;
    cash_received: string;
    change: string;
    shift_id: string | null;
    received_by: string;
    payment_ref: string | null;
    paid_at: Date;
  }>;
  const paymentUsers = new Map(
    await Promise.all(
      [...new Set(paymentRows.map((payment) => payment.received_by))].map(
        async (userId) => [userId, await findUserById(userId)] as const,
      ),
    ),
  );
  const payments: SalePaymentView[] = [];
  for (const payment of paymentRows) {
    const receiver = paymentUsers.get(payment.received_by);
    if (!receiver) continue;
    payments.push({
      id: payment.id,
      method: payment.method,
      amount: money(payment.amount),
      cashReceived: money(payment.cash_received),
      change: money(payment.change),
      paymentRef: payment.payment_ref,
      receivedBy: userRowToContextUser(receiver, null),
      shiftId: payment.shift_id,
      paidAt: payment.paid_at,
    });
  }

  const returnRows = (await client`
    select
      id, return_no, created_by, reason, total_refund, cash_refund,
      refund_method, refunded_at, shift_id, created_at
    from sale_returns where sale_id = ${id} order by created_at, id`) as Array<{
    id: string;
    return_no: string;
    created_by: string;
    reason: string;
    total_refund: string;
    cash_refund: string;
    refund_method: "CASH" | "QRIS" | "TRANSFER" | "DEBIT" | null;
    refunded_at: Date | null;
    shift_id: string | null;
    created_at: Date;
  }>;
  const returns: SaleReturnView[] = [];
  for (const row of returnRows) {
    const creator = await findUserById(row.created_by);
    if (!creator) continue;
    const returnItemRows = (await client`
      select id, sale_item_id, qty, qty_base, refund_amount
      from sale_return_items where return_id = ${row.id} order by id`) as Array<{
      id: string;
      sale_item_id: string;
      qty: string;
      qty_base: string;
      refund_amount: string;
    }>;
    const returnItems: SaleReturnItemView[] = [];
    for (const item of returnItemRows) {
      const saleItem = itemMap.get(item.sale_item_id);
      if (!saleItem) continue;
      returnItems.push({
        id: item.id,
        saleItemId: item.sale_item_id,
        saleItem,
        qty: decimal(item.qty),
        qtyBase: decimal(item.qty_base),
        refundAmount: money(item.refund_amount),
      });
    }
    returns.push({
      id: row.id,
      returnNo: row.return_no,
      saleId: id,
      createdBy: userRowToContextUser(creator, null),
      reason: row.reason,
      totalRefund: money(row.total_refund),
      cashRefund: money(row.cash_refund),
      refundMethod: row.refund_method,
      refundedAt: row.refunded_at,
      shiftId: row.shift_id,
      items: returnItems,
      createdAt: row.created_at,
    });
  }

  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    shiftId: row.shift_id,
    shift,
    user: userRowToContextUser(user, null),
    customer,
    items,
    payments,
    returns,
    subtotal: money(row.subtotal),
    discount: money(row.discount),
    totalAmount: money(row.total_amount),
    paid: row.status === "VOIDED" ? null : money(row.paid),
    outstanding: row.status === "VOIDED" ? null : money(row.outstanding),
    paymentStatus: row.status === "VOIDED" ? null : row.payment_status,
    settlementMethod: row.settlement_method,
    status: row.status,
    voidedAt: row.voided_at,
    voidedBy: voidedBy ? userRowToContextUser(voidedBy, null) : null,
    voidReason: row.void_reason,
    source: row.source,
    deviceId: row.device_id,
    device,
    clientOrderId: row.client_order_id,
    clientSeq: row.client_seq === null ? null : String(row.client_seq),
    clientCreatedAt: row.client_created_at,
    receivedAt: row.received_at,
    signatureVerified: row.signature_verified,
    priceVariance: money(row.price_variance),
    syncBatchId: row.sync_batch_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSales(input: {
  filter?: {
    search?: string | null;
    customerId?: string | null;
    userId?: string | null;
    shiftId?: string | null;
    settlementMethod?: string | null;
    status?: string | null;
    paymentStatus?: string | null;
    source?: string | null;
    deviceId?: string | null;
    range?: { from?: Date | string | null; to?: Date | string | null } | null;
  } | null;
  page?: { page: number; pageSize: number } | null;
  sort?: { field: string; direction: "ASC" | "DESC" } | null;
}): Promise<SalePageView> {
  const client = await getSqlClient();
  const page = normalizePage(input.page);
  const order = resolveSort(
    input.sort,
    {
      createdAt: "s.created_at",
      invoiceNo: "s.invoice_no",
      totalAmount: "s.total_amount",
      paidAt: "s.created_at",
    },
    "s.created_at",
  );
  const search = input.filter?.search ? `%${input.filter.search}%` : null;
  const customerId = input.filter?.customerId ?? null;
  const userId = input.filter?.userId ?? null;
  const shiftId = input.filter?.shiftId ?? null;
  const settlementMethod = input.filter?.settlementMethod ?? null;
  const status = input.filter?.status ?? null;
  const paymentStatus = input.filter?.paymentStatus ?? null;
  const source = input.filter?.source ?? null;
  const deviceId = input.filter?.deviceId ?? null;
  const from = toDate(input.filter?.range?.from)?.toISOString() ?? null;
  const to = toDate(input.filter?.range?.to)?.toISOString() ?? null;
  const direction = order.direction === "ASC" ? client`asc` : client`desc`;
  const offset = (page.page - 1) * page.pageSize;

  const [countRow] = await client`
    select count(*)::int as total
    from sales s
    left join customers c on c.id = s.customer_id
    left join v_sale_balances b on b.sale_id = s.id
    where (${search}::text is null or s.invoice_no ilike ${search} or c.name ilike ${search})
      and (${customerId}::uuid is null or s.customer_id = ${customerId}::uuid)
      and (${userId}::uuid is null or s.user_id = ${userId}::uuid)
      and (${shiftId}::uuid is null or s.shift_id = ${shiftId}::uuid)
      and (${settlementMethod}::text is null or s.settlement_method::text = ${settlementMethod})
      and (${status}::text is null or s.status::text = ${status})
      and (${paymentStatus}::text is null or b.payment_status = ${paymentStatus})
      and (${source}::text is null or s.source::text = ${source})
      and (${deviceId}::uuid is null or s.device_id = ${deviceId}::uuid)
      and (${from}::timestamptz is null or s.created_at >= ${from}::timestamptz)
      and (${to}::timestamptz is null or s.created_at <= ${to}::timestamptz)`;

  const rows = await client`
    select s.id
    from sales s
    left join customers c on c.id = s.customer_id
    left join v_sale_balances b on b.sale_id = s.id
    where (${search}::text is null or s.invoice_no ilike ${search} or c.name ilike ${search})
      and (${customerId}::uuid is null or s.customer_id = ${customerId}::uuid)
      and (${userId}::uuid is null or s.user_id = ${userId}::uuid)
      and (${shiftId}::uuid is null or s.shift_id = ${shiftId}::uuid)
      and (${settlementMethod}::text is null or s.settlement_method::text = ${settlementMethod})
      and (${status}::text is null or s.status::text = ${status})
      and (${paymentStatus}::text is null or b.payment_status = ${paymentStatus})
      and (${source}::text is null or s.source::text = ${source})
      and (${deviceId}::uuid is null or s.device_id = ${deviceId}::uuid)
      and (${from}::timestamptz is null or s.created_at >= ${from}::timestamptz)
      and (${to}::timestamptz is null or s.created_at <= ${to}::timestamptz)
    order by ${client(order.expression)} ${direction}
    limit ${page.pageSize} offset ${offset}`;

  const items: SaleView[] = [];
  for (const row of rows) {
    const sale = await getSale(row.id);
    if (sale) items.push(sale);
  }
  return { items, pageInfo: pageInfo(page, Number(countRow.total)) };
}

export async function listReceivables(input: {
  filter?: {
    search?: string | null;
    customerId?: string | null;
    paymentStatus?: string | null;
  } | null;
  page?: { page: number; pageSize: number } | null;
  sort?: { field: string; direction: "ASC" | "DESC" } | null;
}): Promise<ReceivablePageView> {
  const client = await getSqlClient();
  const page = normalizePage(input.page);
  const order = resolveSort(
    input.sort,
    {
      createdAt: "s.created_at",
      totalAmount: "s.total_amount",
      outstanding: "b.outstanding",
      invoiceNo: "s.invoice_no",
    },
    "s.created_at",
  );
  const search = input.filter?.search ? `%${input.filter.search}%` : null;
  const customerId = input.filter?.customerId ?? null;
  const paymentStatus = input.filter?.paymentStatus ?? null;
  const direction = order.direction === "ASC" ? client`asc` : client`desc`;
  const offset = (page.page - 1) * page.pageSize;

  const [countRow] = await client`
    select count(*)::int as total
    from sales s
    join v_sale_balances b on b.sale_id = s.id
    join customers c on c.id = s.customer_id
    where s.status = 'COMPLETED' and b.outstanding > 0
      and (${search}::text is null or s.invoice_no ilike ${search} or c.name ilike ${search})
      and (${customerId}::uuid is null or s.customer_id = ${customerId}::uuid)
      and (${paymentStatus}::text is null or b.payment_status = ${paymentStatus})`;

  const rows = (await client`
    select s.id, b.total_amount, b.paid, b.outstanding, b.payment_status
    from sales s
    join v_sale_balances b on b.sale_id = s.id
    join customers c on c.id = s.customer_id
    where s.status = 'COMPLETED' and b.outstanding > 0
      and (${search}::text is null or s.invoice_no ilike ${search} or c.name ilike ${search})
      and (${customerId}::uuid is null or s.customer_id = ${customerId}::uuid)
      and (${paymentStatus}::text is null or b.payment_status = ${paymentStatus})
    order by ${client(order.expression)} ${direction}
    limit ${page.pageSize} offset ${offset}`) as Array<{
    id: string;
    total_amount: string;
    paid: string;
    outstanding: string;
    payment_status: "PAID" | "PARTIAL" | "UNPAID";
  }>;

  const items: ReceivableView[] = [];
  for (const row of rows) {
    const sale = await getSale(row.id);
    if (!sale || !sale.customer) continue;
    items.push({
      sale,
      invoiceNo: sale.invoiceNo,
      customer: sale.customer,
      totalAmount: money(row.total_amount),
      paid: money(row.paid),
      outstanding: money(row.outstanding),
      paymentStatus: row.payment_status,
    });
  }
  return { items, pageInfo: pageInfo(page, Number(countRow.total)) };
}

export async function createSaleReturn(
  context: RequestContext,
  input: {
    saleId: string;
    reason: string;
    items: Array<{ saleItemId: string; qty: string }>;
    refundMethod?: "CASH" | "QRIS" | "TRANSFER" | "DEBIT" | null;
  },
): Promise<SaleReturnView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  if (!input.reason.trim()) throw validationFailed("Alasan retur wajib diisi.");
  if (input.items.length === 0)
    throw validationFailed("Item retur wajib diisi.");

  const client = await getSqlClient();
  const returnId = await client.begin(async (transaction) => {
    const [sale] = (await transaction`
      select id, status, user_id, total_amount
      from sales where id = ${input.saleId} for update`) as Array<{
      id: string;
      status: "COMPLETED" | "VOIDED";
      user_id: string;
      total_amount: string;
    }>;
    if (!sale) throw notFound("Penjualan tidak ditemukan.");
    if (sale.status === "VOIDED") throw conflict("Penjualan sudah void.");

    const saleItems = (await transaction`
      select id, product_id, qty, qty_base, unit_price, discount
      from sale_items where sale_id = ${sale.id}`) as Array<{
      id: string;
      product_id: string;
      qty: string;
      qty_base: string;
      unit_price: string;
      discount: string;
    }>;
    const itemMap = new Map(saleItems.map((item) => [item.id, item]));
    const returnedRows = (await transaction`
      select sri.sale_item_id, coalesce(sum(sri.qty), 0)::numeric(12,3) as qty
      from sale_return_items sri
      join sale_returns sr on sr.id = sri.return_id
      where sr.sale_id = ${sale.id}
      group by sri.sale_item_id`) as Array<{
      sale_item_id: string;
      qty: string;
    }>;
    const returned = new Map(
      returnedRows.map((row) => [row.sale_item_id, Number(row.qty)]),
    );

    const prepared: Array<{
      saleItemId: string;
      productId: string;
      qty: string;
      qtyBase: string;
      refundAmount: number;
    }> = [];
    for (const item of input.items) {
      const saleItem = itemMap.get(item.saleItemId);
      if (!saleItem)
        throw validationFailed("saleItemId tidak ada pada penjualan.");
      const qty = Number(item.qty);
      if (!(qty > 0)) throw validationFailed("qty retur harus lebih dari 0.");
      const remaining = Number(saleItem.qty) - (returned.get(saleItem.id) ?? 0);
      if (qty > remaining + 0.0005) {
        throw validationFailed("qty retur melebihi sisa penjualan.");
      }
      const ratio = Number(saleItem.qty_base) / Number(saleItem.qty);
      const refund = toMoney(
        qty * (Number(saleItem.unit_price) - Number(saleItem.discount)),
      );
      prepared.push({
        saleItemId: saleItem.id,
        productId: saleItem.product_id,
        qty: toQuantity(qty),
        qtyBase: toQuantity(qty * ratio),
        refundAmount: refund,
      });
    }
    const totalRefund = prepared.reduce(
      (sum, item) => sum + item.refundAmount,
      0,
    );
    if (totalRefund <= 0)
      throw validationFailed("Total retur harus lebih dari 0.");

    const [balanceRow] = await transaction`
      select
        coalesce((select sum(total_refund) from sale_returns where sale_id = ${sale.id}), 0)::bigint as refunds,
        coalesce((select sum(cash_refund) from sale_returns where sale_id = ${sale.id}), 0)::bigint as cash_refunds,
        coalesce((select sum(amount) from sale_payments where sale_id = ${sale.id}), 0)::bigint as paid`;
    const netTotal = Number(sale.total_amount) - Number(balanceRow.refunds);
    const netPaid = Number(balanceRow.paid) - Number(balanceRow.cash_refunds);
    if (totalRefund > netTotal + 0.0005) {
      throw validationFailed("Total retur melebihi nilai penjualan.");
    }
    const refundDueBefore = Math.max(netPaid - netTotal, 0);
    const refundDueAfter = Math.max(netPaid - (netTotal - totalRefund), 0);
    const cashRefund = Math.min(
      totalRefund,
      Math.max(refundDueAfter - refundDueBefore, 0),
    );

    let refundMethod = cashRefund > 0 ? (input.refundMethod ?? null) : null;
    let shiftId: string | null = null;
    if (cashRefund > 0) {
      if (!refundMethod)
        throw validationFailed("refundMethod wajib untuk refund.");
      if (refundMethod === "CASH") {
        const [shift] = (await transaction`
          select id from cashier_shifts
          where user_id = ${sale.user_id} and status = 'OPEN'
          order by opened_at desc limit 1`) as Array<{ id: string }>;
        const fallback = shift
          ? shift
          : (
              (await transaction`
              select id from cashier_shifts
              where user_id = ${context.user!.id} and status = 'OPEN'
              order by opened_at desc limit 1`) as Array<{ id: string }>
            )[0];
        if (!fallback) throw apiError("SHIFT_NOT_FOUND");
        shiftId = fallback.id;
      }
    }
    if (cashRefund === 0) {
      refundMethod = null;
      shiftId = null;
    }

    const [created] = await transaction`
      insert into sale_returns (
        return_no, sale_id, created_by, reason, total_refund, cash_refund,
        refund_method, refunded_at, shift_id
      )
      values (
        ${documentNumber("RET")}, ${sale.id}, ${context.user!.id},
        ${input.reason.trim()}, ${totalRefund}, ${cashRefund}, ${refundMethod},
        ${cashRefund > 0 ? new Date().toISOString() : null}::timestamptz,
        ${shiftId}
      )
      returning id, return_no`;

    const returnProductIds = [
      ...new Set(prepared.map((item) => item.productId)),
    ].sort();
    if (returnProductIds.length > 0) {
      await transaction`
        select id from products where id = any(${returnProductIds}::uuid[])
        order by id for update`;
    }

    for (const item of prepared) {
      await transaction`
        insert into sale_return_items (
          return_id, sale_item_id, qty, qty_base, refund_amount
        )
        values (
          ${created.id}, ${item.saleItemId}, ${item.qty}, ${item.qtyBase},
          ${item.refundAmount}
        )`;
      const [movement] = (await transaction`
        select coalesce(sum(qty_change), 0)::numeric(12,3) as qty
        from stock_movements
        where product_id = ${item.productId} and location = ${SALE_LOCATION}`) as Array<{
        qty: string;
      }>;
      const next = Number(movement.qty) + Number(item.qtyBase);
      await transaction`
        insert into stock_movements (
          product_id, location, qty_change, movement_type, reference_type,
          reference_id, notes, flagged, flag_reason, created_by
        )
        values (
          ${item.productId}, ${SALE_LOCATION}, ${item.qtyBase}, 'RETURN',
          'RETURN', ${created.id}, ${created.return_no},
          ${next < 0}, ${next < 0 ? "NEGATIVE_STOCK" : null},
          ${context.user!.id}
        )`;
    }

    if (cashRefund > 0 && refundMethod) {
      await insertAutoCashFlow(transaction, {
        type: "OUT",
        paymentMethod: refundMethod,
        category: "REFUND",
        amount: cashRefund,
        shiftId,
        referenceType: "SALE_RETURN",
        referenceId: created.id,
        notes: created.return_no,
        createdBy: context.user!.id,
      });
    }

    return created.id as string;
  });

  const returnView = await getSaleReturn(returnId);
  if (!returnView) throw notFound("Retur tidak ditemukan.");
  return returnView;
}

async function getSaleReturn(id: string): Promise<SaleReturnView | null> {
  const client = await getSqlClient();
  const [row] = (await client`
    select
      id, return_no, sale_id, created_by, reason, total_refund, cash_refund,
      refund_method, refunded_at, shift_id, created_at
    from sale_returns where id = ${id} limit 1`) as Array<{
    id: string;
    return_no: string;
    sale_id: string;
    created_by: string;
    reason: string;
    total_refund: string;
    cash_refund: string;
    refund_method: "CASH" | "QRIS" | "TRANSFER" | "DEBIT" | null;
    refunded_at: Date | null;
    shift_id: string | null;
    created_at: Date;
  }>;
  if (!row) return null;
  const creator = await findUserById(row.created_by);
  if (!creator) return null;
  const itemRows = (await client`
    select id, sale_item_id, qty, qty_base, refund_amount
    from sale_return_items where return_id = ${id} order by id`) as Array<{
    id: string;
    sale_item_id: string;
    qty: string;
    qty_base: string;
    refund_amount: string;
  }>;
  const saleRow = await getSale(row.sale_id);
  const itemMap = new Map(saleRow?.items.map((item) => [item.id, item]) ?? []);
  const items: SaleReturnItemView[] = [];
  for (const item of itemRows) {
    const saleItem = itemMap.get(item.sale_item_id);
    if (!saleItem) continue;
    items.push({
      id: item.id,
      saleItemId: item.sale_item_id,
      saleItem,
      qty: decimal(item.qty),
      qtyBase: decimal(item.qty_base),
      refundAmount: money(item.refund_amount),
    });
  }
  return {
    id: row.id,
    returnNo: row.return_no,
    saleId: row.sale_id,
    createdBy: userRowToContextUser(creator, null),
    reason: row.reason,
    totalRefund: money(row.total_refund),
    cashRefund: money(row.cash_refund),
    refundMethod: row.refund_method,
    refundedAt: row.refunded_at,
    shiftId: row.shift_id,
    items,
    createdAt: row.created_at,
  };
}

export async function voidSale(
  context: RequestContext,
  id: string,
  reason: string,
): Promise<SaleView> {
  if (!context.user) throw validationFailed("Pengguna tidak dikenal.");
  if (!reason.trim()) throw validationFailed("Alasan void wajib diisi.");
  const client = await getSqlClient();

  await client.begin(async (transaction) => {
    const [sale] = (await transaction`
      select id, status from sales where id = ${id} for update`) as Array<{
      id: string;
      status: "COMPLETED" | "VOIDED";
    }>;
    if (!sale) throw notFound("Penjualan tidak ditemukan.");
    if (sale.status === "VOIDED") return;

    const [counts] = await transaction`
      select
        (select count(*)::int from sale_payments where sale_id = ${id}) as payments,
        (select count(*)::int from sale_returns where sale_id = ${id}) as returns`;
    if (Number(counts.payments) > 0 || Number(counts.returns) > 0) {
      throw conflict(
        "Penjualan yang sudah dibayar/diretur harus memakai retur.",
      );
    }

    const items = (await transaction`
      select product_id, qty_base from sale_items where sale_id = ${id}`) as Array<{
      product_id: string;
      qty_base: string;
    }>;
    const voidProductIds = [
      ...new Set(items.map((item) => item.product_id)),
    ].sort();
    if (voidProductIds.length > 0) {
      await transaction`
        select id from products where id = any(${voidProductIds}::uuid[])
        order by id for update`;
    }
    const balances = (await transaction`
      select product_id, coalesce(sum(qty_change), 0)::numeric(12,3) as qty
      from stock_movements
      where product_id = any(${voidProductIds}::uuid[])
        and location = ${SALE_LOCATION}
      group by product_id`) as Array<{ product_id: string; qty: string }>;
    const balanceMap = new Map(
      balances.map((row) => [row.product_id, Number(row.qty)]),
    );
    for (const item of items) {
      const next =
        (balanceMap.get(item.product_id) ?? 0) + Number(item.qty_base);
      balanceMap.set(item.product_id, next);
      await transaction`
        insert into stock_movements (
          product_id, location, qty_change, movement_type, reference_type,
          reference_id, notes, flagged, flag_reason, created_by
        )
        values (
          ${item.product_id}, ${SALE_LOCATION}, ${item.qty_base},
          'SALE_VOID', 'SALE', ${id}, ${reason.trim()}, ${next < 0},
          ${next < 0 ? "NEGATIVE_STOCK" : null}, ${context.user!.id}
        )`;
    }

    await transaction`
      update sales
      set
        status = 'VOIDED',
        voided_at = now(),
        voided_by = ${context.user!.id},
        void_reason = ${reason.trim()},
        updated_at = now()
      where id = ${id}`;
  });

  const sale = await getSale(id);
  if (!sale) throw notFound("Penjualan tidak ditemukan.");
  return sale;
}
