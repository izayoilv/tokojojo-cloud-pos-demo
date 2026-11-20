import { describe, expect, it } from "vitest";

import type { Product } from "../../data/types";
import { productsToCsv } from "./productCsv";

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "PRD-001",
  sku: "SMB-BRS-001",
  barcode: "8992761110012",
  name: "Beras Setra Ramos Cap Topi Koki 5kg",
  category: "Sembako Utama",
  brand: "Topi Koki",
  unit: "Karung",
  cost: 64200,
  price: 73500,
  warehouseStock: 45,
  storeStock: 12,
  minStock: 25,
  minStoreStock: 10,
  color: "#2563eb",
  ...overrides,
});

describe("productsToCsv", () => {
  it("writes a header row and one row per product", () => {
    const csv = productsToCsv([product()]);
    const [header, row] = csv.split("\r\n");

    expect(header).toBe(
      "Nama,SKU,Barcode,Kategori,Merek,Satuan,HPP,Harga Jual,Stok Gudang,Stok Toko,Stok Minimum",
    );
    expect(row).toBe(
      "Beras Setra Ramos Cap Topi Koki 5kg,SMB-BRS-001,8992761110012,Sembako Utama,Topi Koki,Karung,64200,73500,45,12,25",
    );
  });

  it("escapes commas and quotes in text fields", () => {
    const csv = productsToCsv([
      product({ name: 'Beras "Premium", 5kg', category: "Sembako, Utama" }),
    ]);
    const row = csv.split("\r\n")[1];

    expect(row).toContain('"Beras ""Premium"", 5kg"');
    expect(row).toContain('"Sembako, Utama"');
  });

  it("returns just the header for an empty catalogue", () => {
    expect(productsToCsv([]).split("\r\n")).toHaveLength(1);
  });
});
