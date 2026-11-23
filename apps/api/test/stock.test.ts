import assert from "node:assert/strict";
import { after, test } from "node:test";

import { randomSuffix, testSql } from "./db.ts";

after(() => testSql.end());

async function expectPgError(
  promise: Promise<unknown>,
  code: string,
  constraint?: string,
) {
  await assert.rejects(promise, (error: unknown) => {
    const pgError = error as {
      code?: string;
      constraint?: string;
      constraint_name?: string;
    };
    assert.equal(pgError.code, code);
    if (constraint !== undefined) {
      assert.equal(pgError.constraint ?? pgError.constraint_name, constraint);
    }
    return true;
  });
}

type Fixture = {
  userId: string;
  productId: string;
  productUnitId: string;
  purchaseId: string;
};

async function createFixture(): Promise<Fixture> {
  const suffix = randomSuffix();
  const [user] = await testSql`
    insert into users (name, username, password_hash, role)
    values (${`Stock ${suffix}`}, ${`stock-${suffix}`}, 'hash', 'WAREHOUSE')
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
    values (${product.id}, ${`unit-${suffix}`}, 1, 1000)
    returning id`;
  const [supplier] = await testSql`
    insert into suppliers (name)
    values (${`Supplier ${suffix}`})
    returning id, name`;
  const [purchase] = await testSql`
    insert into purchases (
      purchase_no, supplier_id, supplier_name, created_by, total_amount
    )
    values (${`PO-${suffix}`}, ${supplier.id}, ${supplier.name}, ${user.id}, 0)
    returning id`;

  return {
    userId: user.id,
    productId: product.id,
    productUnitId: unit.id,
    purchaseId: purchase.id,
  };
}

async function createTransfer(fixture: Fixture) {
  const [transfer] = await testSql`
    insert into stock_transfers (
      transfer_no,
      from_location,
      to_location,
      created_by
    )
    values (${`TRF-${randomSuffix()}`}, 'WAREHOUSE', 'STORE', ${fixture.userId})
    returning
      id,
      status,
      reviewed_by,
      reviewed_at,
      completed_at,
      cancelled_by,
      cancelled_at`;
  return transfer;
}

async function createOpname(fixture: Fixture) {
  const [opname] = await testSql`
    insert into stock_opnames (opname_no, location, created_by)
    values (${`OPN-${randomSuffix()}`}, 'STORE', ${fixture.userId})
    returning id, status, reviewed_by, reviewed_at`;
  return opname;
}

test("stock_movements accept the purchase, cancel, return, void, and adjustment types", async () => {
  const fixture = await createFixture();

  const [purchaseMovement] = await testSql`
    insert into stock_movements (
      product_id, location, qty_change, movement_type,
      reference_type, reference_id, created_by
    )
    values (
      ${fixture.productId}, 'WAREHOUSE', 5, 'PURCHASE',
      'PURCHASE', ${fixture.purchaseId}, ${fixture.userId}
    )
    returning movement_type`;

  const [cancelMovement] = await testSql`
    insert into stock_movements (
      product_id, location, qty_change, movement_type,
      reference_type, reference_id, created_by
    )
    values (
      ${fixture.productId}, 'WAREHOUSE', -5, 'PURCHASE_CANCEL',
      'PURCHASE', ${fixture.purchaseId}, ${fixture.userId}
    )
    returning movement_type`;

  const [returnMovement] = await testSql`
    insert into stock_movements (
      product_id, location, qty_change, movement_type,
      reference_type, reference_id, created_by
    )
    values (
      ${fixture.productId}, 'STORE', 1, 'RETURN',
      'RETURN', ${crypto.randomUUID()}, ${fixture.userId}
    )
    returning movement_type`;

  const [voidMovement] = await testSql`
    insert into stock_movements (
      product_id, location, qty_change, movement_type,
      reference_type, reference_id, created_by
    )
    values (
      ${fixture.productId}, 'STORE', 1, 'SALE_VOID',
      'SALE', ${crypto.randomUUID()}, ${fixture.userId}
    )
    returning movement_type`;

  const [adjustment] = await testSql`
    insert into stock_movements (
      product_id, location, qty_change, movement_type,
      reference_type, reference_id, notes, created_by
    )
    values (
      ${fixture.productId}, 'STORE', -1, 'ADJUSTMENT',
      'MANUAL', null, 'broken packaging', ${fixture.userId}
    )
    returning movement_type, notes`;

  assert.equal(purchaseMovement.movement_type, "PURCHASE");
  assert.equal(cancelMovement.movement_type, "PURCHASE_CANCEL");
  assert.equal(returnMovement.movement_type, "RETURN");
  assert.equal(voidMovement.movement_type, "SALE_VOID");
  assert.equal(adjustment.movement_type, "ADJUSTMENT");
  assert.equal(adjustment.notes, "broken packaging");
});

