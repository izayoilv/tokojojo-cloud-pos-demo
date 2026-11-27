import { describe, expect, it } from "vitest";

import { repository } from "./repository";

describe("repository.login", () => {
  it("signs in a demo owner with the seeded password", async () => {
    const user = await repository.login("owner", "tokojojo123");
    expect(user.role).toBe("OWNER");
    expect(user.name).toBe("Ko Jojo Halim");
  });

  it("rejects a wrong password", async () => {
    await expect(repository.login("owner", "salah")).rejects.toThrow(
      "Nama pengguna atau kata sandi salah",
    );
  });
});

describe("repository.listProducts", () => {
  it("returns the twelve seeded SKUs with integer money", async () => {
    const products = await repository.listProducts();
    expect(products).toHaveLength(12);
    expect(products.every((product) => Number.isInteger(product.cost))).toBe(
      true,
    );
    expect(products.every((product) => Number.isInteger(product.price))).toBe(
      true,
    );
  });
});

describe("repository.listUsers", () => {
  it("returns one user per demo role", async () => {
    const users = await repository.listUsers();
    expect(users.map((user) => user.role).sort()).toEqual([
      "ADMIN",
      "CASHIER",
      "OWNER",
      "WAREHOUSE",
    ]);
  });
});

describe("repository mock consistency", () => {
  it("keeps shared purchase and payable invoices aligned", async () => {
    const [purchases, payables] = await Promise.all([
      repository.listPurchases(),
      repository.listPayables(),
    ]);
    const purchase = purchases.find((item) => item.invoice === "INV-IAP-88412");
    const payable = payables.find((item) => item.invoice === "INV-IAP-88412");

    expect(purchase).toBeDefined();
    expect(payable).toBeDefined();
    expect(purchase!.total).toBe(payable!.total);
    expect(purchase!.paid).toBe(payable!.paid);
  });
});

describe("repository.mock data", () => {
  it("converts a PRD-001 sack to five kilograms", async () => {
    const products = await repository.listProducts();
    const rice = products.find((product) => product.id === "PRD-001");
    const sack = rice?.units?.find((unit) => unit.name === "Karung");
    const kilogram = rice?.units?.find((unit) => unit.name === "Kilogram");

    expect(sack?.conversionQty).toBe(5);
    expect(kilogram?.conversionQty).toBe(1);
  });

  it("continues the transfer number sequence", async () => {
    const before = await repository.listTransfers();
    const expected = `MUT/2026/11/${String(before.length + 1).padStart(3, "0")}`;
    const transfer = await repository.createTransfer("WH-BACK", "STORE-FRONT", [
      {
        productId: "PRD-001",
        productName: "Beras",
        unit: "Karung",
        quantity: 1,
      },
    ]);

    expect(transfer.number).toBe(expected);
    await repository.cancelTransfer(transfer.id);
  });
});

