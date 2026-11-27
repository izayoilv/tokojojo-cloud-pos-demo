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
  usesRange: boolean;
};

export const reportDefinitions: ReportDefinition[] = [
  {
    title: "Penjualan Harian / Mingguan / Bulanan",
    description: "Omzet, HPP, dan laba per periode.",
    category: "PENJUALAN",
    kind: "SALES",
    usesRange: true,
  },
  {
    title: "Penjualan per Produk / Kategori",
    description: "Produk terlaris dan kontribusi margin.",
    category: "PENJUALAN",
    kind: "PRODUCTS",
    usesRange: true,
  },
  {
    title: "Penjualan per Kasir / Metode",
    description: "Kinerja kasir dan metode pembayaran.",
    category: "PENJUALAN",
    kind: "CASHIER",
    usesRange: true,
  },
  {
    title: "Laba Rugi (P&L)",
    description: "Penjualan, HPP, dan laba kotor.",
    category: "PENJUALAN",
    kind: "PROFIT",
    usesRange: true,
  },
  {
    title: "Ikhtisar & Valuasi Stok",
    description: "Stok per lokasi dan nilai HPP.",
    category: "PERSEDIAAN",
    kind: "STOCK",
    usesRange: false,
  },
  {
    title: "Pergerakan Stok (Ledger)",
    description: "Kartu stok masuk-keluar.",
    category: "PERSEDIAAN",
    kind: "MOVEMENT",
    usesRange: true,
  },
  {
    title: "Hutang Supplier",
    description: "Hutang dan jadwal pembayaran.",
    category: "KEUANGAN",
    kind: "PAYABLES",
    usesRange: false,
  },
  {
    title: "Arus Kas",
    description: "Kas masuk dan keluar per kategori.",
    category: "KEUANGAN",
    kind: "CASHFLOW",
    usesRange: true,
  },
];
