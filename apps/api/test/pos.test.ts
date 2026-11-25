import assert from "node:assert/strict";
import { after, test } from "node:test";

import { randomSuffix, testSql } from "./db.ts";

after(() => testSql.end());

async function expectPgError(
  promise: Promise<unknown>,
  code: string,
  constraint?: string,
  column?: string,
) {
  await assert.rejects(promise, (error: unknown) => {
    const pgError = error as {
      code?: string;
      constraint?: string;
      constraint_name?: string;
      column?: string;
      column_name?: string;
    };
    assert.equal(pgError.code, code);
    if (constraint !== undefined) {
      assert.equal(pgError.constraint ?? pgError.constraint_name, constraint);
    }
    if (column !== undefined) {
      assert.equal(pgError.column ?? pgError.column_name, column);
    }
    return true;
  });
}

type Fixture = {
  userId: string;
  customerId: string;
  productId: string;
  productUnitId: string;
  shiftId: string;
};

async function createUser(): Promise<string> {
  const suffix = randomSuffix();
  const [user] = await testSql`
    insert into users (name, username, password_hash, role)
    values (${`Cashier ${suffix}`}, ${`cashier-${suffix}`}, 'hash', 'CASHIER')
    returning id`;
  return user.id;
}

async function createShift(userId: string): Promise<string> {
  const [shift] = await testSql`
    insert into cashier_shifts (user_id)
    values (${userId})
    returning id, status`;
  assert.equal(shift.status, "OPEN");
  return shift.id;
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomSuffix();
  const userId = await createUser();
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
  const [unit] = await testSql`
    insert into product_units (product_id, unit_name, conversion_qty, selling_price)
    values (${product.id}, ${`unit-${suffix}`}, 1, 5000)
    returning id`;
  const shiftId = await createShift(userId);

  return {
    userId,
    customerId: customer.id,
    productId: product.id,
    productUnitId: unit.id,
    shiftId,
  };
}

type SaleOptions = {
  invoiceNo?: string;
  subtotal?: number;
  discount?: number;
  totalAmount?: number;
  settlementMethod?: string;
  customerId?: string | null;
  status?: string;
  voidedAt?: Date | null;
  voidedBy?: string | null;
  voidReason?: string | null;
};

async function createSale(fixture: Fixture, options: SaleOptions = {}) {
  const subtotal = options.subtotal ?? 10000;
  const discount = options.discount ?? 0;
  const invoiceNo = options.invoiceNo ?? `INV-${randomSuffix()}`;
  const [sale] = await testSql`
    insert into sales (
      invoice_no,
      shift_id,
      user_id,
      customer_id,
      subtotal,
      discount,
      total_amount,
      settlement_method,
      status,
      voided_at,
      voided_by,
      void_reason
    )
    values (
      ${invoiceNo},
      ${fixture.shiftId},
      ${fixture.userId},
      ${options.customerId ?? null},
      ${subtotal},
      ${discount},
      ${options.totalAmount ?? subtotal - discount},
      ${options.settlementMethod ?? "CASH"},
      ${options.status ?? "COMPLETED"},
      ${options.voidedAt ?? null},
      ${options.voidedBy ?? null},
      ${options.voidReason ?? null}
    )
    returning id, status`;
  return sale;
}

type SaleItemOptions = {
  qty?: number;
  qtyBase?: number;
  unitPrice?: number;
  discount?: number;
  unitCost?: number;
  subtotal?: number;
  productId?: string;
  productUnitId?: string;
  productName?: string;
  unitName?: string;
};

async function createSaleItem(
  saleId: string,
  fixture: Fixture,
  options: SaleItemOptions = {},
) {
  const qty = options.qty ?? 1;
  const unitPrice = options.unitPrice ?? 5000;
  const [item] = await testSql`
    insert into sale_items (
      sale_id,
      product_id,
      product_unit_id,
      product_name,
      unit_name,
      qty,
      qty_base,
      unit_price,
      discount,
      unit_cost,
      subtotal
    )
    values (
      ${saleId},
      ${options.productId ?? fixture.productId},
      ${options.productUnitId ?? fixture.productUnitId},
      ${options.productName ?? "Snapshot product"},
      ${options.unitName ?? "Snapshot unit"},
      ${qty},
      ${options.qtyBase ?? qty},
      ${unitPrice},
      ${options.discount ?? 0},
      ${options.unitCost ?? 3000},
      ${options.subtotal ?? Math.round(qty * unitPrice)}
    )
    returning id`;
  return item;
}

