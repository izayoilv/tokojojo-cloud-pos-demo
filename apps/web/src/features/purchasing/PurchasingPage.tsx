import { createQuery, useQueryClient } from "@tanstack/solid-query";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Panel,
  SearchInput,
  Select,
  Table,
  TableSkeleton,
  TableWrap,
  Tabs,
  Td,
  Th,
  useToast,
} from "@tokojojo/ui";
import { Plus, Trash2 } from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";

import { repository } from "../../data/repository";
import type { PaymentMethod, Purchase, PurchaseItem } from "../../data/types";
import { formatDate, formatRupiah } from "../../lib/format";
import {
  type PurchaseDraft,
  validatePurchaseDraft,
} from "./purchaseValidation";

const emptyLine = (): PurchaseItem => ({
  productId: "",
  productName: "",
  quantity: 1,
  unitCost: 0,
});

const emptyDraft = (): PurchaseDraft => ({
  supplierName: "",
  invoice: "",
  due: "",
  items: [emptyLine()],
});

type PurchasingTab = "PEMBELIAN" | "SUPPLIER" | "HUTANG";

export function PurchasingPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = createSignal<PurchasingTab>("PEMBELIAN");
  const [search, setSearch] = createSignal("");
  const [modal, setModal] = createSignal<
    "purchase" | "supplier" | "payment" | null
  >(null);
  const [form, setForm] = createSignal({
    supplier: "",
    invoice: "",
    total: "",
    due: "",
    name: "",
    phone: "",
  });
  const [purchaseDraft, setPurchaseDraft] =
    createSignal<PurchaseDraft>(emptyDraft());
  const [purchaseError, setPurchaseError] = createSignal("");
  const [paymentTarget, setPaymentTarget] = createSignal<Purchase | null>(null);
  const [paymentAmount, setPaymentAmount] = createSignal("");
  const [paymentMethod, setPaymentMethod] =
    createSignal<PaymentMethod>("TUNAI");
  const [paymentError, setPaymentError] = createSignal("");
  const [cancelTarget, setCancelTarget] = createSignal<Purchase | null>(null);
  const [saving, setSaving] = createSignal(false);

  const purchasesQuery = createQuery(() => ({
    queryKey: ["purchases"],
    queryFn: () => repository.listPurchases(),
  }));
  const suppliersQuery = createQuery(() => ({
    queryKey: ["suppliers"],
    queryFn: () => repository.listSuppliers(),
  }));
  const payablesQuery = createQuery(() => ({
    queryKey: ["payables"],
    queryFn: () => repository.listPayables(),
  }));
  const productsQuery = createQuery(() => ({
    queryKey: ["products"],
    queryFn: () => repository.listProducts(),
  }));

  const loading = () =>
    purchasesQuery.isPending ||
    suppliersQuery.isPending ||
    payablesQuery.isPending ||
    productsQuery.isPending;
  const failed = () =>
    purchasesQuery.isError ||
    suppliersQuery.isError ||
    payablesQuery.isError ||
    productsQuery.isError;

  const purchases = createMemo(() => {
    const needle = search().trim().toLowerCase();
    return (purchasesQuery.data ?? []).filter(
      (purchase) =>
        !needle ||
        purchase.number.toLowerCase().includes(needle) ||
        purchase.supplierName.toLowerCase().includes(needle) ||
        purchase.invoice.toLowerCase().includes(needle),
    );
  });

  const suppliers = createMemo(() => {
    const needle = search().trim().toLowerCase();
    return (suppliersQuery.data ?? []).filter(
      (supplier) =>
        !needle ||
        supplier.name.toLowerCase().includes(needle) ||
        supplier.code.toLowerCase().includes(needle),
    );
  });

  const payables = createMemo(() => {
    const needle = search().trim().toLowerCase();
    return (payablesQuery.data ?? []).filter(
      (payable) =>
        !needle ||
        payable.supplierName.toLowerCase().includes(needle) ||
        payable.invoice.toLowerCase().includes(needle),
    );
  });

  const saveSupplier = async () => {
    if (!form().name.trim()) {
      toast.notify("Nama supplier wajib diisi.", "danger");
      return;
    }
    await repository.saveSupplier({
      id: "",
      code: `SUP-${Date.now().toString().slice(-4)}`,
      name: form().name.trim(),
      contact: "",
      phone: form().phone.trim(),
      address: "",
      termDays: 14,
      payable: 0,
      active: true,
    });
    await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    setModal(null);
    setForm({
      supplier: "",
      invoice: "",
      total: "",
      due: "",
      name: "",
      phone: "",
    });
    toast.notify("Supplier tersimpan.");
  };

  const invalidatePurchasing = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["purchases"] }),
      queryClient.invalidateQueries({ queryKey: ["payables"] }),
      queryClient.invalidateQueries({ queryKey: ["movements"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["cashFlows"] }),
    ]);
  };

  const openPurchase = () => {
    setPurchaseDraft(emptyDraft());
    setPurchaseError("");
    setModal("purchase");
  };

  const updateLine = (index: number, patch: Partial<PurchaseItem>) => {
    setPurchaseDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  };

  const addLine = () => {
    setPurchaseDraft((current) => ({
      ...current,
      items: [...current.items, emptyLine()],
    }));
  };

  const removeLine = (index: number) => {
    setPurchaseDraft((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const purchaseTotal = () =>
    purchaseDraft().items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0,
    );

  const savePurchase = async () => {
    if (saving()) return;
    const error = validatePurchaseDraft(purchaseDraft());

    if (error) {
      setPurchaseError(error);
      return;
    }

    setSaving(true);
    try {
      await repository.createPurchase(purchaseDraft());
      await invalidatePurchasing();
      setModal(null);
      toast.notify("Pembelian dibuat dan stok gudang bertambah.");
    } catch (caught) {
      setPurchaseError(
        caught instanceof Error ? caught.message : "Pembelian gagal disimpan.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openPayment = (purchase: Purchase) => {
    setPaymentTarget(purchase);
    setPaymentAmount(String(purchase.total - purchase.paid));
    setPaymentMethod("TUNAI");
    setPaymentError("");
    setModal("payment");
  };

  const savePayment = async () => {
    const target = paymentTarget();

    if (!target || saving()) return;

    setSaving(true);
    try {
      await repository.payPurchase(
        target.id,
        Number(paymentAmount()),
        paymentMethod(),
      );
      await invalidatePurchasing();
      setModal(null);
      toast.notify("Pembayaran tersimpan di arus kas.");
    } catch (caught) {
      setPaymentError(
        caught instanceof Error ? caught.message : "Pembayaran gagal disimpan.",
      );
    } finally {
      setSaving(false);
    }
  };

  const cancelPurchase = async () => {
    const target = cancelTarget();

    if (!target || saving()) return;

    setSaving(true);
    try {
      await repository.cancelPurchase(target.id);
      await invalidatePurchasing();
      setCancelTarget(null);
      toast.notify(
        target.status === "RECEIVED"
          ? "Pembelian dibatalkan dan stok dikembalikan."
          : "Pembelian dibatalkan.",
        "warning",
      );
    } catch (caught) {
      toast.notify(
        caught instanceof Error
          ? caught.message
          : "Pembelian gagal dibatalkan.",
        "danger",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Pembelian, supplier, dan hutang"
        title="Pembelian"
        subtitle="Penerimaan barang dari supplier dan kewajiban pembayaran."
        actions={
          <Button size="sm" variant="primary" onClick={openPurchase}>
            <Plus size={14} /> Buat Pembelian
          </Button>
        }
      />

      <Tabs
        value={tab()}
        onChange={setTab}
        items={[
          { value: "PEMBELIAN", label: "Pembelian", count: purchases().length },
          { value: "SUPPLIER", label: "Supplier", count: suppliers().length },
          { value: "HUTANG", label: "Hutang", count: payables().length },
        ]}
        label="Tampilan pembelian"
        id="purchasing-tabs"
        panelId="purchasing-panel"
        class="mb-3"
      />

      <div
        role="tabpanel"
        id="purchasing-panel"
        aria-labelledby={`purchasing-tabs-tab-${tab()}`}
      >
        <Show
          when={!failed()}
          fallback={
            <Panel>
              <ErrorState
                message="Data pembelian tidak dapat dimuat."
                onRetry={() => {
                  void purchasesQuery.refetch();
                  void suppliersQuery.refetch();
                  void payablesQuery.refetch();
                }}
              />
            </Panel>
          }
        >
          <Panel>
            <div class="border-b border-line p-4">
              <SearchInput
                aria-label="Cari pembelian"
                class="max-w-md"
                placeholder="Cari nomor, supplier, atau faktur..."
                value={search()}
                onInput={(event) => setSearch(event.currentTarget.value)}
              />
            </div>
            <Show
              when={!loading()}
              fallback={<TableSkeleton rows={7} cols={6} />}
            >
              <Show when={tab() === "PEMBELIAN"}>
                <Show
                  when={purchases().length > 0}
                  fallback={
                    <EmptyState
                      title="Belum ada pembelian"
                      description="Buat pembelian pertama dari supplier."
                    />
                  }
                >
                  <TableWrap>
                    <Table class="min-w-[980px]">
                      <thead>
                        <tr>
                          <Th>No. Dokumen</Th>
                          <Th>Supplier</Th>
                          <Th>Tanggal</Th>
                          <Th align="right">Total</Th>
                          <Th align="right">Terbayar</Th>
                          <Th align="right">Sisa</Th>
                          <Th>Status</Th>
                          <Th align="center">Aksi</Th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={purchases()}>
                          {(purchase) => (
                            <tr class="hover:bg-hover">
                              <Td>
                                <div class="font-mono text-[11px]">
                                  {purchase.number}
                                </div>
                                <div class="text-xs text-ink-muted">
                                  {purchase.status === "ORDERED"
                                    ? "Purchase order"
                                    : "Pembelian langsung"}
                                </div>
                              </Td>
                              <Td>
                                <b class="text-ink">{purchase.supplierName}</b>
                                <div class="text-xs text-ink-muted">
                                  Faktur {purchase.invoice}
                                </div>
                              </Td>
                              <Td>{formatDate(purchase.date)}</Td>
                              <Td align="right">
                                <b>{formatRupiah(purchase.total)}</b>
                              </Td>
                              <Td align="right">
                                {formatRupiah(purchase.paid)}
                              </Td>
                              <Td
                                align="right"
                                class={
                                  purchase.total - purchase.paid > 0
                                    ? "font-bold text-danger"
                                    : "text-success"
                                }
                              >
                                {formatRupiah(purchase.total - purchase.paid)}
                              </Td>
                              <Td>
                                <Badge
                                  tone={
                                    purchase.status === "RECEIVED"
                                      ? "success"
                                      : purchase.status === "ORDERED"
                                        ? "info"
                                        : "neutral"
                                  }
                                >
                                  {purchase.status}
                                </Badge>
                              </Td>
                              <Td align="center">
                                <div class="flex justify-center gap-1">
                                  <Show
                                    when={
                                      purchase.status !== "CANCELLED" &&
                                      purchase.total - purchase.paid > 0
                                    }
                                    fallback={
                                      <span class="self-center text-xs text-success">
                                        Lunas
                                      </span>
                                    }
                                  >
                                    <Button
                                      size="sm"
                                      aria-label={`Bayar ${purchase.invoice}`}
                                      onClick={() => openPayment(purchase)}
                                    >
                                      Bayar
                                    </Button>
                                  </Show>
                                  <Show
                                    when={
                                      purchase.status !== "CANCELLED" &&
                                      purchase.paid === 0
                                    }
                                  >
                                    <Button
                                      size="sm"
                                      variant="soft-danger"
                                      aria-label={`Batalkan ${purchase.invoice}`}
                                      onClick={() => setCancelTarget(purchase)}
                                    >
                                      Batalkan
                                    </Button>
                                  </Show>
                                </div>
                              </Td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </Table>
                  </TableWrap>
                </Show>
              </Show>

              <Show when={tab() === "SUPPLIER"}>
                <div class="border-b border-line px-4 py-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setModal("supplier")}
                  >
                    <Plus size={14} /> Tambah Supplier
                  </Button>
                </div>
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Kode</Th>
                        <Th>Supplier</Th>
                        <Th>Kontak</Th>
                        <Th align="center">Term</Th>
                        <Th align="right">Hutang</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={suppliers()}>
                        {(supplier) => (
                          <tr class="hover:bg-hover">
                            <Td class="font-mono text-[11px]">
                              {supplier.code}
                            </Td>
                            <Td>
                              <b class="text-ink">{supplier.name}</b>
                              <div class="text-xs text-ink-muted">
                                {supplier.address}
                              </div>
                            </Td>
                            <Td>
                              {supplier.contact}
                              <div class="text-xs text-ink-muted">
                                {supplier.phone}
                              </div>
                            </Td>
                            <Td align="center">{supplier.termDays} hari</Td>
                            <Td align="right">
                              {formatRupiah(supplier.payable)}
                            </Td>
                            <Td>
                              <Badge
                                tone={supplier.active ? "success" : "neutral"}
                              >
                                {supplier.active ? "Aktif" : "Nonaktif"}
                              </Badge>
                            </Td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </Table>
                </TableWrap>
              </Show>

              <Show when={tab() === "HUTANG"}>
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Supplier</Th>
                        <Th>Faktur</Th>
                        <Th>Jatuh tempo</Th>
                        <Th align="right">Total</Th>
                        <Th align="right">Terbayar</Th>
                        <Th align="right">Sisa</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={payables()}>
                        {(payable) => (
                          <tr class="hover:bg-hover">
                            <Td>
                              <b class="text-ink">{payable.supplierName}</b>
                            </Td>
                            <Td class="font-mono text-[11px]">
                              {payable.invoice}
                            </Td>
                            <Td>{formatDate(payable.due)}</Td>
                            <Td align="right">{formatRupiah(payable.total)}</Td>
                            <Td align="right">{formatRupiah(payable.paid)}</Td>
                            <Td align="right" class="font-bold text-danger">
                              {formatRupiah(payable.total - payable.paid)}
                            </Td>
                            <Td>
                              <Badge
                                tone={
                                  payable.status === "PAID"
                                    ? "success"
                                    : payable.status === "PARTIAL"
                                      ? "warning"
                                      : "danger"
                                }
                              >
                                {payable.status === "PAID"
                                  ? "Lunas"
                                  : payable.status === "PARTIAL"
                                    ? "Cicilan"
                                    : "Belum bayar"}
                              </Badge>
                            </Td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </Table>
                </TableWrap>
              </Show>
            </Show>
          </Panel>
        </Show>

        <Show when={modal() === "purchase"}>
          <Modal
            open
            onOpenChange={(open) => !open && setModal(null)}
            title="Buat Pembelian"
            description="Penerimaan barang akan menambah stok gudang."
            footer={
              <>
                <Button onClick={() => setModal(null)}>Batal</Button>
                <Button
                  variant="primary"
                  loading={saving()}
                  onClick={() => void savePurchase()}
                >
                  Simpan pembelian
                </Button>
              </>
            }
          >
            <div class="space-y-3">
              <Field label="Supplier" required>
                <Select
                  value={purchaseDraft().supplierName}
                  onChange={(event) =>
                    setPurchaseDraft((current) => ({
                      ...current,
                      supplierName: event.currentTarget.value,
                    }))
                  }
                >
                  <option value="">Pilih supplier...</option>
                  <For each={suppliersQuery.data ?? []}>
                    {(supplier) => (
                      <option value={supplier.name}>{supplier.name}</option>
                    )}
                  </For>
                </Select>
              </Field>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="No. faktur supplier" required>
                  <Input
                    placeholder="INV-..."
                    value={purchaseDraft().invoice}
                    onInput={(event) =>
                      setPurchaseDraft((current) => ({
                        ...current,
                        invoice: event.currentTarget.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Jatuh tempo" required>
                  <Input
                    type="date"
                    value={purchaseDraft().due}
                    onInput={(event) =>
                      setPurchaseDraft((current) => ({
                        ...current,
                        due: event.currentTarget.value,
                      }))
                    }
                  />
                </Field>
              </div>
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-ink-secondary">
                    Barang
                  </span>
                  <Button size="sm" variant="secondary" onClick={addLine}>
                    <Plus size={13} /> Tambah barang
                  </Button>
                </div>
                <For each={purchaseDraft().items}>
                  {(item, index) => (
                    <div class="grid grid-cols-1 gap-2 rounded-[6px] border border-line p-2 sm:grid-cols-[1.6fr_80px_120px_36px]">
                      <Select
                        aria-label="Produk"
                        value={item.productId}
                        onChange={(event) => {
                          const product = (productsQuery.data ?? []).find(
                            (entry) => entry.id === event.currentTarget.value,
                          );
                          updateLine(index(), {
                            productId: event.currentTarget.value,
                            productName: product?.name ?? "",
                            unitCost: product?.cost ?? item.unitCost,
                          });
                        }}
                      >
                        <option value="">Pilih produk...</option>
                        <For each={productsQuery.data ?? []}>
                          {(product) => (
                            <option value={product.id}>{product.name}</option>
                          )}
                        </For>
                      </Select>
                      <Input
                        aria-label="Jumlah"
                        type="number"
                        min="1"
                        value={item.quantity}
                        onInput={(event) =>
                          updateLine(index(), {
                            quantity: Number(event.currentTarget.value),
                          })
                        }
                      />
                      <Input
                        aria-label="Harga satuan"
                        type="number"
                        min="0"
                        value={item.unitCost}
                        onInput={(event) =>
                          updateLine(index(), {
                            unitCost: Number(event.currentTarget.value),
                          })
                        }
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Hapus barang"
                        disabled={purchaseDraft().items.length === 1}
                        onClick={() => removeLine(index())}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )}
                </For>
              </div>
              <div class="flex items-center justify-between border-t border-line pt-3 text-sm">
                <span class="text-ink-muted">Total pembelian</span>
                <b>{formatRupiah(purchaseTotal())}</b>
              </div>
              <Show when={purchaseError()}>
                <p role="alert" class="text-xs font-semibold text-danger">
                  {purchaseError()}
                </p>
              </Show>
            </div>
          </Modal>
        </Show>

        <Show when={modal() === "payment"}>
          <Modal
            open
            onOpenChange={(open) => !open && setModal(null)}
            title="Bayar Hutang"
            description={
              paymentTarget()
                ? `${paymentTarget()!.supplierName} · ${paymentTarget()!.invoice}`
                : "Pembayaran ini akan tercatat di arus kas."
            }
            footer={
              <>
                <Button onClick={() => setModal(null)}>Batal</Button>
                <Button
                  variant="success"
                  loading={saving()}
                  onClick={() => void savePayment()}
                >
                  Simpan pembayaran
                </Button>
              </>
            }
          >
            <div class="space-y-3">
              <Field label="Nominal" required>
                <Input
                  type="number"
                  min="1"
                  value={paymentAmount()}
                  onInput={(event) =>
                    setPaymentAmount(event.currentTarget.value)
                  }
                />
              </Field>
              <Field label="Metode">
                <Select
                  value={paymentMethod()}
                  onChange={(event) =>
                    setPaymentMethod(event.currentTarget.value as PaymentMethod)
                  }
                >
                  <option value="TUNAI">Tunai</option>
                  <option value="TRANSFER">Transfer</option>
                  <option value="QRIS">QRIS</option>
                  <option value="DEBIT">Debit</option>
                </Select>
              </Field>
              <Show when={paymentError()}>
                <p role="alert" class="text-xs font-semibold text-danger">
                  {paymentError()}
                </p>
              </Show>
            </div>
          </Modal>
        </Show>

        <Show when={cancelTarget()}>
          {(target) => (
            <Modal
              open
              onOpenChange={(open) => !open && setCancelTarget(null)}
              title="Batalkan pembelian?"
              description={`${target().supplierName} · ${target().invoice}`}
              footer={
                <>
                  <Button onClick={() => setCancelTarget(null)}>Tidak</Button>
                  <Button
                    variant="soft-danger"
                    loading={saving()}
                    onClick={() => void cancelPurchase()}
                  >
                    Batalkan
                  </Button>
                </>
              }
            >
              <p class="text-sm text-ink-secondary">
                Stok yang sudah diterima akan dikembalikan. Pembelian yang sudah
                dibayar tidak dapat dibatalkan.
              </p>
            </Modal>
          )}
        </Show>

        <Show when={modal() === "supplier"}>
          <Modal
            open
            onOpenChange={(open) => !open && setModal(null)}
            title="Tambah Supplier"
            footer={
              <>
                <Button onClick={() => setModal(null)}>Batal</Button>
                <Button variant="primary" onClick={() => void saveSupplier()}>
                  Simpan
                </Button>
              </>
            }
          >
            <div class="space-y-3">
              <Field label="Nama supplier" required>
                <Input
                  value={form().name}
                  onInput={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.currentTarget.value,
                    }))
                  }
                />
              </Field>
              <Field label="Telepon">
                <Input
                  value={form().phone}
                  onInput={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.currentTarget.value,
                    }))
                  }
                />
              </Field>
            </div>
          </Modal>
        </Show>
      </div>
    </>
  );
}
