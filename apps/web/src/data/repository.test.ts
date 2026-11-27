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
