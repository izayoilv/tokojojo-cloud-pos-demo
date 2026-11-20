import { createSignal, Show } from "solid-js";

import { useToast } from "../../app/toast";
import { Button } from "../../components/ui/Button";
import { Field, inputClass } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { repository } from "../../data/repository";
import type { Product } from "../../data/types";

const units = [
  "Pcs",
  "Bungkus",
  "Pouch",
  "Botol",
  "Karung",
  "Dus",
  "Tray",
  "Renceng",
  "Kotak",
  "Kg",
  "Liter",
];

type FormState = {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  unit: string;
  cost: string;
  price: string;
  minStock: string;
};

type FieldKey = keyof FormState;

export function ProductFormModal(props: {
  product: Product | null;
  categories: string[];
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = createSignal(false);
  const [errors, setErrors] = createSignal<Partial<Record<FieldKey, string>>>(
    {},
  );

  const initial = (): FormState => ({
    name: props.product?.name ?? "",
    sku: props.product?.sku ?? "",
    barcode: props.product?.barcode ?? "",
    category: props.product?.category ?? props.categories[0] ?? "Sembako Utama",
    brand: props.product?.brand ?? "",
    unit: props.product?.unit ?? "Pcs",
    cost: String(props.product?.cost ?? 0),
    price: String(props.product?.price ?? ""),
    minStock: String(props.product?.minStock ?? 20),
  });

  const [form, setForm] = createSignal<FormState>(initial());

  const update = (key: FieldKey, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<FieldKey, string>> = {};
    const values = form();

    if (!values.name.trim()) next.name = "Nama produk wajib diisi.";
    if (!values.sku.trim()) next.sku = "SKU wajib diisi.";
    if (!values.barcode.trim()) next.barcode = "Barcode wajib diisi.";
    if (!(Number(values.price) > 0)) {
      next.price = "Harga jual harus lebih dari Rp 0.";
    }
    if (Number(values.cost) < 0) {
      next.cost = "HPP tidak boleh negatif.";
    }
    if (Number(values.minStock) < 0) {
      next.minStock = "Stok minimum tidak boleh negatif.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!props.canEdit || !validate()) {
      return;
    }

    setSaving(true);

    try {
      const values = form();
      const payload: Product = {
        id: props.product?.id ?? "",
        sku: values.sku.trim(),
        barcode: values.barcode.trim(),
        name: values.name.trim(),
        category: values.category,
        brand: values.brand.trim() || "Umum",
        unit: values.unit,
        cost: Math.round(Number(values.cost) || 0),
        price: Math.round(Number(values.price) || 0),
        warehouseStock: props.product?.warehouseStock ?? 0,
        storeStock: props.product?.storeStock ?? 0,
        minStock: Math.round(Number(values.minStock) || 0),
        minStoreStock: props.product?.minStoreStock ?? 8,
        color: props.product?.color ?? "#2563eb",
      };

      await repository.saveProduct(payload);
      toast.notify(
        props.product
          ? `Produk diperbarui: ${payload.name}`
          : `Produk ditambahkan: ${payload.name}`,
      );
      props.onSaved();
      props.onClose();
    } catch (caught) {
      toast.notify(
        caught instanceof Error ? caught.message : "Produk gagal disimpan.",
        "err",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      title={
        props.product
          ? props.canEdit
            ? "Edit Produk"
            : "Detail Produk"
          : "Tambah Produk Baru"
      }
      size="lg"
      footer={
        <Show
          when={props.canEdit}
          fallback={<Button onClick={props.onClose}>Tutup</Button>}
        >
          <Button onClick={props.onClose}>Batal</Button>
          <Button variant="primary" loading={saving()} onClick={save}>
            Simpan Produk
          </Button>
        </Show>
      }
    >
      <div class="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        <Field label="Nama Produk *" error={errors().name}>
          <input
            class={inputClass}
            value={form().name}
            disabled={!props.canEdit}
            onInput={(event) => update("name", event.currentTarget.value)}
          />
        </Field>
        <Field label="SKU *" error={errors().sku}>
          <input
            class={inputClass}
            value={form().sku}
            disabled={!props.canEdit}
            onInput={(event) => update("sku", event.currentTarget.value)}
          />
        </Field>
      </div>

      <div class="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        <Field label="Barcode Utama *" error={errors().barcode}>
          <input
            class={inputClass}
            value={form().barcode}
            disabled={!props.canEdit}
            onInput={(event) => update("barcode", event.currentTarget.value)}
          />
        </Field>
        <Field
          label="Barcode Lain"
          hint="Pisahkan dengan koma untuk barcode dus/karton."
        >
          <input
            class={inputClass}
            placeholder="cth: kode dus/karton"
            disabled={!props.canEdit}
          />
        </Field>
      </div>

      <div class="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
        <Field label="Kategori">
          <select
            class={inputClass}
            value={form().category}
            disabled={!props.canEdit}
            onChange={(event) => update("category", event.currentTarget.value)}
          >
            {props.categories.map((category) => (
              <option value={category}>{category}</option>
            ))}
          </select>
        </Field>
        <Field label="Merek">
          <input
            class={inputClass}
            value={form().brand}
            disabled={!props.canEdit}
            onInput={(event) => update("brand", event.currentTarget.value)}
          />
        </Field>
        <Field label="Satuan">
          <select
            class={inputClass}
            value={form().unit}
            disabled={!props.canEdit}
            onChange={(event) => update("unit", event.currentTarget.value)}
          >
            {units.map((unit) => (
              <option value={unit}>{unit}</option>
            ))}
          </select>
        </Field>
      </div>

      <div class="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
        <Field label="HPP (rata-rata)" error={errors().cost}>
          <input
            type="number"
            min="0"
            class={inputClass}
            value={form().cost}
            disabled={!props.canEdit}
            onInput={(event) => update("cost", event.currentTarget.value)}
          />
        </Field>
        <Field label="Harga Jual *" error={errors().price}>
          <input
            type="number"
            min="0"
            class={inputClass}
            value={form().price}
            disabled={!props.canEdit}
            onInput={(event) => update("price", event.currentTarget.value)}
          />
        </Field>
        <Field label="Stok Min. Total" error={errors().minStock}>
          <input
            type="number"
            min="0"
            class={inputClass}
            value={form().minStock}
            disabled={!props.canEdit}
            onInput={(event) => update("minStock", event.currentTarget.value)}
          />
        </Field>
      </div>

      <Show when={props.product}>
        {(product) => (
          <div class="mt-1 rounded-lg border border-line bg-canvas px-3 py-2.5 text-xs">
            <div class="font-bold text-muted">Stok Saat Ini (per lokasi)</div>
            <div class="mt-1.5 flex flex-wrap gap-2">
              <span class="rounded-full bg-slate-100 px-2.5 py-1 text-muted">
                WH-BACK: <b>{product().warehouseStock}</b>
              </span>
              <span class="rounded-full bg-blue-50 px-2.5 py-1 text-royal">
                STORE-FRONT: <b>{product().storeStock}</b>
              </span>
            </div>
            <p class="mt-1.5 text-[11px] text-faint">
              Perubahan stok hanya melalui Pembelian, Mutasi, Opname, atau
              Penjualan.
            </p>
          </div>
        )}
      </Show>
    </Modal>
  );
}
