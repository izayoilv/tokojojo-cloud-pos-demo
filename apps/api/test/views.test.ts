import assert from "node:assert/strict";
import { after, test } from "node:test";

import { expectReject, randomSuffix, testSql } from "./db.ts";

after(() => testSql.end());

type Fixture = {
  userId: string;
  customerId: string;
  productId: string;
  shiftId: string;
  supplierId: string;
  supplierName: string;
};

async function createFixture(): Promise<Fixture> {
  const suffix = randomSuffix();
  const [user] = await testSql`
    insert into users (name, username, password_hash, role)
    values (${`Views ${suffix}`}, ${`views-${suffix}`}, 'hash', 'OWNER')
    returning id`;
  const [customer] = await testSql`
    insert into customers (name)
    values (${`Customer ${suffix}`})
    returning id`;
  const [category] = await testSql`
    insert into categories (name)
    values (${`Category ${suffix}`})
    returning id`;
  const [product] = await testSql`
    insert into products (sku, name, category_id, base_unit)
    values (${`SKU-${suffix}`}, ${`Product ${suffix}`}, ${category.id}, 'pcs')
    returning id`;
  const [shift] = await testSql`
    insert into cashier_shifts (user_id)
    values (${user.id})
    returning id`;
  const [supplier] = await testSql`
    insert into suppliers (name)
    values (${`Supplier ${suffix}`})
    returning id, name`;

  return {
    userId: user.id,
    customerId: customer.id,
    productId: product.id,
    shiftId: shift.id,
    supplierId: supplier.id,
    supplierName: supplier.name,
  };
}

async function addMovement(
  fixture: Fixture,
  location: string,
  qtyChange: number,
  options: { flagged?: boolean; flagReason?: string | null } = {},
) {
  const [movement] = await testSql`
    insert into stock_movements (
      product_id, location, qty_change, movement_type,
      reference_type, flagged, flag_reason, created_by
    )
    values (
      ${fixture.productId}, ${location}, ${qtyChange}, 'ADJUSTMENT',
      'MANUAL', ${options.flagged ?? false}, ${options.flagReason ?? null},
      ${fixture.userId}
    )
    returning id`;
  return movement.id as string;
}

type SaleOptions = {
  totalAmount?: number;
  settlementMethod?: string;
  customerId?: string | null;
  status?: string;
};

async function createSale(
  fixture: Fixture,
  options: SaleOptions = {},
): Promise<string> {
  const totalAmount = options.totalAmount ?? 100_000;
  const status = options.status ?? "COMPLETED";
  const isVoided = status === "VOIDED";
  const [sale] = await testSql`
    insert into sales (
      invoice_no, shift_id, user_id, customer_id,
      subtotal, discount, total_amount, settlement_method,
      status, voided_at, voided_by, void_reason
    )
    values (
      ${`INV-${randomSuffix()}`}, ${fixture.shiftId}, ${fixture.userId},
      ${options.customerId ?? null}, ${totalAmount}, 0, ${totalAmount},
      ${options.settlementMethod ?? "CASH"}, ${status},
      ${isVoided ? new Date() : null},
      ${isVoided ? fixture.userId : null},
      ${isVoided ? "test void" : null}
    )
    returning id`;
  return sale.id as string;
}

async function addSalePayment(
  fixture: Fixture,
  saleId: string,
  amount: number,
) {
  await testSql`
    insert into sale_payments (sale_id, method, amount, received_by)
    values (${saleId}, 'QRIS', ${amount}, ${fixture.userId})`;
}

async function addSaleReturn(
  fixture: Fixture,
  saleId: string,
  totalRefund: number,
  cashRefund: number,
) {
  const hasCashRefund = cashRefund > 0;
  const [saleReturn] = await testSql`
    insert into sale_returns (
      return_no, sale_id, created_by, reason,
      total_refund, cash_refund, refund_method, refunded_at, shift_id
    )
    values (
      ${`RET-${randomSuffix()}`}, ${saleId}, ${fixture.userId}, 'damaged item',
      ${totalRefund}, ${cashRefund},
      ${hasCashRefund ? "CASH" : null},
      ${hasCashRefund ? new Date() : null},
      ${hasCashRefund ? fixture.shiftId : null}
    )
    returning id`;
  return saleReturn.id as string;
}

