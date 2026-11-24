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
  supplierId: string;
  supplierName: string;
  userId: string;
  productId: string;
  productName: string;
  productUnitId: string;
  unitName: string;
};

async function createFixture(): Promise<Fixture> {
  const suffix = randomSuffix();
  const supplierName = `Supplier ${suffix}`;
  const productName = `Product ${suffix}`;
  const unitName = `unit-${suffix}`;
  const [supplier] = await testSql`
    insert into suppliers (name)
    values (${supplierName})
    returning id`;
  const [user] = await testSql`
    insert into users (name, username, password_hash, role)
    values (${`Buyer ${suffix}`}, ${`buyer-${suffix}`}, 'hash', 'WAREHOUSE')
    returning id`;
  const [category] = await testSql`
    insert into categories (name)
    values (${`Category ${suffix}`})
    returning id`;
  const [product] = await testSql`
    insert into products (sku, name, category_id, base_unit)
    values (${`SKU-${suffix}`}, ${productName}, ${category.id}, 'pcs')
    returning id`;
  const [unit] = await testSql`
    insert into product_units (product_id, unit_name, conversion_qty, selling_price)
    values (${product.id}, ${unitName}, 1, 1000)
    returning id`;

  return {
    supplierId: supplier.id,
    supplierName,
    userId: user.id,
    productId: product.id,
    productName,
    productUnitId: unit.id,
    unitName,
  };
}

type PurchaseOptions = {
  purchaseNo?: string;
  totalAmount?: number;
  supplierInvoiceNo?: string | null;
  dueDate?: string | null;
};

async function createPurchase(fixture: Fixture, options: PurchaseOptions = {}) {
  const purchaseNo = options.purchaseNo ?? `PO-${randomSuffix()}`;
  const [purchase] = await testSql`
    insert into purchases (
      purchase_no,
      supplier_id,
      supplier_name,
      created_by,
      total_amount,
      supplier_invoice_no,
      due_date
    )
    values (
      ${purchaseNo},
      ${fixture.supplierId},
      ${fixture.supplierName},
      ${fixture.userId},
      ${options.totalAmount ?? 0},
      ${options.supplierInvoiceNo ?? null},
      ${options.dueDate ?? null}
    )
    returning
      id,
      purchase_no,
      supplier_name,
      status,
      received_at,
      supplier_invoice_no,
      due_date::text as due_date`;
  return purchase;
}

test("purchases default to OPEN and store the optional invoice and due date", async () => {
  const fixture = await createFixture();
  const supplierInvoiceNo = `INV-${randomSuffix()}`;
  const dueDate = "2026-12-01";

  const purchase = await createPurchase(fixture, {
    totalAmount: 15000,
    supplierInvoiceNo,
    dueDate,
  });

  assert.equal(purchase.status, "OPEN");
  assert.ok(purchase.received_at instanceof Date);
  assert.equal(purchase.supplier_invoice_no, supplierInvoiceNo);
  assert.equal(purchase.due_date, dueDate);
});

test("purchases allow an omitted supplier invoice and due date", async () => {
  const fixture = await createFixture();

  const purchase = await createPurchase(fixture, { totalAmount: 5000 });

  assert.equal(purchase.supplier_invoice_no, null);
  assert.equal(purchase.due_date, null);
});

test("purchases reject a duplicate purchase number", async () => {
  const fixture = await createFixture();
  const purchaseNo = `PO-${randomSuffix()}`;

  await createPurchase(fixture, { purchaseNo });

  await expectPgError(
    createPurchase(fixture, { purchaseNo }),
    "23505",
    "purchases_purchase_no_unique",
  );
});

test("purchase_items accept a matching subtotal", async () => {
  const fixture = await createFixture();
  const purchase = await createPurchase(fixture, { totalAmount: 15000 });

  const [item] = await testSql`
    insert into purchase_items (
      purchase_id,
      product_id,
      product_unit_id,
      product_name,
      unit_name,
      qty,
      qty_base,
      unit_cost,
      subtotal
    )
    values (
      ${purchase.id},
      ${fixture.productId},
      ${fixture.productUnitId},
      ${fixture.productName},
      ${fixture.unitName},
      3,
      3,
      5000,
      15000
    )
    returning qty, qty_base, unit_cost, subtotal`;

  assert.equal(Number(item.qty), 3);
  assert.equal(Number(item.qty_base), 3);
  assert.equal(Number(item.unit_cost), 5000);
  assert.equal(Number(item.subtotal), 15000);
});