test("stock_movements reject a zero quantity change", async () => {
  const fixture = await createFixture();

  await expectPgError(
    testSql`
      insert into stock_movements (
        product_id, location, qty_change, movement_type,
        reference_type, reference_id, created_by
      )
      values (
        ${fixture.productId}, 'STORE', 0, 'ADJUSTMENT',
        'MANUAL', null, ${fixture.userId}
      )`,
    "23514",
    "stock_movements_qty_change_non_zero",
  );
});

test("stock_movements require a reference id unless the reference type is MANUAL", async () => {
  const fixture = await createFixture();

  await expectPgError(
    testSql`
      insert into stock_movements (
        product_id, location, qty_change, movement_type,
        reference_type, reference_id, created_by
      )
      values (
        ${fixture.productId}, 'STORE', 1, 'ADJUSTMENT',
        'MANUAL', ${crypto.randomUUID()}, ${fixture.userId}
      )`,
    "23514",
    "stock_movements_reference_consistency",
  );

  await expectPgError(
    testSql`
      insert into stock_movements (
        product_id, location, qty_change, movement_type,
        reference_type, reference_id, created_by
      )
      values (
        ${fixture.productId}, 'WAREHOUSE', 1, 'PURCHASE',
        'PURCHASE', null, ${fixture.userId}
      )`,
    "23514",
    "stock_movements_reference_consistency",
  );
});

test("stock_movements default to unflagged and keep flag fields consistent", async () => {
  const fixture = await createFixture();

  const [movement] = await testSql`
    insert into stock_movements (
      product_id, location, qty_change, movement_type,
      reference_type, created_by
    )
    values (
      ${fixture.productId}, 'STORE', -2, 'ADJUSTMENT',
      'MANUAL', ${fixture.userId}
    )
    returning flagged, flag_reason`;

  assert.equal(movement.flagged, false);
  assert.equal(movement.flag_reason, null);

  const [flagged] = await testSql`
    insert into stock_movements (
      product_id, location, qty_change, movement_type,
      reference_type, flagged, flag_reason, created_by
    )
    values (
      ${fixture.productId}, 'STORE', -1, 'ADJUSTMENT',
      'MANUAL', true, 'NEGATIVE_STOCK', ${fixture.userId}
    )
    returning flagged, flag_reason`;

  assert.equal(flagged.flagged, true);
  assert.equal(flagged.flag_reason, "NEGATIVE_STOCK");

  await expectPgError(
    testSql`
      insert into stock_movements (
        product_id, location, qty_change, movement_type,
        reference_type, flagged, created_by
      )
      values (
        ${fixture.productId}, 'STORE', -1, 'ADJUSTMENT',
        'MANUAL', true, ${fixture.userId}
      )`,
    "23514",
    "stock_movements_flag_consistency",
  );

  await expectPgError(
    testSql`
      insert into stock_movements (
        product_id, location, qty_change, movement_type,
        reference_type, flag_reason, created_by
      )
      values (
        ${fixture.productId}, 'STORE', -1, 'ADJUSTMENT',
        'MANUAL', 'NEGATIVE_STOCK', ${fixture.userId}
      )`,
    "23514",
    "stock_movements_flag_consistency",
  );
});

