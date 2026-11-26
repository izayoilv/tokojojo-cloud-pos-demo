import {
  ArrowLeftRight,
  FileBarChart,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  UserRound,
  Users,
  Wallet,
  Warehouse,
} from "lucide-solid";
import type { Component } from "solid-js";

import type { Role } from "../data/types";

export type ModuleKey =
  | "RINGKASAN"
  | "PRODUK"
  | "PELANGGAN"
  | "PERSEDIAAN"
  | "PEMBELIAN"
  | "PENJUALAN"
  | "GUDANG"
  | "KEUANGAN"
  | "LAPORAN"
  | "PENGGUNA"
  | "PENGATURAN";

export type ModuleDefinition = {
  key: ModuleKey;
  label: string;
  path: string;
  icon: Component<{ size?: number | string; class?: string }>;
};

export type NavSection = {
  title: string;
  items: ModuleDefinition[];
};

export const roleMeta: Record<Role, { label: string; color: string }> = {
  OWNER: { label: "Pemilik Toko", color: "#6D28D9" },
  ADMIN: { label: "Admin Operasional", color: "#1D4ED8" },
  CASHIER: { label: "Kasir Toko", color: "#15803D" },
  WAREHOUSE: { label: "Staf Gudang", color: "#B45309" },
};

export const roleModules: Record<Role, ModuleKey[]> = {
  OWNER: [
    "RINGKASAN",
    "PRODUK",
    "PELANGGAN",
    "PERSEDIAAN",
    "PEMBELIAN",
    "PENJUALAN",
    "GUDANG",
    "KEUANGAN",
    "LAPORAN",
    "PENGGUNA",
    "PENGATURAN",
  ],
  ADMIN: [
    "RINGKASAN",
    "PRODUK",
    "PELANGGAN",
    "PERSEDIAAN",
    "PEMBELIAN",
    "PENJUALAN",
    "GUDANG",
    "KEUANGAN",
    "LAPORAN",
    "PENGGUNA",
    "PENGATURAN",
  ],
  CASHIER: [
    "RINGKASAN",
    "PRODUK",
    "PELANGGAN",
    "PERSEDIAAN",
    "PENJUALAN",
    "PENGATURAN",
  ],
  WAREHOUSE: [
    "RINGKASAN",
    "PRODUK",
    "PERSEDIAAN",
    "PEMBELIAN",
    "GUDANG",
    "PENGATURAN",
  ],
};

export const navSections: NavSection[] = [
  {
    title: "UTAMA",
    items: [
      {
        key: "RINGKASAN",
        label: "Ringkasan",
        path: "/",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "TRANSAKSI",
    items: [
      {
        key: "PENJUALAN",
        label: "Penjualan",
        path: "/penjualan",
        icon: ShoppingCart,
      },
      {
        key: "PELANGGAN",
        label: "Pelanggan",
        path: "/pelanggan",
        icon: UserRound,
      },
      {
        key: "PEMBELIAN",
        label: "Pembelian",
        path: "/pembelian",
        icon: Truck,
      },
    ],
  },
  {
    title: "PERSEDIAAN",
    items: [
      {
        key: "PRODUK",
        label: "Produk",
        path: "/produk",
        icon: Package,
      },
      {
        key: "PERSEDIAAN",
        label: "Persediaan",
        path: "/persediaan",
        icon: Warehouse,
      },
      {
        key: "GUDANG",
        label: "Gudang",
        path: "/gudang",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    title: "KEUANGAN",
    items: [
      {
        key: "KEUANGAN",
        label: "Keuangan",
        path: "/keuangan",
        icon: Wallet,
      },
      {
        key: "LAPORAN",
        label: "Laporan",
        path: "/laporan",
        icon: FileBarChart,
      },
    ],
  },
  {
    title: "SISTEM",
    items: [
      {
        key: "PENGGUNA",
        label: "Pengguna & Audit",
        path: "/pengguna",
        icon: Users,
      },
      {
        key: "PENGATURAN",
        label: "Pengaturan",
        path: "/pengaturan",
        icon: Settings,
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
      module.path === "/"
        ? pathname === "/"
        : pathname === module.path || pathname.startsWith(`${module.path}/`),
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

export function canManageSettings(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canReviewOpname(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canViewSales(role: Role): boolean {
  return canAccess(role, "PENJUALAN");
}

export function assignableRoles(role: Role): Role[] {
  return role === "OWNER"
    ? ["OWNER", "ADMIN", "CASHIER", "WAREHOUSE"]
    : ["ADMIN", "CASHIER", "WAREHOUSE"];
}

export function canAssignRole(actor: Role, target: Role): boolean {
  return actor === "OWNER" || target !== "OWNER";
}