test("purchase_items reject a subtotal that is not ROUND(qty * unit_cost)", async () => {
  const fixture = await createFixture();
  const purchase = await createPurchase(fixture, { totalAmount: 15000 });

  await expectPgError(
    testSql`
      insert into purchase_items (
        purchase_id,
        product_id,
        product_unit_id,
        product_name,
        unit_name,
        qty,
        qty_base,
        unit_cost,
        subtotal
      )
      values (
        ${purchase.id},
        ${fixture.productId},
        ${fixture.productUnitId},
        ${fixture.productName},
        ${fixture.unitName},
        3,
        3,
        5000,
        14999
      )`,
    "23514",
    "purchase_items_subtotal_matches_qty_cost",
  );
});

test("purchase_items round fractional subtotals", async () => {
  const fixture = await createFixture();
  const purchase = await createPurchase(fixture, { totalAmount: 5000 });

  const [item] = await testSql`
    insert into purchase_items (
      purchase_id,
      product_id,
      product_unit_id,
      product_name,
      unit_name,
      qty,
      qty_base,
      unit_cost,
      subtotal
    )
    values (
      ${purchase.id},
      ${fixture.productId},
      ${fixture.productUnitId},
      ${fixture.productName},
      ${fixture.unitName},
      1.5,
      1.5,
      3333,
      5000
    )
    returning subtotal`;

  assert.equal(Number(item.subtotal), 5000);

  await expectPgError(
    testSql`
      insert into purchase_items (
        purchase_id,
        product_id,
        product_unit_id,
        product_name,
        unit_name,
        qty,
        qty_base,
        unit_cost,
        subtotal
      )
      values (
        ${purchase.id},
        ${fixture.productId},
        ${fixture.productUnitId},
        ${fixture.productName},
        ${fixture.unitName},
        1.5,
        1.5,
        3333,
        4999
      )`,
    "23514",
    "purchase_items_subtotal_matches_qty_cost",
  );
});

test("purchase_items reject non-positive quantities and a negative unit cost", async () => {
  const fixture = await createFixture();
  const purchase = await createPurchase(fixture, { totalAmount: 1000 });

  await expectPgError(
    testSql`
      insert into purchase_items (
        purchase_id,
        product_id,
        product_unit_id,
        product_name,
        unit_name,
        qty,
        qty_base,
        unit_cost,
        subtotal
      )
      values (
        ${purchase.id},
        ${fixture.productId},
        ${fixture.productUnitId},
        ${fixture.productName},
        ${fixture.unitName},
        0,
        1,
        1000,
        0
      )`,
    "23514",
    "purchase_items_qty_positive",
  );

  await expectPgError(
    testSql`
      insert into purchase_items (
        purchase_id,
        product_id,
        product_unit_id,
        product_name,
        unit_name,
        qty,
        qty_base,
        unit_cost,
        subtotal
      )
      values (
        ${purchase.id},
        ${fixture.productId},
        ${fixture.productUnitId},
        ${fixture.productName},
        ${fixture.unitName},
        1,
        0,
        1000,
        1000
      )`,
    "23514",
    "purchase_items_qty_base_positive",
  );

  await expectPgError(
    testSql`
      insert into purchase_items (
        purchase_id,
        product_id,
        product_unit_id,
        product_name,
        unit_name,
        qty,
        qty_base,
        unit_cost,
        subtotal
      )
      values (
        ${purchase.id},
        ${fixture.productId},
        ${fixture.productUnitId},
        ${fixture.productName},
        ${fixture.unitName},
        1,
        1,
        -1,
        -1
      )`,
    "23514",
    "purchase_items_unit_cost_non_negative",
  );
});

test("purchase_items require an existing purchase", async () => {
  const fixture = await createFixture();

  await expectPgError(
    testSql`
      insert into purchase_items (
        purchase_id,
        product_id,
        product_unit_id,
        product_name,
        unit_name,
        qty,
        qty_base,
        unit_cost,
        subtotal
      )
      values (
        ${crypto.randomUUID()},
        ${fixture.productId},
        ${fixture.productUnitId},
        ${fixture.productName},
        ${fixture.unitName},
        1,
        1,
        1000,
        1000
      )`,
    "23503",
  );
});

