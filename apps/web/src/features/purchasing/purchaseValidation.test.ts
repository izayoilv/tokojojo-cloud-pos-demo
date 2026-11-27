import { describe, expect, it } from "vitest";

import { validatePurchaseDraft } from "./purchaseValidation";

const valid = {
  supplierName: "PT Uji",
  invoice: "INV-001",
  due: "2026-12-10",
  items: [
    {
      productId: "PRD-001",
      productName: "Beras",
      quantity: 2,
      unitCost: 50000,
    },
  ],
};

describe("validatePurchaseDraft", () => {
  it("accepts a complete draft", () => {
    expect(validatePurchaseDraft(valid)).toBeNull();
  });

  it("requires a supplier, invoice, and due date", () => {
    expect(validatePurchaseDraft({ ...valid, supplierName: "" })).toBe(
      "Supplier wajib dipilih.",
    );
    expect(validatePurchaseDraft({ ...valid, invoice: "  " })).toBe(
      "Faktur supplier wajib diisi.",
    );
    expect(validatePurchaseDraft({ ...valid, due: "" })).toBe(
      "Jatuh tempo wajib diisi.",
    );
  });

  it("requires at least one complete line", () => {
    expect(validatePurchaseDraft({ ...valid, items: [] })).toBe(
      "Tambahkan minimal satu barang.",
    );
    expect(
      validatePurchaseDraft({
        ...valid,
        items: [{ ...valid.items[0]!, productId: "" }],
      }),
    ).toBe("Lengkapi produk, jumlah, dan harga.");
    expect(
      validatePurchaseDraft({
        ...valid,
        items: [{ ...valid.items[0]!, quantity: 0 }],
      }),
    ).toBe("Lengkapi produk, jumlah, dan harga.");
  });

  it("rejects fractional and non-finite amounts", () => {
    for (const quantity of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        validatePurchaseDraft({
          ...valid,
          items: [{ ...valid.items[0]!, quantity }],
        }),
      ).toBe("Lengkapi produk, jumlah, dan harga.");
    }

    for (const unitCost of [1.5, Number.NaN, -1]) {
      expect(
        validatePurchaseDraft({
          ...valid,
          items: [{ ...valid.items[0]!, unitCost }],
        }),
      ).toBe("Lengkapi produk, jumlah, dan harga.");
    }
  });
});
