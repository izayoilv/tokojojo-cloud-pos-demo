import { builder } from "../builder.ts";
import { DateTimeScalar } from "../scalars.ts";

builder.addScalarType("DateTime", DateTimeScalar, {});

export const SortDirectionEnum = builder.enumType("SortDirection", {
  values: ["ASC", "DESC"] as const,
});

export const PageInputRef = builder.inputType("PageInput", {
  fields: (t) => ({
    page: t.int({ defaultValue: 1 }),
    pageSize: t.int({ defaultValue: 20 }),
  }),
});

export const PageInfoRef = builder.objectRef<{
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}>("PageInfo");

PageInfoRef.implement({
  fields: (t) => ({
    page: t.int({ nullable: false, resolve: (info) => info.page }),
    pageSize: t.int({ nullable: false, resolve: (info) => info.pageSize }),
    total: t.int({ nullable: false, resolve: (info) => info.total }),
    totalPages: t.int({ nullable: false, resolve: (info) => info.totalPages }),
  }),
});

export const SortInputRef = builder.inputType("SortInput", {
  fields: (t) => ({
    field: t.string({ required: true }),
    direction: t.field({ type: SortDirectionEnum, required: true }),
  }),
});

export const DateRangeInputRef = builder.inputType("DateRangeInput", {
  fields: (t) => ({
    from: t.field({ type: "DateTime" }),
    to: t.field({ type: "DateTime" }),
  }),
});
