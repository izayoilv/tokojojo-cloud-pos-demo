import { describe, expect, it } from "vitest";

import type { CartLine, PosProduct } from "../data/types";
import {
  cartTotals,
  changeDue,
  expectedCash,
  filterProducts,
  formatRupiah,
  paymentMethodsFor,
} from "./posCalc";

const line = (name: string, quantity: number, unitPrice: number): CartLine => ({
  id: name,
  productId: `P-${name}`,
  name,
  unitId: `U-${name}`,
  unitName: "Pcs",
  quantity,
  unitPrice,
  discount: 0,
});

const product = (overrides: Partial<PosProduct> = {}): PosProduct => ({
  id: "PRD-003",
  sku: "MIE-IND-003",
  barcode: "089686010947",
  name: "Indomie Mi Instan Goreng Spesial 85g",
  category: "Mie instan",
  stock: 405,
  units: [
    {
      id: "PU-005",
      name: "Bungkus",
      conversionQty: 1,
      sellingPrice: 3500,
      barcode: "089686010947",
    },
    {
      id: "PU-006",
      name: "Dus",
      conversionQty: 40,
      sellingPrice: 138000,
      barcode: "089686010954",
    },
  ],
  ...overrides,
});

describe("cartTotals", () => {
  it("matches the reference cart", () => {
    expect(
      cartTotals([
        line("Indomie", 12, 3500),
        line("Beras", 1, 72500),
        line("Aqua", 1, 52000),
      ]),
    ).toEqual({
      subtotal: 166500,
      discount: 0,
      total: 166500,
      itemCount: 3,
    });
  });

  it("returns zeros for an empty cart", () => {
    expect(cartTotals([])).toEqual({
      subtotal: 0,
      discount: 0,
      total: 0,
      itemCount: 0,
    });
  });

  it("applies line discounts", () => {
    const discounted = { ...line("Diskon", 2, 10000), discount: 2000 };
    expect(cartTotals([discounted])).toEqual({
      subtotal: 20000,
      discount: 2000,
      total: 18000,
      itemCount: 1,
    });
  });
});

describe("changeDue", () => {
  it("returns change for sufficient cash", () => {
    expect(changeDue(166500, 200000)).toBe(33500);
  });

  it("returns a negative value when cash is short", () => {
    expect(changeDue(166500, 100000)).toBe(-66500);
  });
});

describe("expectedCash", () => {
  it("adds cash sales and subtracts refunds", () => {
    expect(expectedCash(500000, 450000, 50000)).toBe(900000);
  });

  it("allows a negative expected cash value", () => {
    expect(expectedCash(500000, 100000, 700000)).toBe(-100000);
  });
});

describe("paymentMethodsFor", () => {
  it("only allows cash offline and during grace", () => {
    expect(paymentMethodsFor("OFFLINE")).toEqual(["TUNAI"]);
    expect(paymentMethodsFor("GRACE")).toEqual(["TUNAI"]);
  });

  it("blocks all methods when locked", () => {
    expect(paymentMethodsFor("LOCKED")).toEqual([]);
  });

  it("allows all six methods online", () => {
    expect(paymentMethodsFor("ONLINE")).toHaveLength(6);
  });
});

describe("filterProducts", () => {
  const products = [
    product(),
    product({
      id: "PRD-001",
      sku: "SMB-BRS-001",
      barcode: "8992761110012",
      name: "Beras Setra Ramos 5kg",
      category: "Sembako",
    }),
  ];

  it("matches name, sku, barcode, and category", () => {
    expect(filterProducts(products, "indomie", "Semua")).toHaveLength(1);
    expect(filterProducts(products, "MIE-IND", "Semua")).toHaveLength(1);
    expect(filterProducts(products, "8992761", "Semua")).toHaveLength(1);
    expect(filterProducts(products, "", "Sembako")).toHaveLength(1);
  });

  it("keeps the selected multi-unit line price", () => {
    const dus = line("Indomie Dus", 2, 138000);
    expect(cartTotals([dus]).total).toBe(276000);
  });
});

describe("formatRupiah", () => {
  it("formats integer rupiah", () => {
    expect(formatRupiah(166500)).toBe("Rp 166.500");
    expect(formatRupiah(-10000)).toBe("-Rp 10.000");
  });
});
