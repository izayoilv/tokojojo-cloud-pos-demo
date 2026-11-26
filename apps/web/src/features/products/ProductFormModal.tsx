import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Select,
  Switch,
  Textarea,
  useToast,
} from "@tokojojo/ui";
import { Plus, Trash2 } from "lucide-solid";
import { createSignal, For, Show } from "solid-js";

import { repository } from "../../data/repository";
import type { Product, ProductUnit } from "../../data/types";

const categories = [
  "Sembako",
  "Minuman",
  "Makanan Instan",
  "Rumah Tangga",
  "Bumbu Dapur",
  "Susu",
  "Lainnya",
];

type FormState = {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  cost: string;
  price: string;
  minStock: string;
  minStoreStock: string;
  active: boolean;
};

export function ProductFormModal(props: {
  product: Product | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = createSignal(false);
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [form, setForm] = createSignal<FormState>({
    name: props.product?.name ?? "",
    sku: props.product?.sku ?? "",
    barcode: props.product?.barcode ?? "",
    category: props.product?.category ?? categories[0]!,
    brand: props.product?.brand ?? "",
    cost: String(props.product?.cost ?? 0),
    price: String(props.product?.price ?? ""),
    minStock: String(props.product?.minStock ?? 20),
    minStoreStock: String(props.product?.minStoreStock ?? 8),
    active: props.product?.active ?? true,
  });
  const [productUnits, setProductUnits] = createSignal<ProductUnit[]>(
    props.product?.units?.length
      ? props.product.units.map((unit) => ({ ...unit }))
      : [
          {
            id: "PU-NEW-1",
            name: props.product?.unit ?? "Pcs",
            conversionQty: 1,
            sellingPrice: props.product?.price ?? 0,
            barcode: props.product?.barcode ?? "",
          },
        ],
  );

  const update = (key: keyof FormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const updateUnit = (
    index: number,
    key: keyof ProductUnit,
    value: string | number,
  ) => {
    setProductUnits((current) =>
      current.map((unit, unitIndex) =>
        unitIndex === index ? { ...unit, [key]: value } : unit,
      ),
    );
  };

  const save = async () => {
    const next: Record<string, string> = {};
    const values = form();

    if (!values.name.trim()) next.name = "Nama produk wajib diisi.";
    if (!values.sku.trim()) next.sku = "SKU wajib diisi.";
    if (!values.barcode.trim()) next.barcode = "Barcode wajib diisi.";
    if (!(Number(values.price) > 0)) next.price = "Harga jual harus > 0.";
    if (productUnits().some((unit) => unit.conversionQty < 1)) {
      next.units = "Konversi satuan minimal 1.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const saved = await repository.saveProduct({
        id: props.product?.id ?? "",
        sku: values.sku.trim(),
        barcode: values.barcode.trim(),
        name: values.name.trim(),
        category: values.category,
        brand: values.brand.trim() || "Umum",
        unit: productUnits()[0]?.name ?? "Pcs",
        cost: Math.round(Number(values.cost) || 0),
        price: Math.round(Number(values.price) || 0),
        warehouseStock: props.product?.warehouseStock ?? 0,
        storeStock: props.product?.storeStock ?? 0,
        minStock: Math.round(Number(values.minStock) || 0),
        minStoreStock: Math.round(Number(values.minStoreStock) || 0),
        color: props.product?.color ?? "#0F766E",
        units: productUnits(),
        active: values.active,
      });
      toast.notify(`Produk ${saved.name} tersimpan.`);
      props.onSaved();
      props.onClose();
    } catch (caught) {
      toast.notify(
        caught instanceof Error ? caught.message : "Produk gagal disimpan.",
        "danger",
      );
    } finally {
      setSaving(false);
    }
  };

  const readOnly = !props.canEdit;

  return (
    <Modal
      open
      onOpenChange={(open) => !open && props.onClose()}
      title={
        props.product
          ? readOnly
            ? "Detail Produk"
            : "Edit Produk"
          : "Tambah Produk"
      }
      description={
        props.product
          ? `${props.product.name} · ${props.product.sku}`
          : "Tambahkan produk baru ke katalog."
      }
      size="lg"
      footer={
        readOnly ? (
          <Button onClick={props.onClose}>Tutup</Button>
        ) : (
          <>
            <Button onClick={props.onClose}>Batal</Button>
            <Button
              variant="primary"
              loading={saving()}
              onClick={() => void save()}
            >
              Simpan perubahan
            </Button>
          </>
        )
      }
    >
      <div class="space-y-4">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nama produk" required error={errors().name}>
            <Input
              value={form().name}
              disabled={readOnly}
              onInput={(event) => update("name", event.currentTarget.value)}
            />
          </Field>
          <Field label="Kategori">
            <Select
              value={form().category}
              disabled={readOnly}
              onChange={(event) =>
                update("category", event.currentTarget.value)
              }
            >
              <For each={categories}>{(item) => <option>{item}</option>}</For>
            </Select>
          </Field>
          <Field label="SKU" required error={errors().sku}>
            <Input
              class="font-mono"
              value={form().sku}
              disabled={readOnly}
              onInput={(event) => update("sku", event.currentTarget.value)}
            />
          </Field>
          <Field label="Barcode utama" required error={errors().barcode}>
            <Input
              class="font-mono"
              value={form().barcode}
              disabled={readOnly}
              onInput={(event) => update("barcode", event.currentTarget.value)}
            />
          </Field>
          <Field label="Merek">
            <Input
              value={form().brand}
              disabled={readOnly}
              onInput={(event) => update("brand", event.currentTarget.value)}
            />
          </Field>
          <Field label="HPP dasar">
            <Input
              type="number"
              value={form().cost}
              disabled={readOnly}
              onInput={(event) => update("cost", event.currentTarget.value)}
            />
          </Field>
          <Field label="Harga jual dasar" required error={errors().price}>
            <Input
              type="number"
              value={form().price}
              disabled={readOnly}
              onInput={(event) => update("price", event.currentTarget.value)}
            />
          </Field>
          <Field label="Produk aktif">
            <div class="flex h-10 items-center">
              <Switch
                label="Produk aktif"
                checked={form().active}
                onChange={(checked) => update("active", checked)}
                disabled={readOnly}
              />
              <span class="ml-2 text-sm text-ink-secondary">
                {form().active ? "Aktif" : "Diarsipkan"}
              </span>
            </div>
          </Field>
        </div>

        <div class="rounded-[8px] border border-line">
          <div class="flex items-center justify-between border-b border-line px-3 py-2">
            <div>
              <h3 class="text-sm font-bold text-ink">Satuan</h3>
              <p class="text-xs text-ink-muted">
                Satuan dasar konversi 1. Barcode unik per satuan.
              </p>
            </div>
            <Show when={!readOnly}>
              <Button
                size="sm"
                onClick={() =>
                  setProductUnits((current) => [
                    ...current,
                    {
                      id: `PU-NEW-${current.length + 1}`,
                      name: "Pcs",
                      conversionQty: 1,
                      sellingPrice: Number(form().price) || 0,
                      barcode: "",
                    },
                  ])
                }
              >
                <Plus size={14} /> Tambah satuan
              </Button>
            </Show>
          </div>
          <div class="space-y-2 p-3">
            <For each={productUnits()}>
              {(unit, index) => (
                <div class="grid grid-cols-1 gap-2 rounded-[6px] bg-subtle p-2 sm:grid-cols-[1.2fr_80px_110px_1.3fr_36px] sm:items-center">
                  <Input
                    aria-label="Nama satuan"
                    value={unit.name}
                    disabled={readOnly}
                    onInput={(event) =>
                      updateUnit(index(), "name", event.currentTarget.value)
                    }
                  />
                  <Input
                    aria-label="Konversi"
                    type="number"
                    value={unit.conversionQty}
                    disabled={readOnly}
                    onInput={(event) =>
                      updateUnit(
                        index(),
                        "conversionQty",
                        Number(event.currentTarget.value),
                      )
                    }
                  />
                  <Input
                    aria-label="Harga jual satuan"
                    type="number"
                    value={unit.sellingPrice}
                    disabled={readOnly}
                    onInput={(event) =>
                      updateUnit(
                        index(),
                        "sellingPrice",
                        Number(event.currentTarget.value),
                      )
                    }
                  />
                  <Input
                    aria-label="Barcode satuan"
                    class="font-mono"
                    value={unit.barcode}
                    disabled={readOnly}
                    onInput={(event) =>
                      updateUnit(index(), "barcode", event.currentTarget.value)
                    }
                  />
                  <Show when={!readOnly}>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Hapus satuan"
                      onClick={() =>
                        setProductUnits((current) =>
                          current.filter((_, i) => i !== index()),
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </Button>
                  </Show>
                </div>
              )}
            </For>
            <Show when={errors().units}>
              <p class="text-xs font-semibold text-danger">{errors().units}</p>
            </Show>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Ambang stok gudang">
            <Input
              type="number"
              value={form().minStock}
              disabled={readOnly}
              onInput={(event) => update("minStock", event.currentTarget.value)}
            />
          </Field>
          <Field label="Ambang stok area toko">
            <Input
              type="number"
              value={form().minStoreStock}
              disabled={readOnly}
              onInput={(event) =>
                update("minStoreStock", event.currentTarget.value)
              }
            />
          </Field>
        </div>

        <Show when={props.product}>
          <div class="flex flex-wrap items-center gap-2 rounded-[6px] border border-line bg-subtle p-3 text-xs text-ink-secondary">
            <Badge tone="primary">Gudang {props.product?.warehouseStock}</Badge>
            <Badge tone="info">Toko {props.product?.storeStock}</Badge>
            <span class="text-ink-muted">
              Perubahan stok hanya melalui pembelian, mutasi, opname, atau
              penjualan.
            </span>
          </div>
          <Field label="Catatan internal">
            <Textarea placeholder="Opsional" disabled={readOnly} />
          </Field>
        </Show>
      </div>
    </Modal>
  );
}
