import { describe, expect, it } from "vitest";

import type { Product } from "../../data/types";
import {
  validateOpnameDraft,
  validateTransferDraft,
} from "./warehouseValidation";

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "PRD-001",
  sku: "SKU-001",
  barcode: "899000000001",
  name: "Beras",
  category: "Sembako",
  brand: "TokoJojo",
  unit: "Karung",
  cost: 50000,
  price: 60000,
  warehouseStock: 10,
  storeStock: 4,
  minStock: 5,
  minStoreStock: 2,
  color: "#000000",
  active: true,
  ...overrides,
});

describe("validateTransferDraft", () => {
  const valid = {
    from: "WH-BACK" as const,
    to: "STORE-FRONT" as const,
    productId: "PRD-001",
    quantity: 2,
    products: [product()],
  };

  it("accepts a valid transfer", () => {
    expect(validateTransferDraft(valid)).toBeNull();
  });

  it("requires different locations", () => {
    expect(validateTransferDraft({ ...valid, to: "WH-BACK" })).toBe(
      "Lokasi asal dan tujuan harus berbeda.",
    );
  });

  it("requires a selected product and positive integer quantity", () => {
    expect(validateTransferDraft({ ...valid, productId: "" })).toBe(
      "Pilih produk terlebih dahulu.",
    );
    expect(validateTransferDraft({ ...valid, quantity: 0 })).toBe(
      "Jumlah harus berupa angka bulat lebih dari nol.",
    );
    expect(validateTransferDraft({ ...valid, quantity: 1.5 })).toBe(
      "Jumlah harus berupa angka bulat lebih dari nol.",
    );
  });

  it("checks stock at the source location", () => {
    expect(validateTransferDraft({ ...valid, quantity: 11 })).toBe(
      "Stok gudang tidak cukup.",
    );
    expect(
      validateTransferDraft({
        ...valid,
        from: "STORE-FRONT",
        to: "WH-BACK",
        quantity: 5,
      }),
    ).toBe("Stok toko tidak cukup.");
  });
});

describe("validateOpnameDraft", () => {
  it("accepts a valid draft", () => {
    expect(
      validateOpnameDraft({
        location: "STORE-FRONT",
        items: [{ productId: "PRD-001", physicalQty: 3 }],
      }),
    ).toBeNull();
  });

  it("requires at least one product", () => {
    expect(validateOpnameDraft({ location: "STORE-FRONT", items: [] })).toBe(
      "Tambahkan minimal satu produk.",
    );
  });

  it("rejects duplicate products and invalid counts", () => {
    expect(
      validateOpnameDraft({
        location: "STORE-FRONT",
        items: [
          { productId: "PRD-001", physicalQty: 3 },
          { productId: "PRD-001", physicalQty: 2 },
        ],
      }),
    ).toBe("Produk tidak boleh duplikat.");
    expect(
      validateOpnameDraft({
        location: "STORE-FRONT",
        items: [{ productId: "PRD-001", physicalQty: -1 }],
      }),
    ).toBe("Jumlah fisik harus angka bulat nol atau lebih.");
  });

  it("requires a product on every row", () => {
    expect(
      validateOpnameDraft({
        location: "STORE-FRONT",
        items: [{ productId: "", physicalQty: 0 }],
      }),
    ).toBe("Pilih produk untuk setiap baris.");
  });
});