test("cashier_shifts allow only one OPEN shift per user", async () => {
  const fixture = await createFixture();

  await expectPgError(
    testSql`
      insert into cashier_shifts (user_id)
      values (${fixture.userId})`,
    "23505",
    "cashier_shifts_open_per_user_unique",
  );

  await testSql`
    update cashier_shifts
    set status = 'CLOSED',
        closed_at = now(),
        expected_cash = 100000,
        actual_cash = 99000
    where id = ${fixture.shiftId}`;

  const [shift] = await testSql`
    insert into cashier_shifts (user_id)
    values (${fixture.userId})
    returning status, closed_at`;
  assert.equal(shift.status, "OPEN");
  assert.equal(shift.closed_at, null);
});

test("cashier_shifts keep close fields consistent with status", async () => {
  const userId = await createUser();

  await expectPgError(
    testSql`
      insert into cashier_shifts (user_id, status, closed_at)
      values (${userId}, 'OPEN', now())`,
    "23514",
    "cashier_shifts_close_fields_consistent",
  );

  await expectPgError(
    testSql`
      insert into cashier_shifts (user_id, status)
      values (${userId}, 'CLOSED')`,
    "23514",
    "cashier_shifts_close_fields_consistent",
  );

  const [shift] = await testSql`
    insert into cashier_shifts (
      user_id,
      status,
      closed_at,
      expected_cash,
      actual_cash
    )
    values (${userId}, 'CLOSED', now(), 50000, 48000)
    returning status, expected_cash, actual_cash`;
  assert.equal(shift.status, "CLOSED");
  assert.equal(Number(shift.expected_cash), 50000);
  assert.equal(Number(shift.actual_cash), 48000);
});

test("cashier_shifts allow negative expected cash at close but reject negative actual cash", async () => {
  const expectedUser = await createUser();
  const expectedShift = await createShift(expectedUser);

  const [closed] = await testSql`
    update cashier_shifts
    set status = 'CLOSED',
        closed_at = now(),
        expected_cash = -1000,
        actual_cash = 0
    where id = ${expectedShift}
    returning expected_cash, actual_cash`;
  assert.equal(Number(closed.expected_cash), -1000);
  assert.equal(Number(closed.actual_cash), 0);

  const actualUser = await createUser();
  const actualShift = await createShift(actualUser);

  await expectPgError(
    testSql`
      update cashier_shifts
      set status = 'CLOSED',
          closed_at = now(),
          expected_cash = 1000,
          actual_cash = -1
      where id = ${actualShift}`,
    "23514",
    "cashier_shifts_actual_cash_non_negative",
  );
});

test("sales enforce the header total and line discounts", async () => {
  const fixture = await createFixture();
  const sale = await createSale(fixture, {
    subtotal: 15000,
    discount: 1500,
    totalAmount: 13500,
  });
  const [row] = await testSql`
    select subtotal, discount, total_amount, settlement_method, status
    from sales
    where id = ${sale.id}`;

  assert.equal(Number(row.subtotal), 15000);
  assert.equal(Number(row.discount), 1500);
  assert.equal(Number(row.total_amount), 13500);
  assert.equal(row.settlement_method, "CASH");
  assert.equal(row.status, "COMPLETED");

  await expectPgError(
    createSale(fixture, {
      subtotal: 15000,
      discount: 1500,
      totalAmount: 13501,
    }),
    "23514",
    "sales_total_matches_subtotal_discount",
  );

  await expectPgError(
    createSale(fixture, { subtotal: 1000, discount: 1500, totalAmount: -500 }),
    "23514",
  );
});

