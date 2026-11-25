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
import { Plus } from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";

import { repository } from "../../data/repository";
import { formatDate, formatRupiah } from "../../lib/format";

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

  const loading = () =>
    purchasesQuery.isPending ||
    suppliersQuery.isPending ||
    payablesQuery.isPending;
  const failed = () =>
    purchasesQuery.isError || suppliersQuery.isError || payablesQuery.isError;

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

  return (
    <>
      <PageHeader
        eyebrow="Pembelian, supplier, dan hutang"
        title="Pembelian"
        subtitle="Penerimaan barang dari supplier dan kewajiban pembayaran."
        actions={
          <Button
            size="sm"
            variant="primary"
            onClick={() => setModal("purchase")}
          >
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
        class="mb-3"
      />

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
                            <Td align="right">{formatRupiah(purchase.paid)}</Td>
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
                              <Show
                                when={purchase.total - purchase.paid > 0}
                                fallback={
                                  <span class="text-xs text-success">
                                    Lunas
                                  </span>
                                }
                              >
                                <Button
                                  size="sm"
                                  onClick={() => setModal("payment")}
                                >
                                  Bayar
                                </Button>
                              </Show>
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
                          <Td class="font-mono text-[11px]">{supplier.code}</Td>
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
                                payable.status === "PARTIAL"
                                  ? "warning"
                                  : "danger"
                              }
                            >
                              {payable.status === "PARTIAL"
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
                onClick={() => {
                  setModal(null);
                  toast.notify("Pembelian contoh dibuat.");
                }}
              >
                Simpan pembelian
              </Button>
            </>
          }
        >
          <div class="space-y-3">
            <Field label="Supplier" required>
              <Select>
                <option>Pilih supplier...</option>
                <For each={suppliers()}>
                  {(supplier) => <option>{supplier.name}</option>}
                </For>
              </Select>
            </Field>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="No. faktur supplier">
                <Input placeholder="INV-..." />
              </Field>
              <Field label="Jatuh tempo">
                <Input type="date" />
              </Field>
            </div>
            <Field label="Total pembelian">
              <Input type="number" placeholder="0" />
            </Field>
          </div>
        </Modal>
      </Show>

      <Show when={modal() === "payment"}>
        <Modal
          open
          onOpenChange={(open) => !open && setModal(null)}
          title="Bayar Hutang"
          description="Pembayaran ini akan tercatat di arus kas."
          footer={
            <>
              <Button onClick={() => setModal(null)}>Batal</Button>
              <Button
                variant="success"
                onClick={() => {
                  setModal(null);
                  toast.notify("Pembayaran contoh tersimpan.");
                }}
              >
                Simpan pembayaran
              </Button>
            </>
          }
        >
          <div class="space-y-3">
            <Field label="Nominal">
              <Input type="number" placeholder="0" />
            </Field>
            <Field label="Metode">
              <Select>
                <option>Tunai</option>
                <option>Transfer</option>
              </Select>
            </Field>
          </div>
        </Modal>
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
    </>
  );
}
