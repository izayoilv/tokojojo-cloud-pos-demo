import type {
  Product,
  Sale,
  SalesKpis,
  SaleTotals,
  StockStatus,
} from "../data/types";

export function saleTotals(sale: Sale): SaleTotals {
  let subtotal = 0;
  let discount = 0;
  let cogs = 0;

  for (const item of sale.items) {
    const sold = Math.max(0, item.quantity - item.returned);
    subtotal += item.quantity * item.price;
    discount += sold * item.discount;
    cogs += sold * item.cost;
  }

  return {
    subtotal,
    discount,
    grandTotal: subtotal - discount,
    cogs,
  };
}

export function totalStock(product: Product): number {
  return product.warehouseStock + product.storeStock;
}

export function stockStatus(product: Product): StockStatus {
  const total = totalStock(product);

  if (total === 0) {
    return "HABIS";
  }

  if (
    total <= product.minStock ||
    product.storeStock <= product.minStoreStock
  ) {
    return "MENIPIS";
  }

  return "AMAN";
}

export function inventoryValue(products: Product[]): number {
  return products.reduce(
    (total, product) => total + totalStock(product) * product.cost,
    0,
  );
}

export function retailValue(products: Product[]): number {
  return products.reduce(
    (total, product) => total + totalStock(product) * product.price,
    0,
  );
}

export function lowStockProducts(products: Product[]): Product[] {
  return products.filter((product) => stockStatus(product) !== "AMAN");
}

export function salesKpis(sales: Sale[]): SalesKpis {
  let revenue = 0;
  let cogs = 0;

  for (const sale of sales) {
    const totals = saleTotals(sale);
    revenue += totals.grandTotal;
    cogs += totals.cogs;
  }

  const grossProfit = revenue - cogs;
  const margin = revenue === 0 ? 0 : (grossProfit / revenue) * 100;

  return { revenue, cogs, grossProfit, margin };
}