test("sales require a shift", async () => {
  const fixture = await createFixture();

  await expectPgError(
    testSql`
      insert into sales (
        invoice_no, shift_id, user_id, subtotal, total_amount, settlement_method
      )
      values (
        ${`INV-${randomSuffix()}`}, null, ${fixture.userId}, 5000, 5000, 'CASH'
      )`,
    "23502",
    undefined,
    "shift_id",
  );

  const sale = await createSale(fixture, { subtotal: 5000, totalAmount: 5000 });
  const [row] = await testSql`
    select shift_id, user_id from sales where id = ${sale.id}`;
  assert.equal(row.shift_id, fixture.shiftId);
  assert.equal(row.user_id, fixture.userId);
});

test("sales reject blank invoice numbers", async () => {
  const fixture = await createFixture();

  await expectPgError(
    createSale(fixture, { invoiceNo: "   " }),
    "23514",
    "sales_invoice_no_not_blank",
  );
});

test("sale_items store the gross subtotal with a per-unit discount", async () => {
  const fixture = await createFixture();
  const sale = await createSale(fixture, {
    subtotal: 15000,
    discount: 1500,
    totalAmount: 13500,
  });
  const item = await createSaleItem(sale.id, fixture, {
    qty: 3,
    qtyBase: 3,
    unitPrice: 5000,
    discount: 500,
    unitCost: 3000,
    subtotal: 15000,
  });
  const [row] = await testSql`
    select
      product_name,
      unit_name,
      qty,
      qty_base,
      unit_price,
      discount,
      unit_cost,
      subtotal
    from sale_items
    where id = ${item.id}`;

  assert.equal(row.product_name, "Snapshot product");
  assert.equal(row.unit_name, "Snapshot unit");
  assert.equal(Number(row.qty), 3);
  assert.equal(Number(row.qty_base), 3);
  assert.equal(Number(row.unit_price), 5000);
  assert.equal(Number(row.discount), 500);
  assert.equal(Number(row.unit_cost), 3000);
  assert.equal(Number(row.subtotal), 15000);

  await expectPgError(
    createSaleItem(sale.id, fixture, {
      qty: 3,
      unitPrice: 5000,
      subtotal: 14999,
    }),
    "23514",
    "sale_items_subtotal_matches_qty_price",
  );

  await expectPgError(
    createSaleItem(sale.id, fixture, {
      qty: 1,
      unitPrice: 1000,
      discount: 1001,
      subtotal: 1000,
    }),
    "23514",
    "sale_items_discount_within_unit_price",
  );

  await expectPgError(
    createSaleItem(sale.id, fixture, { qty: 0, qtyBase: 1, subtotal: 0 }),
    "23514",
    "sale_items_qty_positive",
  );

  await expectPgError(
    createSaleItem(sale.id, fixture, { unitPrice: -1, subtotal: -1 }),
    "23514",
  );

  await expectPgError(
    createSaleItem(sale.id, fixture, { unitCost: -1 }),
    "23514",
    "sale_items_unit_cost_non_negative",
  );
});

test("sale_items round fractional quantities and require the unit to belong to the product", async () => {
  const fixture = await createFixture();
  const sale = await createSale(fixture, { subtotal: 5000, totalAmount: 5000 });

  const item = await createSaleItem(sale.id, fixture, {
    qty: 1.5,
    qtyBase: 1.5,
    unitPrice: 3333,
    subtotal: 5000,
  });
  const [row] = await testSql`
    select subtotal from sale_items where id = ${item.id}`;
  assert.equal(Number(row.subtotal), 5000);

  await expectPgError(
    createSaleItem(sale.id, fixture, {
      qty: 1.5,
      qtyBase: 1.5,
      unitPrice: 3333,
      subtotal: 4999,
    }),
    "23514",
    "sale_items_subtotal_matches_qty_price",
  );

  const suffix = randomSuffix();
  const [otherCategory] = await testSql`
    insert into categories (name)
    values (${`Other category ${suffix}`})
    returning id`;
  const [otherProduct] = await testSql`
    insert into products (sku, name, category_id, base_unit)
    values (${`SKU-${suffix}`}, ${`Other ${suffix}`}, ${otherCategory.id}, 'pcs')
    returning id`;
  const [otherUnit] = await testSql`
    insert into product_units (product_id, unit_name, conversion_qty, selling_price)
    values (${otherProduct.id}, ${`other-${suffix}`}, 1, 1000)
    returning id`;

  await expectPgError(
    createSaleItem(sale.id, fixture, {
      productId: fixture.productId,
      productUnitId: otherUnit.id,
    }),
    "23503",
    "sale_items_product_unit_fk",
  );
});

