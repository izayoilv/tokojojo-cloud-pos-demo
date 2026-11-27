import type {
  ReceiptSettingsView,
  StoreSettingsView,
} from "../../settings/service.ts";
import {
  getReceiptSettings,
  getStoreSettings,
  updateReceiptSettings,
  updateStoreSettings,
} from "../../settings/service.ts";
import { builder } from "../builder.ts";
import { ReceiptPaperSizeEnum, StockLocationEnum } from "./domain.ts";

const StoreSettingsRef = builder.objectRef<StoreSettingsView>("StoreSettings");
const ReceiptSettingsRef =
  builder.objectRef<ReceiptSettingsView>("ReceiptSettings");

const UpdateStoreSettingsInputRef = builder.inputType(
  "UpdateStoreSettingsInput",
  {
    fields: (t) => ({
      storeName: t.string(),
      tagline: t.string(),
      address: t.string(),
      city: t.string(),
      phone: t.string(),
      npwp: t.string(),
      defaultLocation: t.field({ type: StockLocationEnum }),
      lowStockGuidance: t.string(),
    }),
  },
);

const UpdateReceiptSettingsInputRef = builder.inputType(
  "UpdateReceiptSettingsInput",
  {
    fields: (t) => ({
      paperSize: t.field({ type: ReceiptPaperSizeEnum }),
      showPrice: t.boolean(),
      footerText: t.string(),
      autoPrint: t.boolean(),
    }),
  },
);

StoreSettingsRef.implement({
  fields: (t) => ({
    storeName: t.exposeString("storeName", { nullable: false }),
    tagline: t.exposeString("tagline"),
    address: t.exposeString("address"),
    city: t.exposeString("city"),
    phone: t.exposeString("phone"),
    npwp: t.exposeString("npwp"),
    defaultLocation: t.field({
      type: StockLocationEnum,
      nullable: false,
      resolve: (settings) => settings.defaultLocation,
    }),
    lowStockGuidance: t.exposeString("lowStockGuidance"),
    updatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (settings) => settings.updatedAt,
    }),
  }),
});

ReceiptSettingsRef.implement({
  fields: (t) => ({
    paperSize: t.field({
      type: ReceiptPaperSizeEnum,
      nullable: false,
      resolve: (settings) => settings.paperSize,
    }),
    showPrice: t.exposeBoolean("showPrice", { nullable: false }),
    footerText: t.exposeString("footerText"),
    autoPrint: t.exposeBoolean("autoPrint", { nullable: false }),
    updatedAt: t.field({
      type: "DateTime",
      nullable: false,
      resolve: (settings) => settings.updatedAt,
    }),
  }),
});

builder.queryFields((t) => ({
  storeSettings: t.field({
    type: StoreSettingsRef,
    nullable: false,
    resolve: () => getStoreSettings(),
  }),
  receiptSettings: t.field({
    type: ReceiptSettingsRef,
    nullable: false,
    resolve: () => getReceiptSettings(),
  }),
}));

builder.mutationFields((t) => ({
  updateStoreSettings: t.field({
    type: StoreSettingsRef,
    nullable: false,
    args: {
      input: t.arg({ type: UpdateStoreSettingsInputRef, required: true }),
    },
    resolve: (_parent, { input }, context) =>
      updateStoreSettings(context, input),
  }),
  updateReceiptSettings: t.field({
    type: ReceiptSettingsRef,
    nullable: false,
    args: {
      input: t.arg({ type: UpdateReceiptSettingsInputRef, required: true }),
    },
    resolve: (_parent, { input }, context) =>
      updateReceiptSettings(context, input),
  }),
}));