test("purchase_items require the unit to belong to the product", async () => {
  const fixture = await createFixture();
  const other = await createFixture();
  const purchase = await createPurchase(fixture, { totalAmount: 1000 });

  await expectPgError(
    testSql`
      insert into purchase_items (
        purchase_id,
        product_id,
        product_unit_id,
        product_name,
        unit_name,
        qty,
        qty_base,
        unit_cost,
        subtotal
      )
      values (
        ${purchase.id},
        ${fixture.productId},
        ${other.productUnitId},
        ${fixture.productName},
        ${fixture.unitName},
        1,
        1,
        1000,
        1000
      )`,
    "23503",
  );
});

test("purchase history keeps supplier, product, and unit names after master renames", async () => {
  const fixture = await createFixture();
  const purchase = await createPurchase(fixture, { totalAmount: 15000 });
  const [item] = await testSql`
    insert into purchase_items (
      purchase_id,
      product_id,
      product_unit_id,
      product_name,
      unit_name,
      qty,
      qty_base,
      unit_cost,
      subtotal
    )
    values (
      ${purchase.id},
      ${fixture.productId},
      ${fixture.productUnitId},
      ${fixture.productName},
      ${fixture.unitName},
      3,
      3,
      5000,
      15000
    )
    returning id`;

  await testSql`
    update suppliers
    set name = ${`Renamed supplier ${randomSuffix()}`}
    where id = ${fixture.supplierId}`;
  await testSql`
    update products
    set name = ${`Renamed product ${randomSuffix()}`}
    where id = ${fixture.productId}`;
  await testSql`
    update product_units
    set unit_name = ${`renamed-unit-${randomSuffix()}`}
    where id = ${fixture.productUnitId}`;

  const [history] = await testSql`
    select p.supplier_name, pi.product_name, pi.unit_name
    from purchases as p
    join purchase_items as pi on pi.purchase_id = p.id
    where p.id = ${purchase.id} and pi.id = ${item.id}`;

  assert.equal(history.supplier_name, fixture.supplierName);
  assert.equal(history.product_name, fixture.productName);
  assert.equal(history.unit_name, fixture.unitName);
});

test("purchase snapshots are required", async () => {
  const fixture = await createFixture();

  await expectPgError(
    testSql`
      insert into purchases (purchase_no, supplier_id, created_by, total_amount)
      values (
        ${`PO-${randomSuffix()}`},
        ${fixture.supplierId},
        ${fixture.userId},
        0
      )`,
    "23502",
    undefined,
    "supplier_name",
  );

  const purchase = await createPurchase(fixture);

  await expectPgError(
    testSql`
      insert into purchase_items (
        purchase_id,
        product_id,
        product_unit_id,
        unit_name,
        qty,
        qty_base,
        unit_cost,
        subtotal
      )
      values (
        ${purchase.id},
        ${fixture.productId},
        ${fixture.productUnitId},
        ${fixture.unitName},
        1,
        1,
        1000,
        1000
      )`,
    "23502",
    undefined,
    "product_name",
  );

  await expectPgError(
    testSql`
      insert into purchase_items (
        purchase_id,
        product_id,
        product_unit_id,
        product_name,
        qty,
        qty_base,
        unit_cost,
        subtotal
      )
      values (
        ${purchase.id},
        ${fixture.productId},
        ${fixture.productUnitId},
        ${fixture.productName},
        1,
        1,
        1000,
        1000
      )`,
    "23502",
    undefined,
    "unit_name",
  );
});

test("purchase snapshots reject blank names", async () => {
  const fixture = await createFixture();
  const purchase = await createPurchase(fixture);

  await expectPgError(
    testSql`
      insert into purchases (
        purchase_no, supplier_id, supplier_name, created_by, total_amount
      )
      values (
        ${`PO-${randomSuffix()}`},
        ${fixture.supplierId},
        '   ',
        ${fixture.userId},
        0
      )`,
    "23514",
    "purchases_supplier_name_not_blank",
  );

  await expectPgError(
    testSql`
      insert into purchase_items (
        purchase_id,
        product_id,
        product_unit_id,
        product_name,
        unit_name,
        qty,
        qty_base,
        unit_cost,
        subtotal
      )
      values (
        ${purchase.id},
        ${fixture.productId},
        ${fixture.productUnitId},
        '',
        ${fixture.unitName},
        1,
        1,
        1000,
        1000
      )`,
    "23514",
    "purchase_items_product_name_not_blank",
  );

  await expectPgError(
    testSql`
      insert into purchase_items (
        purchase_id,
        product_id,
        product_unit_id,
        product_name,
        unit_name,
        qty,
        qty_base,
        unit_cost,
        subtotal
      )
      values (
        ${purchase.id},
        ${fixture.productId},
        ${fixture.productUnitId},
        ${fixture.productName},
        '',
        1,
        1,
        1000,
        1000
      )`,
    "23514",
    "purchase_items_unit_name_not_blank",
  );
});

