import type { Product } from "../../data/types";

const headers = [
  "Nama",
  "SKU",
  "Barcode",
  "Kategori",
  "Merek",
  "Satuan",
  "HPP",
  "Harga Jual",
  "Stok Gudang",
  "Stok Toko",
  "Stok Minimum",
];

function escapeCell(value: string | number): string {
  const raw = String(value);
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function productsToCsv(products: Product[]): string {
  const rows = products.map((product) =>
    [
      product.name,
      product.sku,
      product.barcode,
      product.category,
      product.brand,
      product.unit,
      product.cost,
      product.price,
      product.warehouseStock,
      product.storeStock,
      product.minStock,
    ]
      .map(escapeCell)
      .join(","),
  );

  return [headers.join(","), ...rows].join("\r\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([`\uFEFF${content}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