test("sale_items reject blank snapshot names", async () => {
  const fixture = await createFixture();
  const sale = await createSale(fixture);

  await expectPgError(
    createSaleItem(sale.id, fixture, { productName: "" }),
    "23514",
    "sale_items_product_name_not_blank",
  );

  await expectPgError(
    createSaleItem(sale.id, fixture, { unitName: "   " }),
    "23514",
    "sale_items_unit_name_not_blank",
  );
});

test("sale_payments accept cash tender with change and non-cash without tender", async () => {
  const fixture = await createFixture();
  const sale = await createSale(fixture, {
    subtotal: 20000,
    totalAmount: 20000,
  });

  const [cash] = await testSql`
    insert into sale_payments (
      sale_id,
      method,
      amount,
      cash_received,
      change,
      shift_id,
      received_by
    )
    values (${sale.id}, 'CASH', 20000, 25000, 5000, ${fixture.shiftId}, ${fixture.userId})
    returning method, amount, cash_received, change, shift_id`;
  assert.equal(cash.method, "CASH");
  assert.equal(Number(cash.amount), 20000);
  assert.equal(Number(cash.cash_received), 25000);
  assert.equal(Number(cash.change), 5000);
  assert.equal(cash.shift_id, fixture.shiftId);

  await expectPgError(
    testSql`
      insert into sale_payments (
        sale_id, method, amount, cash_received, change, shift_id, received_by
      )
      values (${sale.id}, 'CASH', 20000, 25000, 4999, ${fixture.shiftId}, ${fixture.userId})`,
    "23514",
    "sale_payments_cash_tender_consistent",
  );

  await expectPgError(
    testSql`
      insert into sale_payments (
        sale_id, method, amount, cash_received, change, shift_id, received_by
      )
      values (${sale.id}, 'CASH', 20000, 15000, 0, ${fixture.shiftId}, ${fixture.userId})`,
    "23514",
    "sale_payments_cash_tender_consistent",
  );

  const [qris] = await testSql`
    insert into sale_payments (
      sale_id, method, amount, payment_ref, received_by
    )
    values (${sale.id}, 'QRIS', 5000, 'QR-123', ${fixture.userId})
    returning method, amount, cash_received, change, shift_id`;
  assert.equal(qris.method, "QRIS");
  assert.equal(Number(qris.amount), 5000);
  assert.equal(Number(qris.cash_received), 0);
  assert.equal(Number(qris.change), 0);
  assert.equal(qris.shift_id, null);

  await expectPgError(
    testSql`
      insert into sale_payments (
        sale_id, method, amount, cash_received, received_by
      )
      values (${sale.id}, 'QRIS', 5000, 100, ${fixture.userId})`,
    "23514",
    "sale_payments_cash_tender_consistent",
  );

  await expectPgError(
    testSql`
      insert into sale_payments (
        sale_id, method, amount, shift_id, received_by
      )
      values (${sale.id}, 'TRANSFER', 5000, ${fixture.shiftId}, ${fixture.userId})`,
    "23514",
    "sale_payments_non_cash_shift_null",
  );

  await expectPgError(
    testSql`
      insert into sale_payments (sale_id, method, amount, received_by)
      values (${sale.id}, 'DEBIT', 0, ${fixture.userId})`,
    "23514",
    "sale_payments_amount_positive",
  );

  await expectPgError(
    testSql`
      insert into sale_payments (sale_id, method, amount, received_by)
      values (${sale.id}, 'DEBT', 1000, ${fixture.userId})`,
    "22P02",
  );
});

