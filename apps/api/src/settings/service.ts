import { getSqlClient, insertAuditEvent } from "../auth/repository.ts";
import type { DbClient } from "../db/query.ts";
import type { RequestContext } from "../graphql/context.ts";
import { forbidden, notFound, validationFailed } from "../graphql/errors.ts";

export interface StoreSettingsView {
  storeName: string;
  tagline: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  npwp: string | null;
  defaultLocation: "WAREHOUSE" | "STORE";
  lowStockGuidance: string | null;
  updatedAt: Date;
}

export interface ReceiptSettingsView {
  paperSize: "MM58" | "MM80";
  showPrice: boolean;
  footerText: string | null;
  autoPrint: boolean;
  updatedAt: Date;
}

interface StoreSettingsRow {
  store_name: string;
  tagline: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  npwp: string | null;
  default_location: "WAREHOUSE" | "STORE";
  low_stock_guidance: string | null;
  updated_at: Date;
}

interface ReceiptSettingsRow {
  paper_size: "MM58" | "MM80";
  show_price: boolean;
  footer_text: string | null;
  auto_print: boolean;
  updated_at: Date;
}

function mapStore(row: StoreSettingsRow): StoreSettingsView {
  return {
    storeName: row.store_name,
    tagline: row.tagline,
    address: row.address,
    city: row.city,
    phone: row.phone,
    npwp: row.npwp,
    defaultLocation: row.default_location,
    lowStockGuidance: row.low_stock_guidance,
    updatedAt: row.updated_at,
  };
}

function mapReceipt(row: ReceiptSettingsRow): ReceiptSettingsView {
  return {
    paperSize: row.paper_size,
    showPrice: row.show_price,
    footerText: row.footer_text,
    autoPrint: row.auto_print,
    updatedAt: row.updated_at,
  };
}

async function ensureStoreRow(client: DbClient): Promise<StoreSettingsRow> {
  await client`
    insert into store_settings (id, store_name, default_location)
    values (true, 'TokoJoJo', 'STORE')
    on conflict (id) do nothing`;
  const [row] = await client`
    select
      store_name, tagline, address, city, phone, npwp, default_location,
      low_stock_guidance, updated_at
    from store_settings where id = true limit 1`;
  if (!row) throw notFound("Pengaturan toko tidak ditemukan.");
  return row as StoreSettingsRow;
}

async function ensureReceiptRow(client: DbClient): Promise<ReceiptSettingsRow> {
  await client`
    insert into receipt_settings (id) values (true)
    on conflict (id) do nothing`;
  const [row] = await client`
    select paper_size, show_price, footer_text, auto_print, updated_at
    from receipt_settings where id = true limit 1`;
  if (!row) throw notFound("Pengaturan struk tidak ditemukan.");
  return row as ReceiptSettingsRow;
}

export async function getStoreSettings(): Promise<StoreSettingsView> {
  const client = await getSqlClient();
  return mapStore(await ensureStoreRow(client));
}

export async function getReceiptSettings(): Promise<ReceiptSettingsView> {
  const client = await getSqlClient();
  return mapReceipt(await ensureReceiptRow(client));
}

function nullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function requireActor(context: RequestContext): string {
  if (!context.user) throw forbidden("Operasi ini memerlukan sesi web.");
  return context.user.id;
}

export async function updateStoreSettings(
  context: RequestContext,
  input: {
    storeName?: string | null;
    tagline?: string | null;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    npwp?: string | null;
    defaultLocation?: "WAREHOUSE" | "STORE" | null;
    lowStockGuidance?: string | null;
  },
): Promise<StoreSettingsView> {
  const actorId = requireActor(context);
  const client = await getSqlClient();
  return client.begin(async (transaction) => {
    const current = await ensureStoreRow(transaction);

    let storeName = current.store_name;
    if (input.storeName !== undefined && input.storeName !== null) {
      const trimmed = input.storeName.trim();
      if (!trimmed) throw validationFailed("Nama toko wajib diisi.");
      storeName = trimmed;
    }

    const [row] = await transaction`
      update store_settings
      set
        store_name = ${storeName},
        tagline = ${
          input.tagline === undefined
            ? current.tagline
            : nullableText(input.tagline)
        },
        address = ${
          input.address === undefined
            ? current.address
            : nullableText(input.address)
        },
        city = ${
          input.city === undefined ? current.city : nullableText(input.city)
        },
        phone = ${
          input.phone === undefined ? current.phone : nullableText(input.phone)
        },
        npwp = ${
          input.npwp === undefined ? current.npwp : nullableText(input.npwp)
        },
        default_location = ${input.defaultLocation ?? current.default_location},
        low_stock_guidance = ${
          input.lowStockGuidance === undefined
            ? current.low_stock_guidance
            : nullableText(input.lowStockGuidance)
        },
        updated_at = now(),
        updated_by = ${actorId}
      where id = true
      returning
        store_name, tagline, address, city, phone, npwp, default_location,
        low_stock_guidance, updated_at`;

    const changed = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    await insertAuditEvent(transaction, {
      eventType: "STORE_SETTINGS_UPDATED",
      actorUserId: actorId,
      entityType: "store_settings",
      metadata: { changed },
    });
    return mapStore(row as StoreSettingsRow);
  });
}

export async function updateReceiptSettings(
  context: RequestContext,
  input: {
    paperSize?: "MM58" | "MM80" | null;
    showPrice?: boolean | null;
    footerText?: string | null;
    autoPrint?: boolean | null;
  },
): Promise<ReceiptSettingsView> {
  const actorId = requireActor(context);
  const client = await getSqlClient();
  return client.begin(async (transaction) => {
    const current = await ensureReceiptRow(transaction);

    const [row] = await transaction`
      update receipt_settings
      set
        paper_size = ${input.paperSize ?? current.paper_size},
        show_price = ${input.showPrice ?? current.show_price},
        footer_text = ${
          input.footerText === undefined
            ? current.footer_text
            : nullableText(input.footerText)
        },
        auto_print = ${input.autoPrint ?? current.auto_print},
        updated_at = now(),
        updated_by = ${actorId}
      where id = true
      returning
        paper_size, show_price, footer_text, auto_print, updated_at`;

    const changed = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    await insertAuditEvent(transaction, {
      eventType: "RECEIPT_SETTINGS_UPDATED",
      actorUserId: actorId,
      entityType: "receipt_settings",
      metadata: { changed },
    });
    return mapReceipt(row as ReceiptSettingsRow);
  });
}