test("stock_movements require an existing product and creator", async () => {
  const fixture = await createFixture();

  await expectPgError(
    testSql`
      insert into stock_movements (
        product_id, location, qty_change, movement_type,
        reference_type, created_by
      )
      values (${crypto.randomUUID()}, 'STORE', 1, 'ADJUSTMENT', 'MANUAL', ${fixture.userId})`,
    "23503",
  );

  await expectPgError(
    testSql`
      insert into stock_movements (
        product_id, location, qty_change, movement_type,
        reference_type, created_by
      )
      values (${fixture.productId}, 'STORE', 1, 'ADJUSTMENT', 'MANUAL', ${crypto.randomUUID()})`,
    "23503",
  );
});

test("stock_transfers default to PENDING and reject matching locations", async () => {
  const fixture = await createFixture();
  const transfer = await createTransfer(fixture);

  assert.equal(transfer.status, "PENDING");
  assert.equal(transfer.reviewed_by, null);
  assert.equal(transfer.reviewed_at, null);
  assert.equal(transfer.completed_at, null);
  assert.equal(transfer.cancelled_by, null);
  assert.equal(transfer.cancelled_at, null);

  await expectPgError(
    testSql`
      insert into stock_transfers (
        transfer_no, from_location, to_location, created_by
      )
      values (${`TRF-${randomSuffix()}`}, 'STORE', 'STORE', ${fixture.userId})`,
    "23514",
    "stock_transfers_distinct_locations",
  );
});

test("stock_transfers keep review and completion fields consistent with status", async () => {
  const fixture = await createFixture();
  const transfer = await createTransfer(fixture);

  await expectPgError(
    testSql`
      update stock_transfers
      set reviewed_by = ${fixture.userId}, reviewed_at = now()
      where id = ${transfer.id}`,
    "23514",
    "stock_transfers_review_fields_consistent",
  );

  await expectPgError(
    testSql`
      update stock_transfers
      set status = 'COMPLETED',
          reviewed_by = ${fixture.userId},
          reviewed_at = now()
      where id = ${transfer.id}`,
    "23514",
    "stock_transfers_review_fields_consistent",
  );

  const [completed] = await testSql`
    update stock_transfers
    set status = 'COMPLETED',
        reviewed_by = ${fixture.userId},
        reviewed_at = now(),
        completed_at = now()
    where id = ${transfer.id}
    returning status, completed_at`;

  assert.equal(completed.status, "COMPLETED");
  assert.ok(completed.completed_at instanceof Date);

  const other = await createTransfer(fixture);

  await expectPgError(
    testSql`
      update stock_transfers
      set status = 'CANCELLED'
      where id = ${other.id}`,
    "23514",
    "stock_transfers_review_fields_consistent",
  );

  await expectPgError(
    testSql`
      update stock_transfers
      set status = 'CANCELLED',
          cancelled_by = ${fixture.userId},
          cancelled_at = now(),
          reviewed_by = ${fixture.userId},
          reviewed_at = now()
      where id = ${other.id}`,
    "23514",
    "stock_transfers_review_fields_consistent",
  );

  const [cancelled] = await testSql`
    update stock_transfers
    set status = 'CANCELLED',
        cancelled_by = ${fixture.userId},
        cancelled_at = now()
    where id = ${other.id}
    returning status, reviewed_by, reviewed_at, completed_at, cancelled_by, cancelled_at`;

  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.reviewed_by, null);
  assert.equal(cancelled.reviewed_at, null);
  assert.equal(cancelled.completed_at, null);
  assert.equal(cancelled.cancelled_by, fixture.userId);
  assert.ok(cancelled.cancelled_at instanceof Date);

  await expectPgError(
    testSql`
      update stock_transfers
      set status = 'CANCELLED', completed_at = now()
      where id = ${other.id}`,
    "23514",
    "stock_transfers_review_fields_consistent",
  );
});

