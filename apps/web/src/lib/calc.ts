import type {
  LocationCode,
  Product,
  ProductUnit,
  Sale,
  SalesKpis,
  SaleTotals,
  StockStatus,
} from "../data/types";

export type DateRange = "TODAY" | "7DAYS" | "MONTH" | "ALL";

export type DailySalesPoint = {
  date: string;
  label: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
};

export type StockValuationSlice = {
  location: LocationCode;
  label: string;
  value: number;
  color: string;
};

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

export function productUnits(product: Product): ProductUnit[] {
  return product.units?.length
    ? product.units
    : [
        {
          id: `PU-${product.id}`,
          name: product.unit,
          conversionQty: 1,
          sellingPrice: product.price,
          barcode: product.barcode,
        },
      ];
}

export function baseUnit(product: Product): ProductUnit {
  return productUnits(product).reduce((base, unit) =>
    unit.conversionQty < base.conversionQty ? unit : base,
  );
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

/** The catalog is seed data from May 2025, so ranges anchor to the newest sale. */
function isoDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : value.slice(0, 10);
}

function dayNumber(isoDay: string): number {
  const [year, month, day] = isoDay.split("-").map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / 86_400_000;
}

function referenceDate(sales: Sale[]): string | null {
  let latest: string | null = null;

  for (const sale of sales) {
    const day = isoDate(sale.time);
    if (!latest || day > latest) {
      latest = day;
    }
  }

  return latest;
}

export function salesInRange(sales: Sale[], range: DateRange): Sale[] {
  const reference = referenceDate(sales);

  if (!reference || range === "ALL") {
    return [...sales];
  }

  const referenceDay = dayNumber(reference);
  const referenceMonth = reference.slice(0, 7);

  return sales.filter((sale) => {
    const day = isoDate(sale.time);

    if (range === "TODAY") {
      return day === reference;
    }

    if (range === "MONTH") {
      return day.slice(0, 7) === referenceMonth;
    }

    const difference = referenceDay - dayNumber(day);
    return difference >= 0 && difference <= 7;
  });
}

export function dailySalesSeries(
  sales: Sale[],
  range: DateRange,
): DailySalesPoint[] {
  const buckets = new Map<string, DailySalesPoint>();

  for (const sale of salesInRange(sales, range)) {
    const date = isoDate(sale.time);
    const totals = saleTotals(sale);
    const current = buckets.get(date) ?? {
      date,
      label: `${date.slice(8, 10)}/${date.slice(5, 7)}`,
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
    };

    current.revenue += totals.grandTotal;
    current.cogs += totals.cogs;
    current.grossProfit += totals.grandTotal - totals.cogs;
    buckets.set(date, current);
  }

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function stockValuationByLocation(
  products: Product[],
): StockValuationSlice[] {
  const warehouse = products.reduce(
    (total, product) => total + product.warehouseStock * product.cost,
    0,
  );
  const store = products.reduce(
    (total, product) => total + product.storeStock * product.cost,
    0,
  );

  return [
    {
      location: "WH-BACK",
      label: "Gudang Belakang",
      value: warehouse,
      color: "#0F2447",
    },
    {
      location: "STORE-FRONT",
      label: "Area Penjualan Toko",
      value: store,
      color: "#2563EB",
    },
  ];
}
