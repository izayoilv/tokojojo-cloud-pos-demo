import type { LocationCode, Product } from "../../data/types";

export function validateTransferDraft(draft: {
  from: LocationCode;
  to: LocationCode;
  productId: string;
  quantity: number;
  products: Product[];
}): string | null {
  if (!draft.productId) {
    return "Pilih produk terlebih dahulu.";
  }

  if (draft.from === draft.to) {
    return "Lokasi asal dan tujuan harus berbeda.";
  }

  if (!Number.isInteger(draft.quantity) || draft.quantity <= 0) {
    return "Jumlah harus berupa angka bulat lebih dari nol.";
  }

  const product = draft.products.find((item) => item.id === draft.productId);

  if (!product) {
    return "Produk tidak ditemukan.";
  }

  const available =
    draft.from === "WH-BACK" ? product.warehouseStock : product.storeStock;

  if (draft.quantity > available) {
    return draft.from === "WH-BACK"
      ? "Stok gudang tidak cukup."
      : "Stok toko tidak cukup.";
  }

  return null;
}

export function validateOpnameDraft(draft: {
  location: LocationCode;
  items: Array<{ productId: string; physicalQty: number }>;
}): string | null {
  if (draft.items.length === 0) {
    return "Tambahkan minimal satu produk.";
  }

  if (draft.items.some((item) => !item.productId)) {
    return "Pilih produk untuk setiap baris.";
  }

  if (
    new Set(draft.items.map((item) => item.productId)).size !==
    draft.items.length
  ) {
    return "Produk tidak boleh duplikat.";
  }

  if (
    draft.items.some(
      (item) => !Number.isInteger(item.physicalQty) || item.physicalQty < 0,
    )
  ) {
    return "Jumlah fisik harus angka bulat nol atau lebih.";
  }

  return null;
}