test("stock_transfers reject a duplicate transfer number", async () => {
  const fixture = await createFixture();
  const transferNo = `TRF-${randomSuffix()}`;

  await testSql`
    insert into stock_transfers (transfer_no, from_location, to_location, created_by)
    values (${transferNo}, 'WAREHOUSE', 'STORE', ${fixture.userId})`;

  await expectPgError(
    testSql`
      insert into stock_transfers (transfer_no, from_location, to_location, created_by)
      values (${transferNo}, 'STORE', 'WAREHOUSE', ${fixture.userId})`,
    "23505",
    "stock_transfers_transfer_no_unique",
  );
});

test("stock documents reject blank numbers", async () => {
  const fixture = await createFixture();

  await expectPgError(
    testSql`
      insert into stock_transfers (
        transfer_no, from_location, to_location, created_by
      )
      values ('   ', 'WAREHOUSE', 'STORE', ${fixture.userId})`,
    "23514",
    "stock_transfers_transfer_no_not_blank",
  );

  await expectPgError(
    testSql`
      insert into stock_opnames (opname_no, location, created_by)
      values ('', 'STORE', ${fixture.userId})`,
    "23514",
    "stock_opnames_opname_no_not_blank",
  );
});

test("stock_transfer_items accept positive quantities and reject non-positive ones", async () => {
  const fixture = await createFixture();
  const transfer = await createTransfer(fixture);

  const [item] = await testSql`
    insert into stock_transfer_items (
      transfer_id, product_id, product_unit_id, qty, qty_base
    )
    values (${transfer.id}, ${fixture.productId}, ${fixture.productUnitId}, 2.5, 2.5)
    returning qty, qty_base`;

  assert.equal(Number(item.qty), 2.5);
  assert.equal(Number(item.qty_base), 2.5);

  await expectPgError(
    testSql`
      insert into stock_transfer_items (
        transfer_id, product_id, product_unit_id, qty, qty_base
      )
      values (${transfer.id}, ${fixture.productId}, ${fixture.productUnitId}, 0, 1)`,
    "23514",
    "stock_transfer_items_qty_positive",
  );

  await expectPgError(
    testSql`
      insert into stock_transfer_items (
        transfer_id, product_id, product_unit_id, qty, qty_base
      )
      values (${transfer.id}, ${fixture.productId}, ${fixture.productUnitId}, 1, 0)`,
    "23514",
    "stock_transfer_items_qty_base_positive",
  );
});

test("stock_transfer_items require the unit to belong to the product", async () => {
  const fixture = await createFixture();
  const other = await createFixture();
  const transfer = await createTransfer(fixture);

  await expectPgError(
    testSql`
      insert into stock_transfer_items (
        transfer_id, product_id, product_unit_id, qty, qty_base
      )
      values (${transfer.id}, ${fixture.productId}, ${other.productUnitId}, 1, 1)`,
    "23503",
  );
});

test("stock_opnames default to PENDING and enforce review fields", async () => {
  const fixture = await createFixture();
  const opname = await createOpname(fixture);

  assert.equal(opname.status, "PENDING");
  assert.equal(opname.reviewed_by, null);
  assert.equal(opname.reviewed_at, null);

  await expectPgError(
    testSql`
      update stock_opnames
      set reviewed_by = ${fixture.userId}, reviewed_at = now()
      where id = ${opname.id}`,
    "23514",
    "stock_opnames_review_fields_consistent",
  );

  await expectPgError(
    testSql`
      update stock_opnames
      set status = 'APPROVED'
      where id = ${opname.id}`,
    "23514",
    "stock_opnames_review_fields_consistent",
  );

  const [approved] = await testSql`
    update stock_opnames
    set status = 'APPROVED',
        reviewed_by = ${fixture.userId},
        reviewed_at = now()
    where id = ${opname.id}
    returning status, reviewed_by`;

  assert.equal(approved.status, "APPROVED");
  assert.equal(approved.reviewed_by, fixture.userId);

  const rejected = await createOpname(fixture);

  const [rejectedRow] = await testSql`
    update stock_opnames
    set status = 'REJECTED',
        reviewed_by = ${fixture.userId},
        reviewed_at = now()
    where id = ${rejected.id}
    returning status`;

  assert.equal(rejectedRow.status, "REJECTED");
});