describe("repository purchases", () => {
  const items = [
    {
      productId: "PRD-001",
      productName: "Beras Setra Ramos Cap Topi Koki 5kg",
      quantity: 2,
      unitCost: 50000,
    },
  ];

  it("creates a received purchase with stock, payable, and movement", async () => {
    const before = (await repository.listProducts()).find(
      (product) => product.id === "PRD-001",
    )!;
    const purchase = await repository.createPurchase({
      supplierName: "PT Uji",
      invoice: "INV-TEST-001",
      due: "2026-12-10",
      items,
    });

    expect(purchase.total).toBe(100000);
    expect(purchase.status).toBe("RECEIVED");
    expect(purchase.payStatus).toBe("UNPAID");

    const after = (await repository.listProducts()).find(
      (product) => product.id === "PRD-001",
    )!;
    expect(after.warehouseStock).toBe(before.warehouseStock + 2);

    const payable = (await repository.listPayables()).find(
      (item) => item.invoice === "INV-TEST-001",
    );
    expect(payable?.total).toBe(100000);
    expect(payable?.paid).toBe(0);

    const movement = (await repository.listMovements())[0];
    expect(movement?.type).toBe("PURCHASE");
    expect(movement?.reference).toBe("INV-TEST-001");
  });

  it("rejects a duplicate supplier invoice", async () => {
    await expect(
      repository.createPurchase({
        supplierName: "PT Uji",
        invoice: "INV-TEST-001",
        due: "2026-12-10",
        items,
      }),
    ).rejects.toThrow("Faktur supplier sudah ada");
  });

  it("pays a purchase and records a cash outflow", async () => {
    const purchase = await repository.createPurchase({
      supplierName: "PT Uji",
      invoice: "INV-TEST-002",
      due: "2026-12-10",
      items: [{ ...items[0]!, quantity: 1 }],
    });
    const paid = await repository.payPurchase(purchase.id, 20000, "TUNAI");

    expect(paid.paid).toBe(20000);
    expect(paid.payStatus).toBe("PARTIAL");

    const payable = (await repository.listPayables()).find(
      (item) => item.invoice === "INV-TEST-002",
    );
    expect(payable?.paid).toBe(20000);
    expect(payable?.status).toBe("PARTIAL");

    const flow = (await repository.listCashFlows())[0];
    expect(flow?.type).toBe("OUT");
    expect(flow?.amount).toBe(20000);
    expect(flow?.reference).toBe("INV-TEST-002");
  });

  it("rejects overpayment", async () => {
    const purchase = (await repository.listPurchases()).find(
      (item) => item.invoice === "INV-TEST-002",
    )!;

    await expect(
      repository.payPurchase(purchase.id, 999999, "TUNAI"),
    ).rejects.toThrow("melebihi sisa hutang");
  });

  it("cancels an unpaid received purchase and reverses stock", async () => {
    const before = (await repository.listProducts()).find(
      (product) => product.id === "PRD-001",
    )!;
    const purchase = await repository.createPurchase({
      supplierName: "PT Uji",
      invoice: "INV-TEST-003",
      due: "2026-12-10",
      items,
    });
    const cancelled = await repository.cancelPurchase(purchase.id);

    expect(cancelled.status).toBe("CANCELLED");
    const after = (await repository.listProducts()).find(
      (product) => product.id === "PRD-001",
    )!;
    expect(after.warehouseStock).toBe(before.warehouseStock);
    expect(
      (await repository.listPayables()).some(
        (item) => item.invoice === "INV-TEST-003",
      ),
    ).toBe(false);
    expect((await repository.listMovements())[0]?.type).toBe("PURCHASE_CANCEL");
  });

  it("rejects cancelling a purchase that has payments", async () => {
    const purchase = (await repository.listPurchases()).find(
      (item) => item.invoice === "INV-TEST-002",
    )!;

    await expect(repository.cancelPurchase(purchase.id)).rejects.toThrow(
      "sudah dibayar",
    );
  });
});

describe("repository transfers", () => {
  it("rejects same-location transfers", async () => {
    await expect(
      repository.createTransfer("WH-BACK", "WH-BACK", [
        {
          productId: "PRD-001",
          productName: "Beras",
          unit: "Karung",
          quantity: 1,
        },
      ]),
    ).rejects.toThrow("Lokasi asal dan tujuan harus berbeda");
  });

  it("rejects quantities above the source stock", async () => {
    await expect(
      repository.createTransfer("WH-BACK", "STORE-FRONT", [
        {
          productId: "PRD-001",
          productName: "Beras",
          unit: "Karung",
          quantity: 999999,
        },
      ]),
    ).rejects.toThrow("Stok gudang tidak cukup");
  });

  it("moves stock when a transfer completes", async () => {
    const before = (await repository.listProducts()).find(
      (product) => product.id === "PRD-001",
    )!;
    const transfer = await repository.createTransfer("WH-BACK", "STORE-FRONT", [
      {
        productId: "PRD-001",
        productName: "Beras",
        unit: "Karung",
        quantity: 2,
      },
    ]);
    await repository.completeTransfer(transfer.id);

    const after = (await repository.listProducts()).find(
      (product) => product.id === "PRD-001",
    )!;
    expect(after.warehouseStock).toBe(before.warehouseStock - 2);
    expect(after.storeStock).toBe(before.storeStock + 2);

    const movements = await repository.listMovements();
    expect(movements[0]?.type).toBe("TRANSFER_OUT");
    expect(movements[1]?.type).toBe("TRANSFER_IN");
  });
});

