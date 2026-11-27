import { describe, expect, it } from "vitest";

import { buildPrintHtml, buildReportCsv } from "./reportCsv";

const meta = {
  storeName: "TOKO JOJO",
  userName: "Siti Rahmawati",
  generatedAt: new Date("2025-05-14T10:05:00+07:00"),
};

describe("buildReportCsv", () => {
  it("writes the report title, store, and current user", () => {
    const csv = buildReportCsv("Penjualan Harian", meta, [
      ["No. Struk", "Total"],
      ["POS/20250514/0001", 258500],
    ]);

    expect(csv).toContain("Laporan,Penjualan Harian");
    expect(csv).toContain("Toko,TOKO JOJO");
    expect(csv).toContain("Dicetak oleh,Siti Rahmawati");
    expect(csv).toContain("POS/20250514/0001,258500");
  });

  it("neutralizes formula-like metadata and row cells", () => {
    const csv = buildReportCsv(
      "Laporan",
      { ...meta, storeName: "=cmd|' /C calc'!A0" },
      [["@SUM(A1:A2)", "normal"]],
    );

    expect(csv).toContain("'=cmd|' /C calc'!A0");
    expect(csv).toContain("'@SUM(A1:A2)");
  });

  it("escapes commas and quotes in metadata and rows", () => {
    const csv = buildReportCsv(
      'Laporan "Bulanan", Mei',
      { ...meta, storeName: "Toko, Cabang" },
      [['Nama "Produk", 5kg']],
    );

    expect(csv).toContain('"Laporan ""Bulanan"", Mei"');
    expect(csv).toContain('"Toko, Cabang"');
    expect(csv).toContain('"Nama ""Produk"", 5kg"');
  });
});

describe("buildPrintHtml", () => {
  it("renders the store, title, user, and escaped body", () => {
    const html = buildPrintHtml({
      ...meta,
      title: "Ikhtisar & Valuasi Stok",
      bodyHtml: "<table><tr><td>Beras</td></tr></table>",
    });

    expect(html).toContain("TOKO JOJO");
    expect(html).toContain("Ikhtisar &amp; Valuasi Stok");
    expect(html).toContain("Siti Rahmawati");
    expect(html).toContain("<table><tr><td>Beras</td></tr></table>");
  });

  it("escapes a store name containing markup", () => {
    const html = buildPrintHtml({
      ...meta,
      storeName: "<script>alert(1)</script>",
      title: "Laporan",
      bodyHtml: "",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