test("sale_payments support split tender with a MIXED settlement label", async () => {
  const fixture = await createFixture();
  const sale = await createSale(fixture, {
    subtotal: 15000,
    totalAmount: 15000,
    settlementMethod: "MIXED",
  });

  await testSql`
    insert into sale_payments (
      sale_id, method, amount, cash_received, change, shift_id, received_by
    )
    values (${sale.id}, 'CASH', 10000, 10000, 0, ${fixture.shiftId}, ${fixture.userId})`;
  await testSql`
    insert into sale_payments (sale_id, method, amount, received_by)
    values (${sale.id}, 'QRIS', 5000, ${fixture.userId})`;

  const [row] = await testSql`
    select
      (select count(*)::int from sale_payments where sale_id = ${sale.id}) as payment_count,
      (select sum(amount)::bigint from sale_payments where sale_id = ${sale.id}) as paid,
      settlement_method
    from sales
    where id = ${sale.id}`;
  assert.equal(row.payment_count, 2);
  assert.equal(Number(row.paid), 15000);
  assert.equal(row.settlement_method, "MIXED");
});

test("sales accept every settlement label and require a customer for DEBT", async () => {
  const fixture = await createFixture();

  for (const settlementMethod of [
    "CASH",
    "QRIS",
    "TRANSFER",
    "DEBIT",
    "MIXED",
    "DEBT",
  ]) {
    const sale = await createSale(fixture, {
      subtotal: 5000,
      totalAmount: 5000,
      settlementMethod,
      customerId: settlementMethod === "DEBT" ? fixture.customerId : null,
    });
    assert.equal(sale.status, "COMPLETED");
  }

  await expectPgError(
    createSale(fixture, { settlementMethod: "DEBT", customerId: null }),
    "23514",
    "sales_debt_requires_customer",
  );

  const debtSale = await createSale(fixture, {
    subtotal: 5000,
    totalAmount: 5000,
    settlementMethod: "DEBT",
    customerId: fixture.customerId,
  });
  const [row] = await testSql`
    select
      (select count(*)::int from sale_payments where sale_id = ${debtSale.id}) as payment_count,
      settlement_method,
      customer_id
    from sales
    where id = ${debtSale.id}`;
  assert.equal(row.payment_count, 0);
  assert.equal(row.settlement_method, "DEBT");
  assert.equal(row.customer_id, fixture.customerId);
});

test("sales require void audit fields when VOIDED", async () => {
  const fixture = await createFixture();
  const sale = await createSale(fixture);

  const [voided] = await testSql`
    update sales
    set status = 'VOIDED',
        voided_at = now(),
        voided_by = ${fixture.userId},
        void_reason = 'duplicate entry'
    where id = ${sale.id}
    returning status, voided_at, voided_by, void_reason`;
  assert.equal(voided.status, "VOIDED");
  assert.ok(voided.voided_at instanceof Date);
  assert.equal(voided.voided_by, fixture.userId);
  assert.equal(voided.void_reason, "duplicate entry");

  await expectPgError(
    testSql`
      update sales
      set status = 'VOIDED',
          voided_at = null,
          voided_by = null,
          void_reason = null
      where id = ${sale.id}`,
    "23514",
    "sales_void_fields_consistent",
  );

  await expectPgError(
    createSale(fixture, {
      status: "VOIDED",
      voidedAt: new Date(),
      voidedBy: fixture.userId,
      voidReason: null,
    }),
    "23514",
    "sales_void_fields_consistent",
  );

  await expectPgError(
    createSale(fixture, {
      status: "COMPLETED",
      voidedAt: new Date(),
      voidedBy: fixture.userId,
      voidReason: "unexpected",
    }),
    "23514",
    "sales_void_fields_consistent",
  );
});