async function createPurchase(
  fixture: Fixture,
  totalAmount: number,
  options: { status?: string } = {},
): Promise<string> {
  const [purchase] = await testSql`
    insert into purchases (
      purchase_no, supplier_id, supplier_name, created_by, total_amount, status
    )
    values (
      ${`PO-${randomSuffix()}`}, ${fixture.supplierId}, ${fixture.supplierName},
      ${fixture.userId}, ${totalAmount}, ${options.status ?? "OPEN"}
    )
    returning id`;
  return purchase.id as string;
}

async function addPurchasePayment(
  fixture: Fixture,
  purchaseId: string,
  amount: number,
) {
  await testSql`
    insert into purchase_payments (
      purchase_id, amount, payment_method, created_by
    )
    values (${purchaseId}, ${amount}, 'TRANSFER', ${fixture.userId})`;
}

test("v_stock_balances sums signed movements per product and location", async () => {
  const fixture = await createFixture();

  await addMovement(fixture, "WAREHOUSE", 10);
  await addMovement(fixture, "WAREHOUSE", -3);
  await addMovement(fixture, "STORE", 4);
  await addMovement(fixture, "STORE", -6);

  const balances = await testSql`
    select location, qty, is_negative
    from v_stock_balances
    where product_id = ${fixture.productId}
    order by location`;

  assert.equal(balances.length, 2);
  assert.deepEqual(
    balances.map((row) => [row.location, Number(row.qty), row.is_negative]),
    [
      ["WAREHOUSE", 7, false],
      ["STORE", -2, true],
    ],
  );
});

test("v_stock_balances keeps negative stock visible and flaggable", async () => {
  const fixture = await createFixture();

  const movementId = await addMovement(fixture, "STORE", -1, {
    flagged: true,
    flagReason: "NEGATIVE_STOCK",
  });

  const [balance] = await testSql`
    select qty, is_negative
    from v_stock_balances
    where product_id = ${fixture.productId} and location = 'STORE'`;

  assert.equal(Number(balance.qty), -1);
  assert.equal(balance.is_negative, true);

  const [movement] = await testSql`
    select flagged, flag_reason
    from stock_movements
    where id = ${movementId}`;

  assert.equal(movement.flagged, true);
  assert.equal(movement.flag_reason, "NEGATIVE_STOCK");
});

test("stock_movements reject update and delete but accept inserts", async () => {
  const fixture = await createFixture();
  const movementId = await addMovement(fixture, "STORE", 5);

  const updateError = await expectReject(
    () => testSql`
      update stock_movements
      set qty_change = 6
      where id = ${movementId}`,
  );
  assert.match(updateError.message, /append-only/);

  const deleteError = await expectReject(
    () => testSql`delete from stock_movements where id = ${movementId}`,
  );
  assert.match(deleteError.message, /append-only/);

  await addMovement(fixture, "STORE", 2);

  const [counts] = await testSql`
    select count(*)::int as total
    from stock_movements
    where product_id = ${fixture.productId}`;
  assert.equal(counts.total, 2);

  const [balance] = await testSql`
    select qty
    from v_stock_balances
    where product_id = ${fixture.productId} and location = 'STORE'`;
  assert.equal(Number(balance.qty), 7);
});

test("v_sale_balances reports PAID for a fully paid sale", async () => {
  const fixture = await createFixture();
  const saleId = await createSale(fixture);
  await addSalePayment(fixture, saleId, 100_000);

  const [balance] = await testSql`
    select
      total_amount, total_refund, paid, cash_refunded,
      outstanding, refund_due, payment_status
    from v_sale_balances
    where sale_id = ${saleId}`;

  assert.equal(Number(balance.total_amount), 100_000);
  assert.equal(Number(balance.total_refund), 0);
  assert.equal(Number(balance.paid), 100_000);
  assert.equal(Number(balance.cash_refunded), 0);
  assert.equal(Number(balance.outstanding), 0);
  assert.equal(Number(balance.refund_due), 0);
  assert.equal(balance.payment_status, "PAID");
});

