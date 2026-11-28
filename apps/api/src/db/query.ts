import type postgres from "postgres";

import { validationFailed } from "../graphql/errors.ts";

export type DbClient = postgres.Sql | postgres.TransactionSql;

export async function getSqlClient(): Promise<postgres.Sql> {
  const { sql } = await import("./client.ts");
  return sql;
}

export function money(value: unknown): string {
  return String(value ?? 0);
}

export function decimal(value: unknown): string {
  return String(value ?? 0);
}

export function toQuantity(value: number): string {
  return (Math.round(value * 1000) / 1000).toFixed(3);
}

export function toMoney(value: number): number {
  return Math.round(value);
}

export function documentNumber(prefix: string, now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

export interface PageInput {
  page: number;
  pageSize: number;
}

export function normalizePage(page?: PageInput | null): PageInput {
  const pageNumber = Math.max(1, Math.trunc(page?.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.trunc(page?.pageSize ?? 20)));
  return { page: pageNumber, pageSize };
}

export interface PageInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function pageInfo(page: PageInput, total: number): PageInfo {
  return {
    page: page.page,
    pageSize: page.pageSize,
    total,
    totalPages: Math.ceil(total / page.pageSize),
  };
}

export function resolveSort(
  sort: { field: string; direction: "ASC" | "DESC" } | null | undefined,
  allowed: Record<string, string>,
  fallback: string,
): { expression: string; direction: "ASC" | "DESC" } {
  if (!sort) return { expression: fallback, direction: "DESC" };
  const expression = allowed[sort.field];
  if (!expression) {
    throw validationFailed(`Sort field ${sort.field} tidak didukung.`);
  }
  return { expression, direction: sort.direction };
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505"
  );
}

export function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23503"
  );
}
export function toDate(value: unknown): Date | null {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}
