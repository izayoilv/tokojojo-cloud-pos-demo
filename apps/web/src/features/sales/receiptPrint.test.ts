import { describe, expect, it } from "vitest";

import type { Sale } from "../../data/types";
import { buildReceiptHtml } from "./receiptPrint";

const sale: Sale = {
  id: "SALE-001",
  number: "POS/20261124/0001",
  time: "2026-11-24T10:05:00+07:00",
  cashier: "Dewi Lestari",
  terminal: "KASIR-DESKTOP-01",
  method: "TUNAI",
  status: "COMPLETED",
  received: 100000,
  items: [
    {
      productId: "PRD-001",
      name: "Beras <Premium>",
      unit: "Karung",
      quantity: 2,
      price: 73500,
      cost: 64200,
      discount: 0,
      returned: 0,
    },
  ],
};

describe("buildReceiptHtml", () => {
  it("renders the store, invoice, items, and total", () => {
    const html = buildReceiptHtml(sale, "TOKO JOJO");

    expect(html).toContain("TOKO JOJO");
    expect(html).toContain("POS/20261124/0001");
    expect(html).toContain("Dewi Lestari");
    expect(html).toContain("Beras &lt;Premium&gt;");
    expect(html).toContain("147.000");
  });

  it("nets returned quantities and shows per-unit discounts", () => {
    const returned: Sale = {
      ...sale,
      status: "PARTIAL_RETURN",
      items: [{ ...sale.items[0]!, returned: 1, discount: 500 }],
    };
    const html = buildReceiptHtml(returned, "TOKO JOJO");

    expect(html).toContain("1 × Karung");
    expect(html).toContain("Diskon");
    expect(html).toContain("73.000");
  });

  it("stamps a voided receipt", () => {
    const html = buildReceiptHtml({ ...sale, status: "VOIDED" }, "TOKO JOJO");

    expect(html).toContain("VOID");
    expect(html).toContain("DIBATALKAN");
  });

  it("escapes markup in the store name", () => {
    const html = buildReceiptHtml(sale, "<script>alert(1)</script>");

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
