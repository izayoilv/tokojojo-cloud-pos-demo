import type {
  CatalogSyncView,
  CategoryView,
  CustomerPageView,
  CustomerView,
  ProductPageView,
  ProductStockThresholdView,
  ProductUnitView,
  ProductView,
  SupplierPageView,
  SupplierView,
} from "../../catalog/service.ts";
import {
  catalogSync,
  createCategory,
  createCustomer,
  createProduct,
  createSupplier,
  getCustomer,
  getProduct,
  getSupplier,
  listCategories,
  listCustomers,
  listProducts,
  listSuppliers,
  setCustomerActive,
  setProductActive,
  setSupplierActive,
  updateCategory,
  updateCustomer,
  updateProduct,
  updateSupplier,
} from "../../catalog/service.ts";
import { builder } from "../builder.ts";
import { PageInfoRef, PageInputRef, SortInputRef } from "./common.ts";
import { CatalogEntityTypeEnum, StockLocationEnum } from "./domain.ts";

export const CategoryRef = builder.objectRef<CategoryView>("Category");
export const ProductUnitRef = builder.objectRef<ProductUnitView>("ProductUnit");
export const ProductStockThresholdRef =
  builder.objectRef<ProductStockThresholdView>("ProductStockThreshold");
export const ProductRef = builder.objectRef<ProductView>("Product");
export const SupplierRef = builder.objectRef<SupplierView>("Supplier");
export const CustomerRef = builder.objectRef<CustomerView>("Customer");

const ProductPageRef = builder.objectRef<ProductPageView>("ProductPage");
const SupplierPageRef = builder.objectRef<SupplierPageView>("SupplierPage");
const CustomerPageRef = builder.objectRef<CustomerPageView>("CustomerPage");

const CatalogTombstoneRef = builder.objectRef<{
  entityType: "PRODUCT" | "CATEGORY" | "SUPPLIER";
  entityId: string;
  deletedAt: Date | string;
}>("CatalogTombstone");
const CatalogSyncPayloadRef =
  builder.objectRef<CatalogSyncView>("CatalogSyncPayload");

const SortInput = SortInputRef;
const PageInput = PageInputRef;

const ProductUnitInputRef = builder.inputType("ProductUnitInput", {
  fields: (t) => ({
    productUnitId: t.id(),
    unitName: t.string({ required: true }),
    conversionQty: t.string({ required: true }),
    sellingPrice: t.string({ required: true }),
    barcode: t.string(),
  }),
});

const StockThresholdInputRef = builder.inputType("StockThresholdInput", {
  fields: (t) => ({
    location: t.field({ type: StockLocationEnum, required: true }),
    minQty: t.string({ required: true }),
  }),
});

const CreateProductInputRef = builder.inputType("CreateProductInput", {
  fields: (t) => ({
    sku: t.string({ required: true }),
    name: t.string({ required: true }),
    categoryId: t.id({ required: true }),
    baseUnit: t.string({ required: true }),
    units: t.field({ type: [ProductUnitInputRef], required: true }),
    thresholds: t.field({ type: [StockThresholdInputRef] }),
  }),
});

const UpdateProductInputRef = builder.inputType("UpdateProductInput", {
  fields: (t) => ({
    name: t.string(),
    categoryId: t.id(),
    baseUnit: t.string(),
    units: t.field({ type: [ProductUnitInputRef] }),
    thresholds: t.field({ type: [StockThresholdInputRef] }),
  }),
});

const CategoryInputRef = builder.inputType("CategoryInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
  }),
});

const SupplierInputRef = builder.inputType("SupplierInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    phone: t.string(),
    address: t.string(),
    notes: t.string(),
  }),
});

const CustomerInputRef = builder.inputType("CustomerInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    phone: t.string(),
    address: t.string(),
    notes: t.string(),
  }),
});

const ProductFilterRef = builder.inputType("ProductFilter", {
  fields: (t) => ({
    search: t.string(),
    barcode: t.string(),
    categoryId: t.id(),
    isActive: t.boolean(),
    location: t.field({ type: StockLocationEnum }),
  }),
});

const SupplierFilterRef = builder.inputType("SupplierFilter", {
  fields: (t) => ({
    search: t.string(),
    isActive: t.boolean(),
  }),
});

const CustomerFilterRef = builder.inputType("CustomerFilter", {
  fields: (t) => ({
    search: t.string(),
    isActive: t.boolean(),
  }),
});

CategoryRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    name: t.exposeString("name", { nullable: false }),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (category) => category.createdAt,
    }),
    updatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (category) => category.updatedAt,
    }),
  }),
});

ProductUnitRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    productId: t.exposeID("productId", { nullable: false }),
    unitName: t.exposeString("unitName", { nullable: false }),
    conversionQty: t.exposeString("conversionQty", { nullable: false }),
    sellingPrice: t.exposeString("sellingPrice", { nullable: false }),
    barcode: t.exposeString("barcode"),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (unit) => unit.createdAt,
    }),
    updatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (unit) => unit.updatedAt,
    }),
  }),
});

ProductStockThresholdRef.implement({
  fields: (t) => ({
    productId: t.exposeID("productId", { nullable: false }),
    location: t.field({
      type: StockLocationEnum,
      nullable: false,
      resolve: (threshold) => threshold.location,
    }),
    minQty: t.exposeString("minQty", { nullable: false }),
  }),
});

ProductRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    sku: t.exposeString("sku", { nullable: false }),
    name: t.exposeString("name", { nullable: false }),
    categoryId: t.exposeID("categoryId", { nullable: false }),
    category: t.field({
      type: CategoryRef,
      nullable: false,
      resolve: (product) => product.category,
    }),
    baseUnit: t.exposeString("baseUnit", { nullable: false }),
    avgCost: t.exposeString("avgCost", { nullable: false }),
    isActive: t.exposeBoolean("isActive", { nullable: false }),
    units: t.field({
      type: [ProductUnitRef],
      nullable: false,
      resolve: (product) => product.units,
    }),
    thresholds: t.field({
      type: [ProductStockThresholdRef],
      nullable: false,
      resolve: (product) => product.thresholds,
    }),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (product) => product.createdAt,
    }),
    updatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (product) => product.updatedAt,
    }),
  }),
});

SupplierRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    name: t.exposeString("name", { nullable: false }),
    phone: t.exposeString("phone"),
    address: t.exposeString("address"),
    notes: t.exposeString("notes"),
    isActive: t.exposeBoolean("isActive", { nullable: false }),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (supplier) => supplier.createdAt,
    }),
    updatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (supplier) => supplier.updatedAt,
    }),
  }),
});

CustomerRef.implement({
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    name: t.exposeString("name", { nullable: false }),
    phone: t.exposeString("phone"),
    address: t.exposeString("address"),
    notes: t.exposeString("notes"),
    isActive: t.exposeBoolean("isActive", { nullable: false }),
    outstandingReceivable: t.exposeString("outstandingReceivable", {
      nullable: false,
    }),
    createdAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (customer) => customer.createdAt,
    }),
    updatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (customer) => customer.updatedAt,
    }),
  }),
});

ProductPageRef.implement({
  fields: (t) => ({
    items: t.field({
      type: [ProductRef],
      nullable: false,
      resolve: (page) => page.items,
    }),
    pageInfo: t.field({
      type: PageInfoRef,
      nullable: false,
      resolve: (page) => page.pageInfo,
    }),
  }),
});

SupplierPageRef.implement({
  fields: (t) => ({
    items: t.field({
      type: [SupplierRef],
      nullable: false,
      resolve: (page) => page.items,
    }),
    pageInfo: t.field({
      type: PageInfoRef,
      nullable: false,
      resolve: (page) => page.pageInfo,
    }),
  }),
});

CustomerPageRef.implement({
  fields: (t) => ({
    items: t.field({
      type: [CustomerRef],
      nullable: false,
      resolve: (page) => page.items,
    }),
    pageInfo: t.field({
      type: PageInfoRef,
      nullable: false,
      resolve: (page) => page.pageInfo,
    }),
  }),
});

CatalogTombstoneRef.implement({
  fields: (t) => ({
    entityType: t.field({
      type: CatalogEntityTypeEnum,
      nullable: false,
      resolve: (tombstone) => tombstone.entityType,
    }),
    entityId: t.exposeID("entityId", { nullable: false }),
    deletedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (tombstone) => tombstone.deletedAt,
    }),
  }),
});