test("sale_returns track refunds and reduce the net sale total", async () => {
  const fixture = await createFixture();
  const sale = await createSale(fixture, {
    subtotal: 15000,
    totalAmount: 15000,
  });
  await testSql`
    insert into sale_payments (
      sale_id, method, amount, cash_received, change, shift_id, received_by
    )
    values (${sale.id}, 'CASH', 15000, 15000, 0, ${fixture.shiftId}, ${fixture.userId})`;
  const item = await createSaleItem(sale.id, fixture, {
    qty: 3,
    unitPrice: 5000,
    subtotal: 15000,
  });

  const [saleReturn] = await testSql`
    insert into sale_returns (
      return_no,
      sale_id,
      created_by,
      reason,
      total_refund,
      cash_refund,
      refund_method,
      refunded_at,
      shift_id
    )
    values (
      ${`RET-${randomSuffix()}`},
      ${sale.id},
      ${fixture.userId},
      'damaged item',
      5000,
      2000,
      'CASH',
      now(),
      ${fixture.shiftId}
    )
    returning
      id,
      total_refund,
      cash_refund,
      refund_method,
      shift_id,
      refunded_at`;

  assert.equal(Number(saleReturn.total_refund), 5000);
  assert.equal(Number(saleReturn.cash_refund), 2000);
  assert.equal(saleReturn.refund_method, "CASH");
  assert.equal(saleReturn.shift_id, fixture.shiftId);
  assert.ok(saleReturn.refunded_at instanceof Date);

  const [returnItem] = await testSql`
    insert into sale_return_items (
      return_id,
      sale_item_id,
      qty,
      qty_base,
      refund_amount
    )
    values (${saleReturn.id}, ${item.id}, 1, 1, 2500)
    returning qty, qty_base, refund_amount`;
  assert.equal(Number(returnItem.qty), 1);
  assert.equal(Number(returnItem.qty_base), 1);
  assert.equal(Number(returnItem.refund_amount), 2500);

  const [row] = await testSql`
    select
      sales.total_amount - coalesce(sum(sale_returns.total_refund), 0) as net_total,
      coalesce(sum(sale_returns.cash_refund), 0) as refunded
    from sales
    left join sale_returns on sale_returns.sale_id = sales.id
    where sales.id = ${sale.id}
    group by sales.id`;
  assert.equal(Number(row.net_total), 10000);
  assert.equal(Number(row.refunded), 2000);
});

test("sale_returns allow a zero-cash kasbon return and reject invalid refunds", async () => {
  const fixture = await createFixture();
  const sale = await createSale(fixture, {
    subtotal: 15000,
    totalAmount: 15000,
    settlementMethod: "DEBT",
    customerId: fixture.customerId,
  });

  const [kasbonReturn] = await testSql`
    insert into sale_returns (
      return_no, sale_id, created_by, reason, total_refund, cash_refund
    )
    values (
      ${`RET-${randomSuffix()}`},
      ${sale.id},
      ${fixture.userId},
      'kasbon item returned',
      5000,
      0
    )
    returning cash_refund, refund_method, refunded_at, shift_id`;
  assert.equal(Number(kasbonReturn.cash_refund), 0);
  assert.equal(kasbonReturn.refund_method, null);
  assert.equal(kasbonReturn.refunded_at, null);
  assert.equal(kasbonReturn.shift_id, null);

  await expectPgError(
    testSql`
      insert into sale_returns (
        return_no, sale_id, created_by, reason, total_refund, cash_refund,
        refund_method, refunded_at, shift_id
      )
      values (
        ${`RET-${randomSuffix()}`}, ${sale.id}, ${fixture.userId},
        'damaged item', 5000, 5001, 'CASH', now(), ${fixture.shiftId}
      )`,
    "23514",
    "sale_returns_cash_refund_within_total",
  );

  await expectPgError(
    testSql`
      insert into sale_returns (
        return_no, sale_id, created_by, reason, total_refund, cash_refund,
        refund_method, refunded_at
      )
      values (
        ${`RET-${randomSuffix()}`}, ${sale.id}, ${fixture.userId},
        'damaged item', 5000, 1000, 'CASH', now()
      )`,
    "23514",
    "sale_returns_cash_refund_requires_shift",
  );

  await expectPgError(
    testSql`
      insert into sale_returns (
        return_no, sale_id, created_by, reason, total_refund, cash_refund
      )
      values (
        ${`RET-${randomSuffix()}`}, ${sale.id}, ${fixture.userId},
        'empty return', 0, 0
      )`,
    "23514",
    "sale_returns_total_refund_positive",
  );

  await expectPgError(
    testSql`
      insert into sale_returns (
        return_no, sale_id, created_by, total_refund, cash_refund
      )
      values (
        ${`RET-${randomSuffix()}`}, ${sale.id}, ${fixture.userId}, 5000, 0
      )`,
    "23502",
    undefined,
    "reason",
  );

  await expectPgError(
    testSql`
      insert into sale_returns (
        return_no, sale_id, created_by, reason, total_refund, cash_refund
      )
      values (
        ${`RET-${randomSuffix()}`}, ${sale.id}, ${fixture.userId},
        '   ', 5000, 0
      )`,
    "23514",
    "sale_returns_reason_not_blank",
  );
});

