import type { PaymentMethod } from "../data/types";

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  TUNAI: "Tunai",
  QRIS: "QRIS",
  DEBIT: "Debit",
  TRANSFER: "Transfer",
  CAMPURAN: "Campuran",
  HUTANG: "Hutang",
};

export const paymentMethodHints: Record<PaymentMethod, string> = {
  TUNAI: "Uang fisik",
  QRIS: "Pindai",
  DEBIT: "Kartu EDC",
  TRANSFER: "Transfer bank",
  CAMPURAN: "Tunai + non-tunai",
  HUTANG: "Pelanggan",
};

export const paymentReferenceLabels: Record<PaymentMethod, string> = {
  TUNAI: "Uang diterima",
  QRIS: "ID transaksi QRIS",
  DEBIT: "Nomor referensi EDC",
  TRANSFER: "ID transfer bank",
  CAMPURAN: "Referensi pembayaran campuran",
  HUTANG: "Nama pelanggan",
};

export function paymentMethodLabel(method: PaymentMethod | null): string {
  return method ? paymentMethodLabels[method] : "—";
}
