import type { Opname, Payable, Product, Role, Transfer } from "../data/types";
import { stockStatus } from "../lib/calc";
import { isDueSoon } from "../lib/date";
import { formatRupiah } from "../lib/format";
import { canAccess } from "./rbac";

export type NotificationTone = "danger" | "warning" | "info";

export type NotificationItem = {
  tone: NotificationTone;
  title: string;
  detail: string;
  href: string;
};

export function buildNotifications(input: {
  role: Role | undefined;
  products: Product[];
  transfers: Transfer[];
  opnames: Opname[];
  payables: Payable[];
  now?: Date;
}): NotificationItem[] {
  const items: NotificationItem[] = [];
  const now = input.now ?? new Date();

  for (const product of input.products) {
    if (!product.active) continue;
    const status = stockStatus(product);

    if (status === "HABIS") {
      items.push({
        tone: "danger",
        title: `Stok habis: ${product.name}`,
        detail: "Segera buat pembelian ke supplier.",
        href: "/persediaan",
      });
    } else if (status === "MENIPIS") {
      items.push({
        tone: "warning",
        title: `Stok menipis: ${product.name}`,
        detail: `${product.storeStock} di toko · ${product.warehouseStock} di gudang.`,
        href: "/persediaan",
      });
    }
  }

  if (input.role && canAccess(input.role, "GUDANG")) {
    for (const transfer of input.transfers.filter(
      (item) => item.status === "PENDING",
    )) {
      items.push({
        tone: "info",
        title: `Mutasi pending: ${transfer.number}`,
        detail: `${transfer.itemCount} jenis barang · ${transfer.createdBy}.`,
        href: "/gudang",
      });
    }

    for (const opname of input.opnames.filter(
      (item) => item.status === "PENDING_REVIEW",
    )) {
      items.push({
        tone: "warning",
        title: `Opname menunggu review: ${opname.number}`,
        detail: `${opname.items.length} produk · ${opname.createdBy}.`,
        href: "/gudang",
      });
    }
  }

  if (input.role && canAccess(input.role, "PEMBELIAN")) {
    for (const payable of input.payables) {
      const remaining = payable.total - payable.paid;

      if (remaining > 0 && isDueSoon(payable.due, now)) {
        items.push({
          tone: "danger",
          title: `Hutang jatuh tempo: ${payable.supplierName}`,
          detail: `${payable.invoice} · sisa ${formatRupiah(remaining)}.`,
          href: "/pembelian",
        });
      }
    }
  }

  return items;
}