test("sale_returns reject blank return numbers", async () => {
  const fixture = await createFixture();
  const sale = await createSale(fixture);

  await expectPgError(
    testSql`
      insert into sale_returns (
        return_no, sale_id, created_by, reason, total_refund, cash_refund
      )
      values (
        '   ', ${sale.id}, ${fixture.userId}, 'damaged item', 5000, 0
      )`,
    "23514",
    "sale_returns_return_no_not_blank",
  );
});

test("sale_return_items require positive quantities and non-negative refunds", async () => {
  const fixture = await createFixture();
  const sale = await createSale(fixture);
  const item = await createSaleItem(sale.id, fixture);
  const [saleReturn] = await testSql`
    insert into sale_returns (
      return_no, sale_id, created_by, reason, total_refund, cash_refund
    )
    values (
      ${`RET-${randomSuffix()}`}, ${sale.id}, ${fixture.userId},
      'damaged item', 5000, 0
    )
    returning id`;

  await expectPgError(
    testSql`
      insert into sale_return_items (
        return_id, sale_item_id, qty, qty_base, refund_amount
      )
      values (${saleReturn.id}, ${item.id}, 0, 1, 1000)`,
    "23514",
    "sale_return_items_qty_positive",
  );

  await expectPgError(
    testSql`
      insert into sale_return_items (
        return_id, sale_item_id, qty, qty_base, refund_amount
      )
      values (${saleReturn.id}, ${item.id}, 1, 1, -1)`,
    "23514",
    "sale_return_items_refund_amount_non_negative",
  );

  await expectPgError(
    testSql`
      insert into sale_return_items (
        return_id, sale_item_id, qty, qty_base, refund_amount
      )
      values (${saleReturn.id}, ${item.id}, 1, 0, 1000)`,
    "23514",
    "sale_return_items_qty_base_positive",
  );

  await expectPgError(
    testSql`
      insert into sale_return_items (
        return_id, sale_item_id, qty, refund_amount
      )
      values (${saleReturn.id}, ${item.id}, 1, 1000)`,
    "23502",
    undefined,
    "qty_base",
  );
});

test("cash_flows reject duplicate AUTO references and inconsistent references", async () => {
  const fixture = await createFixture();
  const sale = await createSale(fixture, {
    subtotal: 10000,
    totalAmount: 10000,
  });
  const [payment] = await testSql`
    insert into sale_payments (
      sale_id, method, amount, cash_received, change, shift_id, received_by
    )
    values (${sale.id}, 'CASH', 10000, 10000, 0, ${fixture.shiftId}, ${fixture.userId})
    returning id`;

  const [flow] = await testSql`
    insert into cash_flows (
      type,
      payment_method,
      category,
      amount,
      shift_id,
      reference_type,
      reference_id,
      source,
      created_by
    )
    values (
      'IN', 'CASH', 'SALES', 10000, ${fixture.shiftId},
      'SALE_PAYMENT', ${payment.id}, 'AUTO', ${fixture.userId}
    )
    returning type, source, reference_type`;
  assert.equal(flow.type, "IN");
  assert.equal(flow.source, "AUTO");
  assert.equal(flow.reference_type, "SALE_PAYMENT");

  await expectPgError(
    testSql`
      insert into cash_flows (
        type, payment_method, category, amount, shift_id,
        reference_type, reference_id, source, created_by
      )
      values (
        'IN', 'CASH', 'SALES', 10000, ${fixture.shiftId},
        'SALE_PAYMENT', ${payment.id}, 'AUTO', ${fixture.userId}
      )`,
    "23505",
    "cash_flows_auto_reference_unique",
  );

  await expectPgError(
    testSql`
      insert into cash_flows (
        type, payment_method, category, amount,
        reference_type, reference_id, source, created_by
      )
      values ('IN', 'CASH', 'SALES', 1000, 'SALE_PAYMENT', null, 'AUTO', ${fixture.userId})`,
    "23514",
    "cash_flows_reference_consistency",
  );

  await expectPgError(
    testSql`
      insert into cash_flows (
        type, payment_method, category, amount,
        reference_type, reference_id, source, created_by
      )
      values ('IN', 'CASH', 'SALES', 1000, 'MANUAL', null, 'AUTO', ${fixture.userId})`,
    "23514",
    "cash_flows_reference_consistency",
  );

  await expectPgError(
    testSql`
      insert into cash_flows (
        type, payment_method, category, amount,
        reference_type, reference_id, source, created_by
      )
      values ('OUT', 'CASH', 'EXPENSE', 1000, 'MANUAL', ${crypto.randomUUID()}, 'MANUAL', ${fixture.userId})`,
    "23514",
    "cash_flows_reference_consistency",
  );

  await expectPgError(
    testSql`
      insert into cash_flows (
        type, payment_method, category, amount, shift_id,
        reference_type, source, created_by
      )
      values ('IN', 'QRIS', 'SALES', 1000, ${fixture.shiftId}, 'MANUAL', 'MANUAL', ${fixture.userId})`,
    "23514",
    "cash_flows_non_cash_shift_null",
  );

  await expectPgError(
    testSql`
      insert into cash_flows (
        type, payment_method, category, amount,
        reference_type, source, created_by
      )
      values ('OUT', 'CASH', 'EXPENSE', 0, 'MANUAL', 'MANUAL', ${fixture.userId})`,
    "23514",
    "cash_flows_amount_positive",
  );
});