describe("repository opnames", () => {
  it("creates a pending opname with system quantities", async () => {
    const product = (await repository.listProducts()).find(
      (item) => item.id === "PRD-002",
    )!;
    const opname = await repository.createOpname({
      location: "STORE-FRONT",
      items: [{ productId: "PRD-002", physicalQty: product.storeStock - 1 }],
    });

    expect(opname.status).toBe("PENDING_REVIEW");
    expect(opname.items[0]?.systemQty).toBe(product.storeStock);
    expect(opname.items[0]?.physicalQty).toBe(product.storeStock - 1);
  });

  it("applies differences and records a movement on approval", async () => {
    const before = (await repository.listProducts()).find(
      (item) => item.id === "PRD-002",
    )!;
    const opname = await repository.createOpname({
      location: "STORE-FRONT",
      items: [{ productId: "PRD-002", physicalQty: before.storeStock + 1 }],
    });
    await repository.setOpnameStatus(opname.id, "APPROVED");

    const after = (await repository.listProducts()).find(
      (item) => item.id === "PRD-002",
    )!;
    expect(after.storeStock).toBe(before.storeStock + 1);
    expect((await repository.listMovements())[0]?.type).toBe("OPNAME");
  });

  it("does not apply differences on rejection", async () => {
    const before = (await repository.listProducts()).find(
      (item) => item.id === "PRD-002",
    )!;
    const opname = await repository.createOpname({
      location: "STORE-FRONT",
      items: [{ productId: "PRD-002", physicalQty: before.storeStock - 1 }],
    });
    await repository.setOpnameStatus(opname.id, "REJECTED");

    const after = (await repository.listProducts()).find(
      (item) => item.id === "PRD-002",
    )!;
    expect(after.storeStock).toBe(before.storeStock);
  });
});

describe("repository sales", () => {
  it("records a partial return and its refund", async () => {
    const sale = (await repository.listSales()).find(
      (item) => item.status === "COMPLETED",
    )!;
    const item = sale.items[0]!;
    const updated = await repository.returnSale(
      sale.id,
      [{ productId: item.productId, quantity: 1 }],
      "Barang rusak",
    );

    expect(updated.items[0]?.returned).toBe(1);
    expect(updated.status).toBe("PARTIAL_RETURN");

    const movement = (await repository.listMovements())[0];
    expect(movement?.type).toBe("RETURN");
    expect(movement?.reference).toBe(sale.number);

    const flow = (await repository.listCashFlows())[0];
    expect(flow?.type).toBe("OUT");
    expect(flow?.reference).toBe(sale.number);
    expect(flow?.amount).toBe(item.price - item.discount);
  });

  it("rejects a return above the remaining quantity", async () => {
    const sale = (await repository.listSales()).find(
      (item) => item.status === "COMPLETED",
    )!;
    const item = sale.items[0]!;

    await expect(
      repository.returnSale(
        sale.id,
        [{ productId: item.productId, quantity: item.quantity + 1 }],
        "Rusak",
      ),
    ).rejects.toThrow("melebihi jumlah yang tersisa");
  });

  it("voids a sale and records reversal movements", async () => {
    const sale = (await repository.listSales()).find(
      (item) => item.status === "COMPLETED",
    )!;
    const updated = await repository.voidSale(sale.id, "Salah input transaksi");

    expect(updated.status).toBe("VOIDED");
    const movements = (await repository.listMovements()).filter(
      (movement) => movement.reference === sale.number,
    );
    expect(movements[0]?.type).toBe("SALE_VOID");
    expect((await repository.listCashFlows())[0]?.type).toBe("OUT");
  });

  it("rejects voiding an already voided sale", async () => {
    const sale = (await repository.listSales()).find(
      (item) => item.status === "VOIDED",
    )!;

    await expect(repository.voidSale(sale.id, "Ulang")).rejects.toThrow(
      "sudah dibatalkan",
    );
  });
});

describe("repository reads", () => {
  it("exposes sales, transfers, and store settings", async () => {
    const [sales, transfers, settings] = await Promise.all([
      repository.listSales(),
      repository.listTransfers(),
      repository.getSettings(),
    ]);

    expect(sales.length).toBeGreaterThanOrEqual(10);
    expect(sales[0]?.items.length).toBeGreaterThan(0);
    expect(transfers.some((transfer) => transfer.status === "PENDING")).toBe(
      true,
    );
    expect(settings.name).toBe("TOKO JOJO");
  });
});

describe("repository.saveProduct", () => {
  it("updates an existing product by id", async () => {
    const [first] = await repository.listProducts();
    expect(first).toBeDefined();

    const saved = await repository.saveProduct({
      ...first!,
      name: "Beras Uji Coba",
    });

    expect(saved.id).toBe(first!.id);
    expect(saved.name).toBe("Beras Uji Coba");
    const products = await repository.listProducts();
    expect(products.find((item) => item.id === first!.id)?.name).toBe(
      "Beras Uji Coba",
    );
  });

  it("adds a new product with a generated id", async () => {
    const [first] = await repository.listProducts();
    const saved = await repository.saveProduct({
      ...first!,
      id: "",
      name: "Produk Baru Uji",
      sku: "UJI-BARU-001",
      barcode: "2000000000001",
    });

    expect(saved.id).toMatch(/^PRD-\d{3}$/);
    const products = await repository.listProducts();
    expect(products.some((item) => item.sku === "UJI-BARU-001")).toBe(true);
  });
});
