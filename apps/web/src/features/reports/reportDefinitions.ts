export type ReportCategory = "PENJUALAN" | "PERSEDIAAN" | "KEUANGAN";

export type ReportKind =
  | "SALES"
  | "PRODUCTS"
  | "CASHIER"
  | "STOCK"
  | "MOVEMENT"
  | "PAYABLES"
  | "PROFIT"
  | "CASHFLOW";

export type ReportDefinition = {
  title: string;
  description: string;
  category: ReportCategory;
  kind: ReportKind;
};

export const reportDefinitions: ReportDefinition[] = [
  {
    title: "Penjualan Harian / Mingguan / Bulanan",
    description: "Omzet, HPP, dan laba per periode.",
    category: "PENJUALAN",
    kind: "SALES",
  },
  {
    title: "Penjualan per Produk / Kategori",
    description: "Produk terlaris dan kontribusi margin.",
    category: "PENJUALAN",
    kind: "PRODUCTS",
  },
  {
    title: "Penjualan per Kasir / Metode",
    description: "Kinerja kasir dan metode pembayaran.",
    category: "PENJUALAN",
    kind: "CASHIER",
  },
  {
    title: "Laba Rugi (P&L)",
    description: "Penjualan, HPP, dan laba kotor.",
    category: "PENJUALAN",
    kind: "PROFIT",
  },
  {
    title: "Ikhtisar & Valuasi Stok",
    description: "Stok per lokasi dan nilai HPP.",
    category: "PERSEDIAAN",
    kind: "STOCK",
  },
  {
    title: "Pergerakan Stok (Ledger)",
    description: "Kartu stok masuk-keluar.",
    category: "PERSEDIAAN",
    kind: "MOVEMENT",
  },
  {
    title: "Hutang Supplier",
    description: "Hutang dan jadwal pembayaran.",
    category: "KEUANGAN",
    kind: "PAYABLES",
  },
  {
    title: "Arus Kas",
    description: "Kas masuk dan keluar per kategori.",
    category: "KEUANGAN",
    kind: "CASHFLOW",
  },
];