test("v_sale_balances reports UNPAID and PARTIAL debt sales", async () => {
  const fixture = await createFixture();

  const unpaidId = await createSale(fixture, {
    settlementMethod: "DEBT",
    customerId: fixture.customerId,
  });

  const partialId = await createSale(fixture, {
    settlementMethod: "DEBT",
    customerId: fixture.customerId,
  });
  await addSalePayment(fixture, partialId, 40_000);

  const unpaid = await testSql`
    select paid, outstanding, refund_due, payment_status
    from v_sale_balances
    where sale_id = ${unpaidId}`;

  assert.equal(Number(unpaid[0].paid), 0);
  assert.equal(Number(unpaid[0].outstanding), 100_000);
  assert.equal(Number(unpaid[0].refund_due), 0);
  assert.equal(unpaid[0].payment_status, "UNPAID");

  const partial = await testSql`
    select paid, outstanding, refund_due, payment_status
    from v_sale_balances
    where sale_id = ${partialId}`;

  assert.equal(Number(partial[0].paid), 40_000);
  assert.equal(Number(partial[0].outstanding), 60_000);
  assert.equal(Number(partial[0].refund_due), 0);
  assert.equal(partial[0].payment_status, "PARTIAL");
});

test("v_sale_balances deducts returns before cash refunds", async () => {
  const fixture = await createFixture();
  const saleId = await createSale(fixture);
  await addSalePayment(fixture, saleId, 100_000);
  await addSaleReturn(fixture, saleId, 30_000, 20_000);

  const [balance] = await testSql`
    select
      total_amount, total_refund, paid, cash_refunded,
      outstanding, refund_due, payment_status
    from v_sale_balances
    where sale_id = ${saleId}`;

  assert.equal(Number(balance.total_amount), 100_000);
  assert.equal(Number(balance.total_refund), 30_000);
  assert.equal(Number(balance.paid), 100_000);
  assert.equal(Number(balance.cash_refunded), 20_000);
  assert.equal(Number(balance.outstanding), 0);
  assert.equal(Number(balance.refund_due), 10_000);
  assert.equal(balance.payment_status, "PAID");
});

test("v_sale_balances keeps a returned debt sale without a cash refund", async () => {
  const fixture = await createFixture();
  const saleId = await createSale(fixture, {
    settlementMethod: "DEBT",
    customerId: fixture.customerId,
  });
  const returnId = await addSaleReturn(fixture, saleId, 40_000, 0);

  const [balance] = await testSql`
    select
      total_amount, total_refund, paid, cash_refunded,
      outstanding, refund_due, payment_status
    from v_sale_balances
    where sale_id = ${saleId}`;

  assert.equal(Number(balance.total_amount), 100_000);
  assert.equal(Number(balance.total_refund), 40_000);
  assert.equal(Number(balance.paid), 0);
  assert.equal(Number(balance.cash_refunded), 0);
  assert.equal(Number(balance.outstanding), 60_000);
  assert.equal(Number(balance.refund_due), 0);
  assert.equal(balance.payment_status, "UNPAID");

  const [refunds] = await testSql`
    select count(*)::int as total
    from cash_flows
    where reference_type = 'SALE_RETURN' and reference_id = ${returnId}`;
  assert.equal(refunds.total, 0);
});

test("v_sale_balances excludes VOIDED sales", async () => {
  const fixture = await createFixture();
  const saleId = await createSale(fixture, { status: "VOIDED" });

  const balances = await testSql`
    select sale_id
    from v_sale_balances
    where sale_id = ${saleId}`;

  assert.equal(balances.length, 0);
});

test("v_purchase_balances reports UNPAID, PARTIAL, and PAID purchases", async () => {
  const fixture = await createFixture();

  const unpaidId = await createPurchase(fixture, 200_000);
  const partialId = await createPurchase(fixture, 200_000);
  await addPurchasePayment(fixture, partialId, 75_000);
  const paidId = await createPurchase(fixture, 200_000);
  await addPurchasePayment(fixture, paidId, 200_000);

  const balances = await testSql`
    select purchase_id, total_amount, paid, outstanding, payment_status
    from v_purchase_balances
    where purchase_id in (${unpaidId}, ${partialId}, ${paidId})
    order by payment_status`;

  assert.deepEqual(
    balances.map((row) => [
      row.purchase_id,
      Number(row.total_amount),
      Number(row.paid),
      Number(row.outstanding),
      row.payment_status,
    ]),
    [
      [paidId, 200_000, 200_000, 0, "PAID"],
      [partialId, 200_000, 75_000, 125_000, "PARTIAL"],
      [unpaidId, 200_000, 0, 200_000, "UNPAID"],
    ],
  );
});

test("v_purchase_balances excludes CANCELLED purchases", async () => {
  const fixture = await createFixture();
  const purchaseId = await createPurchase(fixture, 200_000, {
    status: "CANCELLED",
  });

  const balances = await testSql`
    select purchase_id
    from v_purchase_balances
    where purchase_id = ${purchaseId}`;

  assert.equal(balances.length, 0);
});
