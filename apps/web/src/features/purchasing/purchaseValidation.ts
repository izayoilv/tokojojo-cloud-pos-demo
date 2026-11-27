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
    draft.items.every((item) => item.productId) &&
    new Set(draft.items.map((item) => item.productId)).size !==
      draft.items.length
  ) {
    return "Produk tidak boleh duplikat dalam satu pembelian.";
  }

  if (
    draft.items.some(
      (item) =>
        !item.productId ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isInteger(item.unitCost) ||
        item.unitCost <= 0,
    )
  ) {
    return "Lengkapi produk, jumlah, dan harga.";
  }

  return null;
}