test("purchases reject a negative total", async () => {
  const fixture = await createFixture();

  await expectPgError(
    createPurchase(fixture, { totalAmount: -1 }),
    "23514",
    "purchases_total_amount_non_negative",
  );
});

test("purchases reject a blank purchase number", async () => {
  const fixture = await createFixture();

  await expectPgError(
    createPurchase(fixture, { purchaseNo: "  " }),
    "23514",
    "purchases_purchase_no_not_blank",
  );
});

test("purchase_payments accept CASH, QRIS, TRANSFER, and DEBIT", async () => {
  const fixture = await createFixture();
  const purchase = await createPurchase(fixture, { totalAmount: 40000 });

  for (const method of ["CASH", "QRIS", "TRANSFER", "DEBIT"]) {
    const [payment] = await testSql`
      insert into purchase_payments (
        purchase_id,
        amount,
        payment_method,
        reference,
        created_by
      )
      values (
        ${purchase.id},
        10000,
        ${method},
        ${`ref-${randomSuffix()}`},
        ${fixture.userId}
      )
      returning purchase_id, amount, payment_method, paid_at`;

    assert.equal(payment.purchase_id, purchase.id);
    assert.equal(Number(payment.amount), 10000);
    assert.equal(payment.payment_method, method);
    assert.ok(payment.paid_at instanceof Date);
  }
});

test("purchase_payments reject DEBT as a payment method", async () => {
  const fixture = await createFixture();
  const purchase = await createPurchase(fixture, { totalAmount: 10000 });

  await expectPgError(
    testSql`
      insert into purchase_payments (
        purchase_id,
        amount,
        payment_method,
        created_by
      )
      values (${purchase.id}, 10000, 'DEBT', ${fixture.userId})`,
    "22P02",
  );
});

test("purchase_payments require a positive amount", async () => {
  const fixture = await createFixture();
  const purchase = await createPurchase(fixture, { totalAmount: 10000 });

  await expectPgError(
    testSql`
      insert into purchase_payments (
        purchase_id,
        amount,
        payment_method,
        created_by
      )
      values (${purchase.id}, 0, 'CASH', ${fixture.userId})`,
    "23514",
    "purchase_payments_amount_positive",
  );
});

test("purchase_payments require an existing purchase", async () => {
  const fixture = await createFixture();

  await expectPgError(
    testSql`
      insert into purchase_payments (
        purchase_id,
        amount,
        payment_method,
        created_by
      )
      values (${crypto.randomUUID()}, 10000, 'CASH', ${fixture.userId})`,
    "23503",
  );
});

test("purchasing has no source column and no purchase header discount", async () => {
  const columns = await testSql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('purchases', 'purchase_items', 'purchase_payments')`;

  const byTable = new Map<string, string[]>();
  for (const column of columns) {
    const names = byTable.get(column.table_name) ?? [];
    names.push(column.column_name);
    byTable.set(column.table_name, names);
  }

  const purchaseColumns = byTable.get("purchases") ?? [];
  const itemColumns = byTable.get("purchase_items") ?? [];
  const paymentColumns = byTable.get("purchase_payments") ?? [];

  assert.equal(purchaseColumns.includes("discount"), false);
  assert.equal(purchaseColumns.includes("source"), false);
  assert.ok(purchaseColumns.includes("supplier_name"));
  assert.equal(paymentColumns.includes("source"), false);
  assert.equal(paymentColumns.includes("shift_id"), false);
  assert.equal(paymentColumns.includes("settlement_method"), false);

  for (const column of [
    "purchase_id",
    "product_id",
    "product_unit_id",
    "product_name",
    "unit_name",
    "qty",
    "qty_base",
    "unit_cost",
    "subtotal",
  ]) {
    assert.ok(itemColumns.includes(column), `missing purchase_items.${column}`);
  }
});
