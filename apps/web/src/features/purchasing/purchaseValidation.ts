import type { PurchaseItem } from "../../data/types";

export type PurchaseDraft = {
  supplierName: string;
  invoice: string;
  due: string;
  items: PurchaseItem[];
};

export function validatePurchaseDraft(draft: PurchaseDraft): string | null {
  if (!draft.supplierName.trim()) {
    return "Supplier wajib dipilih.";
  }

  if (!draft.invoice.trim()) {
    return "Faktur supplier wajib diisi.";
  }

  if (!draft.due) {
    return "Jatuh tempo wajib diisi.";
  }

  if (draft.items.length === 0) {
    return "Tambahkan minimal satu barang.";
  }

  if (
    draft.items.some(
      (item) => !item.productId || item.quantity <= 0 || item.unitCost < 0,
    )
  ) {
    return "Lengkapi produk, jumlah, dan harga.";
  }

  return null;
}
