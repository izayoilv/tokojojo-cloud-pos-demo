import type { PaymentMethod, PosSale, SaleStatus } from "../data/types";

export type SaleMethodFilter = PaymentMethod | "ALL";
export type SaleStatusFilter = SaleStatus | "ALL";

const timeValue = (sale: PosSale) => new Date(sale.time).getTime();

export function filterSales(
  sales: PosSale[],
  query: string,
  method: SaleMethodFilter,
  status: SaleStatusFilter,
): PosSale[] {
  const needle = query.trim().toLowerCase();

  return sales
    .filter((sale) => {
      const matchesQuery =
        !needle ||
        sale.invoice.toLowerCase().includes(needle) ||
        sale.cashier.toLowerCase().includes(needle) ||
        (sale.customer?.toLowerCase().includes(needle) ?? false) ||
        sale.payments.some((payment) =>
          payment.reference?.toLowerCase().includes(needle),
        );
      const matchesMethod =
        method === "ALL" ||
        sale.payments.some((payment) => payment.method === method);
      const matchesStatus = status === "ALL" || sale.status === status;

      return matchesQuery && matchesMethod && matchesStatus;
    })
    .slice()
    .sort((a, b) => timeValue(b) - timeValue(a));
}

export function saleStatusLabel(status: SaleStatus): string {
  switch (status) {
    case "COMPLETED":
      return "Selesai";
    case "PARTIAL_RETURN":
      return "Retur sebagian";
    case "VOIDED":
      return "Void";
  }
}

export function saleStatusTone(
  status: SaleStatus,
): "success" | "warning" | "danger" {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "PARTIAL_RETURN":
      return "warning";
    case "VOIDED":
      return "danger";
  }
}
