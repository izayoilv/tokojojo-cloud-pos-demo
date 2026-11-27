import type {
  CartLine,
  CartTotals,
  PaymentMethod,
  PosConnection,
  PosProduct,
  PosProductUnit,
} from "../data/types";

export function cartTotals(lines: CartLine[]): CartTotals {
  const subtotal = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0,
  );
  const discount = lines.reduce((sum, line) => sum + line.discount, 0);
  const itemCount = lines.length;

  return { subtotal, discount, total: subtotal - discount, itemCount };
}

export function changeDue(total: number, received: number): number {
  return received - total;
}

export function expectedCash(
  openingCash: number,
  cashSales: number,
  refunds: number,
): number {
  return openingCash + cashSales - refunds;
}

export function paymentMethodsFor(connection: PosConnection): PaymentMethod[] {
  if (connection === "LOCKED") return [];
  if (connection === "OFFLINE" || connection === "GRACE") return ["TUNAI"];
  return ["TUNAI", "QRIS", "DEBIT", "TRANSFER", "CAMPURAN", "HUTANG"];
}

export function filterProducts(
  products: PosProduct[],
  query: string,
  category: string,
): PosProduct[] {
  const needle = query.trim().toLowerCase();
  const selectedCategory = category.trim().toLowerCase();

  return products.filter((product) => {
    const matchesCategory =
      !selectedCategory ||
      selectedCategory === "semua" ||
      product.category.toLowerCase() === selectedCategory;
    const matchesQuery =
      !needle ||
      product.name.toLowerCase().includes(needle) ||
      product.sku.toLowerCase().includes(needle) ||
      product.barcode.includes(needle) ||
      product.units.some((unit) => unit.barcode.includes(needle));

    return matchesCategory && matchesQuery;
  });
}

export function unitFor(
  product: PosProduct,
  unitId: string,
): PosProductUnit | undefined {
  return product.units.find((unit) => unit.id === unitId);
}

export function formatRupiah(value: number): string {
  const grouped = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Math.abs(Math.round(value)));
  return `${value < 0 ? "-" : ""}Rp ${grouped}`;
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}