test("cash_flows accept MANUAL rows without a reference and all reference types", async () => {
  const fixture = await createFixture();

  const [manual] = await testSql`
    insert into cash_flows (
      type, payment_method, category, amount, shift_id,
      reference_type, reference_id, source, notes, created_by
    )
    values (
      'OUT', 'CASH', 'EXPENSE', 25000, ${fixture.shiftId},
      'MANUAL', null, 'MANUAL', 'cleaning supplies', ${fixture.userId}
    )
    returning reference_type, reference_id, source`;
  assert.equal(manual.reference_type, "MANUAL");
  assert.equal(manual.reference_id, null);
  assert.equal(manual.source, "MANUAL");

  await testSql`
    insert into cash_flows (
      type, payment_method, category, amount,
      reference_type, source, created_by
    )
    values ('OUT', 'CASH', 'OTHER', 5000, 'MANUAL', 'MANUAL', ${fixture.userId})`;

  for (const referenceType of [
    "SALE_PAYMENT",
    "PURCHASE_PAYMENT",
    "SALE_RETURN",
    "PURCHASE_CANCEL",
  ]) {
    const [flow] = await testSql`
      insert into cash_flows (
        type, payment_method, category, amount,
        reference_type, reference_id, source, created_by
      )
      values (
        'IN', 'QRIS', 'OTHER', 1000,
        ${referenceType}, ${crypto.randomUUID()}, 'AUTO', ${fixture.userId}
      )
      returning reference_type`;
    assert.equal(flow.reference_type, referenceType);
  }
});

test("pos schema has no stock balance snapshots on sale lines", async () => {
  const columns = await testSql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'cashier_shifts',
        'sales',
        'sale_items',
        'sale_payments',
        'sale_returns',
        'sale_return_items',
        'cash_flows'
      )`;

  const byTable = new Map<string, string[]>();
  for (const column of columns) {
    const names = byTable.get(column.table_name) ?? [];
    names.push(column.column_name);
    byTable.set(column.table_name, names);
  }

  for (const table of [
    "cashier_shifts",
    "sales",
    "sale_items",
    "sale_payments",
    "sale_returns",
    "sale_return_items",
    "cash_flows",
  ]) {
    assert.ok(byTable.has(table), `missing table ${table}`);
  }

  assert.equal(byTable.get("sale_items")?.includes("balance_after"), false);
  assert.equal(byTable.get("sale_items")?.includes("stock_after"), false);
  assert.equal(byTable.get("sales")?.includes("stock_movement_id"), false);
  assert.ok(byTable.get("sales")?.includes("voided_at"));
  assert.ok(byTable.get("sale_payments")?.includes("shift_id"));
  assert.ok(byTable.get("cash_flows")?.includes("source"));
});