test("stock_opname_items enforce diff_qty = physical_qty - system_qty", async () => {
  const fixture = await createFixture();
  const opname = await createOpname(fixture);

  const [item] = await testSql`
    insert into stock_opname_items (
      opname_id, product_id, system_qty, physical_qty, diff_qty
    )
    values (${opname.id}, ${fixture.productId}, 10, 8, -2)
    returning system_qty, physical_qty, diff_qty`;

  assert.equal(Number(item.system_qty), 10);
  assert.equal(Number(item.physical_qty), 8);
  assert.equal(Number(item.diff_qty), -2);

  await expectPgError(
    testSql`
      insert into stock_opname_items (
        opname_id, product_id, system_qty, physical_qty, diff_qty
      )
      values (${opname.id}, ${fixture.productId}, 10, 8, -1)`,
    "23514",
    "stock_opname_items_diff_matches_quantities",
  );
});

test("stock_opname_items allow a negative system quantity but reject a negative physical quantity", async () => {
  const fixture = await createFixture();
  const opname = await createOpname(fixture);

  const [negativeSystem] = await testSql`
    insert into stock_opname_items (
      opname_id, product_id, system_qty, physical_qty, diff_qty
    )
    values (${opname.id}, ${fixture.productId}, -1, 0, 1)
    returning system_qty, physical_qty, diff_qty`;

  assert.equal(Number(negativeSystem.system_qty), -1);
  assert.equal(Number(negativeSystem.physical_qty), 0);
  assert.equal(Number(negativeSystem.diff_qty), 1);

  await expectPgError(
    testSql`
      insert into stock_opname_items (
        opname_id, product_id, system_qty, physical_qty, diff_qty
      )
      values (${opname.id}, ${fixture.productId}, 0, -1, -1)`,
    "23514",
    "stock_opname_items_physical_qty_non_negative",
  );
});

test("stock_opname_items require an existing opname and product", async () => {
  const fixture = await createFixture();

  await expectPgError(
    testSql`
      insert into stock_opname_items (
        opname_id, product_id, system_qty, physical_qty, diff_qty
      )
      values (${crypto.randomUUID()}, ${fixture.productId}, 1, 1, 0)`,
    "23503",
  );

  const opname = await createOpname(fixture);

  await expectPgError(
    testSql`
      insert into stock_opname_items (
        opname_id, product_id, system_qty, physical_qty, diff_qty
      )
      values (${opname.id}, ${crypto.randomUUID()}, 1, 1, 0)`,
    "23503",
  );
});

test("stock movements keep the ledger free of balance snapshots and product stock columns", async () => {
  const columns = await testSql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('stock_movements', 'products')`;

  const byTable = new Map<string, string[]>();
  for (const column of columns) {
    const names = byTable.get(column.table_name) ?? [];
    names.push(column.column_name);
    byTable.set(column.table_name, names);
  }

  const movementColumns = byTable.get("stock_movements") ?? [];
  const productColumns = byTable.get("products") ?? [];

  assert.equal(movementColumns.includes("balance_after"), false);
  assert.equal(productColumns.includes("stock_warehouse"), false);
  assert.equal(productColumns.includes("stock_store"), false);

  for (const column of [
    "product_id",
    "location",
    "qty_change",
    "movement_type",
    "reference_type",
    "reference_id",
    "notes",
    "flagged",
    "flag_reason",
    "created_by",
    "created_at",
  ]) {
    assert.ok(
      movementColumns.includes(column),
      `missing stock_movements.${column}`,
    );
  }
});
