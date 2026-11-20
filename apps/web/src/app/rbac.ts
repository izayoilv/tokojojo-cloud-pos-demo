import type { Role } from "../data/types";

export type ModuleKey =
  | "DASHBOARD"
  | "PRODUCTS"
  | "INVENTORY"
  | "PURCHASING"
  | "SALES"
  | "WAREHOUSE"
  | "FINANCE"
  | "REPORTS"
  | "EMPLOYEES"
  | "SETTINGS";

export type ModuleDefinition = {
  key: ModuleKey;
  label: string;
  short: string;
  color: string;
  path: string;
  built: boolean;
  description?: string;
};

export type NavSection = {
  title: string;
  items: ModuleDefinition[];
};

export const roleMeta: Record<Role, { label: string; color: string }> = {
  OWNER: { label: "Pemilik Toko", color: "#6D28D9" },
  ADMIN: { label: "Admin Operasional", color: "#1D4ED8" },
  CASHIER: { label: "Kasir Toko", color: "#059669" },
  WAREHOUSE: { label: "Staf Gudang", color: "#D97706" },
};

export const roleModules: Record<Role, ModuleKey[]> = {
  OWNER: [
    "DASHBOARD",
    "PRODUCTS",
    "INVENTORY",
    "PURCHASING",
    "SALES",
    "WAREHOUSE",
    "FINANCE",
    "REPORTS",
    "EMPLOYEES",
    "SETTINGS",
  ],
  ADMIN: [
    "DASHBOARD",
    "PRODUCTS",
    "INVENTORY",
    "PURCHASING",
    "SALES",
    "WAREHOUSE",
    "FINANCE",
    "REPORTS",
    "EMPLOYEES",
    "SETTINGS",
  ],
  CASHIER: ["DASHBOARD", "PRODUCTS", "INVENTORY", "SALES"],
  WAREHOUSE: ["DASHBOARD", "PRODUCTS", "INVENTORY", "PURCHASING", "WAREHOUSE"],
};

export const navSections: NavSection[] = [
  {
    title: "UTAMA",
    items: [
      {
        key: "DASHBOARD",
        label: "Dashboard",
        short: "DB",
        color: "#2563EB",
        path: "/",
        built: true,
      },
    ],
  },
  {
    title: "TRANSAKSI",
    items: [
      {
        key: "SALES",
        label: "Penjualan (POS)",
        short: "PJ",
        color: "#059669",
        path: "/soon/sales",
        built: false,
        description:
          "Sinkronisasi struk POS, retur, dan rekap penjualan per kasir.",
      },
      {
        key: "PURCHASING",
        label: "Pembelian",
        short: "PB",
        color: "#D97706",
        path: "/soon/purchasing",
        built: false,
        description: "Purchase order, pembelian langsung, dan hutang supplier.",
      },
    ],
  },
  {
    title: "PERSEDIAAN",
    items: [
      {
        key: "PRODUCTS",
        label: "Produk",
        short: "PR",
        color: "#4F46E5",
        path: "/products",
        built: true,
      },
      {
        key: "INVENTORY",
        label: "Persediaan",
        short: "PS",
        color: "#0891B2",
        path: "/soon/inventory",
        built: false,
        description:
          "Stok per lokasi, buku besar pergerakan, dan stock opname.",
      },
      {
        key: "WAREHOUSE",
        label: "Gudang & Mutasi",
        short: "GD",
        color: "#65A30D",
        path: "/soon/warehouse",
        built: false,
        description:
          "Mutasi stok Gudang Belakang ke Area Penjualan dengan persetujuan.",
      },
    ],
  },
  {
    title: "KEUANGAN",
    items: [
      {
        key: "FINANCE",
        label: "Keuangan",
        short: "KU",
        color: "#DC2626",
        path: "/soon/finance",
        built: false,
        description: "Kas, bank, beban operasional, dan arus kas toko.",
      },
      {
        key: "REPORTS",
        label: "Laporan",
        short: "LP",
        color: "#7C3AED",
        path: "/reports",
        built: true,
      },
    ],
  },
  {
    title: "SISTEM",
    items: [
      {
        key: "EMPLOYEES",
        label: "Karyawan & Audit",
        short: "KY",
        color: "#0F766E",
        path: "/soon/employees",
        built: false,
        description: "Pengguna, matriks peran RBAC, dan audit log.",
      },
      {
        key: "SETTINGS",
        label: "Pengaturan",
        short: "ST",
        color: "#475569",
        path: "/soon/settings",
        built: false,
        description: "Identitas toko, struk, lokasi, dan preferensi sistem.",
      },
    ],
  },
];

export const allModules = navSections.flatMap((section) => section.items);

export function moduleByKey(key: string): ModuleDefinition | undefined {
  return allModules.find((module) => module.key === key.toUpperCase());
}

export function moduleByPath(pathname: string): ModuleDefinition | undefined {
  return [...allModules]
    .sort((a, b) => b.path.length - a.path.length)
    .find((module) =>
      module.path === "/" ? pathname === "/" : pathname.startsWith(module.path),
    );
}

export function canAccess(role: Role, key: ModuleKey): boolean {
  return roleModules[role].includes(key);
}

export function visibleSections(role: Role): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccess(role, item.key)),
    }))
    .filter((section) => section.items.length > 0);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