CatalogSyncPayloadRef.implement({
  fields: (t) => ({
    serverTime: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (payload) => payload.serverTime,
    }),
    products: t.field({
      type: [ProductRef],
      nullable: false,
      resolve: (payload) => payload.products,
    }),
    categories: t.field({
      type: [CategoryRef],
      nullable: false,
      resolve: (payload) => payload.categories,
    }),
    suppliers: t.field({
      type: [SupplierRef],
      nullable: false,
      resolve: (payload) => payload.suppliers,
    }),
    tombstones: t.field({
      type: [CatalogTombstoneRef],
      nullable: false,
      resolve: (payload) => payload.tombstones,
    }),
  }),
});

builder.queryFields((t) => ({
  products: t.field({
    type: ProductPageRef,
    nullable: false,
    args: {
      filter: t.arg({ type: ProductFilterRef }),
      page: t.arg({ type: PageInput }),
      sort: t.arg({ type: SortInput }),
    },
    resolve: (_parent, args) => listProducts(args as never),
  }),
  product: t.field({
    type: ProductRef,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_parent, { id }) => getProduct(String(id)),
  }),
  categories: t.field({
    type: [CategoryRef],
    nullable: false,
    resolve: () => listCategories(),
  }),
  suppliers: t.field({
    type: SupplierPageRef,
    nullable: false,
    args: {
      filter: t.arg({ type: SupplierFilterRef }),
      page: t.arg({ type: PageInput }),
      sort: t.arg({ type: SortInput }),
    },
    resolve: (_parent, args) => listSuppliers(args as never),
  }),
  supplier: t.field({
    type: SupplierRef,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_parent, { id }) => getSupplier(String(id)),
  }),
  customers: t.field({
    type: CustomerPageRef,
    nullable: false,
    args: {
      filter: t.arg({ type: CustomerFilterRef }),
      page: t.arg({ type: PageInput }),
      sort: t.arg({ type: SortInput }),
    },
    resolve: (_parent, args) => listCustomers(args as never),
  }),
  customer: t.field({
    type: CustomerRef,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_parent, { id }) => getCustomer(String(id)),
  }),
  catalogSync: t.field({
    type: CatalogSyncPayloadRef,
    nullable: false,
    args: { since: t.arg({ type: "DateTime" }) },
    resolve: (_parent, { since }) =>
      catalogSync(since ? new Date(since as Date | string) : null),
  }),
}));

builder.mutationFields((t) => ({
  createProduct: t.field({
    type: ProductRef,
    nullable: false,
    args: { input: t.arg({ type: CreateProductInputRef, required: true }) },
    resolve: (_parent, { input }) => createProduct(input),
  }),
  updateProduct: t.field({
    type: ProductRef,
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateProductInputRef, required: true }),
    },
    resolve: (_parent, { id, input }) => updateProduct(String(id), input),
  }),
  setProductActive: t.field({
    type: ProductRef,
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      active: t.arg.boolean({ required: true }),
    },
    resolve: (_parent, { id, active }) => setProductActive(String(id), active),
  }),
  createCategory: t.field({
    type: CategoryRef,
    nullable: false,
    args: { input: t.arg({ type: CategoryInputRef, required: true }) },
    resolve: (_parent, { input }) => createCategory(input),
  }),
  updateCategory: t.field({
    type: CategoryRef,
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: CategoryInputRef, required: true }),
    },
    resolve: (_parent, { id, input }) => updateCategory(String(id), input),
  }),
  createSupplier: t.field({
    type: SupplierRef,
    nullable: false,
    args: { input: t.arg({ type: SupplierInputRef, required: true }) },
    resolve: (_parent, { input }) => createSupplier(input),
  }),
  updateSupplier: t.field({
    type: SupplierRef,
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: SupplierInputRef, required: true }),
    },
    resolve: (_parent, { id, input }) => updateSupplier(String(id), input),
  }),
  setSupplierActive: t.field({
    type: SupplierRef,
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      active: t.arg.boolean({ required: true }),
    },
    resolve: (_parent, { id, active }) => setSupplierActive(String(id), active),
  }),
  createCustomer: t.field({
    type: CustomerRef,
    nullable: false,
    args: { input: t.arg({ type: CustomerInputRef, required: true }) },
    resolve: (_parent, { input }) => createCustomer(input),
  }),
  updateCustomer: t.field({
    type: CustomerRef,
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: CustomerInputRef, required: true }),
    },
    resolve: (_parent, { id, input }) => updateCustomer(String(id), input),
  }),
  setCustomerActive: t.field({
    type: CustomerRef,
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      active: t.arg.boolean({ required: true }),
    },
    resolve: (_parent, { id, active }) => setCustomerActive(String(id), active),
  }),
}));
