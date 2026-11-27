import { createQuery, useQueryClient } from "@tanstack/solid-query";
import {
  Badge,
  Button,
  Drawer,
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
  Td,
  Textarea,
  Th,
  useToast,
} from "@tokojojo/ui";
import { Printer, RefreshCcw, ShieldAlert } from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";

import { useAuth } from "../../app/auth";
import { repository } from "../../data/repository";
import type { Sale } from "../../data/types";
import { saleTotals } from "../../lib/calc";
import { formatDateTime, formatRupiah } from "../../lib/format";
import { buildReceiptHtml, printReceipt } from "./receiptPrint";

const statusLabel: Record<Sale["status"], string> = {
  COMPLETED: "Selesai",
  PARTIAL_RETURN: "Retur sebagian",
  RETURNED: "Dikembalikan",
  VOIDED: "Void",
};

const statusTone = (status: Sale["status"]) =>
  status === "COMPLETED"
    ? "success"
    : status === "PARTIAL_RETURN"
      ? "warning"
      : status === "VOIDED"
        ? "danger"
        : "neutral";

const methodTone = (method: string) =>
  method === "TUNAI"
    ? "success"
    : method === "QRIS"
      ? "info"
      : method === "HUTANG"
        ? "warning"
        : "violet";

export function SalesPage() {
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = createSignal("");
  const [method, setMethod] = createSignal("SEMUA");
  const [status, setStatus] = createSignal("SEMUA");
  const [selected, setSelected] = createSignal<Sale | null>(null);
  const [returnOpen, setReturnOpen] = createSignal(false);
  const [returnQuantities, setReturnQuantities] = createSignal<
    Record<string, number>
  >({});
  const [returnReason, setReturnReason] = createSignal("");
  const [returnError, setReturnError] = createSignal("");
  const [voidOpen, setVoidOpen] = createSignal(false);
  const [voidReason, setVoidReason] = createSignal("");
  const [voidError, setVoidError] = createSignal("");

  const salesQuery = createQuery(() => ({
    queryKey: ["sales"],
    queryFn: () => repository.listSales(),
  }));
  const settingsQuery = createQuery(() => ({
    queryKey: ["settings"],
    queryFn: () => repository.getSettings(),
  }));

  const sales = createMemo(() => {
    const needle = search().trim().toLowerCase();
    return (salesQuery.data ?? []).filter((sale) => {
      const matchesSearch =
        !needle ||
        sale.number.toLowerCase().includes(needle) ||
        sale.cashier.toLowerCase().includes(needle);
      const matchesMethod = method() === "SEMUA" || sale.method === method();
      const matchesStatus = status() === "SEMUA" || sale.status === status();
      return matchesSearch && matchesMethod && matchesStatus;
    });
  });

  const canVoid = () =>
    auth.user()?.role === "OWNER" || auth.user()?.role === "ADMIN";

  const invalidateSales = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sales"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["movements"] }),
      queryClient.invalidateQueries({ queryKey: ["cashFlows"] }),
    ]);
  };

  const reprint = (sale: Sale) => {
    printReceipt(
      buildReceiptHtml(sale, settingsQuery.data?.name ?? "TOKO JOJO"),
    );
  };

  const openReturn = (sale: Sale) => {
    setReturnQuantities(
      Object.fromEntries(
        sale.items
          .filter((item) => item.quantity - item.returned > 0)
          .map((item) => [item.productId, 0]),
      ),
    );
    setReturnReason("");
    setReturnError("");
    setReturnOpen(true);
  };

  const setReturnQuantity = (productId: string, quantity: number) => {
    setReturnQuantities((current) => ({
      ...current,
      [productId]: quantity,
    }));
  };

  const returnPreview = () => {
    const sale = selected();
    if (!sale) return 0;

    return sale.items.reduce((sum, item) => {
      const quantity = returnQuantities()[item.productId] ?? 0;
      return sum + quantity * (item.price - item.discount);
    }, 0);
  };

  const submitReturn = async () => {
    const sale = selected();
    if (!sale) return;

    const returns = sale.items
      .map((item) => ({
        productId: item.productId,
        quantity: returnQuantities()[item.productId] ?? 0,
      }))
      .filter((item) => item.quantity > 0);

    if (returns.length === 0) {
      setReturnError("Pilih minimal satu barang untuk diretur.");
      return;
    }

    try {
      await repository.returnSale(sale.id, returns, returnReason());
      await invalidateSales();
      setReturnOpen(false);
      setSelected(null);
      toast.notify("Retur tersimpan dan stok toko diperbarui.", "warning");
    } catch (caught) {
      setReturnError(
        caught instanceof Error ? caught.message : "Retur gagal disimpan.",
      );
    }
  };

  const openVoid = () => {
    setVoidReason("");
    setVoidError("");
    setVoidOpen(true);
  };

  const submitVoid = async () => {
    const sale = selected();
    if (!sale) return;

    try {
      await repository.voidSale(sale.id, voidReason());
      await invalidateSales();
      setVoidOpen(false);
      setSelected(null);
      toast.notify("Transaksi di-void dan stok dikembalikan.", "danger");
    } catch (caught) {
      setVoidError(
        caught instanceof Error ? caught.message : "Void gagal disimpan.",
      );
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Transaksi dari POS"
        title="Penjualan"
        subtitle="Riwayat transaksi, pembayaran, retur, dan void."
      />

      <Panel>
        <div class="border-b border-line p-4">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_180px]">
            <SearchInput
              aria-label="Cari penjualan"
              placeholder="Cari invoice atau kasir..."
              value={search()}
              onInput={(event) => setSearch(event.currentTarget.value)}
            />
            <Select
              value={method()}
              onChange={(event) => setMethod(event.currentTarget.value)}
              aria-label="Filter metode"
            >
              <option value="SEMUA">Semua metode</option>
              <option value="TUNAI">Tunai</option>
              <option value="QRIS">QRIS</option>
              <option value="DEBIT">Debit</option>
              <option value="HUTANG">Hutang</option>
            </Select>
            <Select
              value={status()}
              onChange={(event) => setStatus(event.currentTarget.value)}
              aria-label="Filter status"
            >
              <option value="SEMUA">Semua status</option>
              <option value="COMPLETED">Selesai</option>
              <option value="PARTIAL_RETURN">Retur sebagian</option>
              <option value="RETURNED">Dikembalikan</option>
              <option value="VOIDED">Void</option>
            </Select>
          </div>
        </div>

        <Show
          when={!salesQuery.isError}
          fallback={
            <ErrorState
              message="Penjualan tidak dapat dimuat."
              onRetry={() => void salesQuery.refetch()}
            />
          }
        >
          <Show
            when={!salesQuery.isPending}
            fallback={<TableSkeleton rows={8} cols={6} />}
          >
            <Show
              when={sales().length > 0}
              fallback={
                <EmptyState
                  title="Belum ada transaksi"
                  description="Transaksi POS yang tersinkron akan muncul di sini."
                />
              }
            >
              <TableWrap>
                <Table class="min-w-[960px]">
                  <thead>
                    <tr>
                      <Th>Invoice</Th>
                      <Th>Waktu</Th>
                      <Th>Kasir</Th>
                      <Th>Metode</Th>
                      <Th align="right">Total</Th>
                      <Th>Status</Th>
                      <Th align="center">Aksi</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={sales()}>
                      {(sale) => (
                        <tr class="hover:bg-hover">
                          <Td class="font-mono text-[11px]">{sale.number}</Td>
                          <Td>{formatDateTime(sale.time)}</Td>
                          <Td>{sale.cashier}</Td>
                          <Td>
                            <Badge tone={methodTone(sale.method)}>
                              {sale.method}
                            </Badge>
                          </Td>
                          <Td align="right">
                            <b>{formatRupiah(saleTotals(sale).grandTotal)}</b>
                          </Td>
                          <Td>
                            <Badge tone={statusTone(sale.status)}>
                              {statusLabel[sale.status]}
                            </Badge>
                          </Td>
                          <Td align="center">
                            <Button size="sm" onClick={() => setSelected(sale)}>
                              Detail
                            </Button>
                          </Td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </Table>
              </TableWrap>
            </Show>
          </Show>
        </Show>
      </Panel>

      <Drawer
        open={selected() !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={`Invoice ${selected()?.number ?? ""}`}
        description={`${selected()?.cashier ?? ""} · ${selected() ? formatDateTime(selected()!.time) : ""}`}
        footer={
          <>
            <Button
              size="sm"
              onClick={() => {
                const sale = selected();
                if (sale) reprint(sale);
              }}
            >
              <Printer size={14} /> Cetak ulang
            </Button>
            <Show
              when={
                selected()?.status === "COMPLETED" ||
                selected()?.status === "PARTIAL_RETURN"
              }
            >
              <Button
                size="sm"
                onClick={() => {
                  const sale = selected();
                  if (sale) openReturn(sale);
                }}
              >
                <RefreshCcw size={14} /> Retur
              </Button>
            </Show>
            <Show
              when={
                canVoid() &&
                selected()?.status !== "VOIDED" &&
                selected()?.status !== "RETURNED"
              }
            >
              <Button size="sm" variant="soft-danger" onClick={openVoid}>
                <ShieldAlert size={14} /> Void
              </Button>
            </Show>
          </>
        }
      >
        <Show when={selected()}>
          {(sale) => (
            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div class="text-xs text-ink-muted">Metode</div>
                  <b>{sale().method}</b>
                </div>
                <div>
                  <div class="text-xs text-ink-muted">Terminal</div>
                  <b>{sale().terminal}</b>
                </div>
                <div>
                  <div class="text-xs text-ink-muted">Status</div>
                  <b>{sale().status}</b>
                </div>
                <div>
                  <div class="text-xs text-ink-muted">Diterima</div>
                  <b>{formatRupiah(sale().received)}</b>
                </div>
              </div>

              <div class="overflow-hidden rounded-[8px] border border-line">
                <TableWrap>
                  <Table class="min-w-[420px]">
                    <thead>
                      <tr>
                        <Th>Item</Th>
                        <Th align="right">Qty</Th>
                        <Th align="right">Harga</Th>
                        <Th align="right">Total</Th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={sale().items}>
                        {(item) => (
                          <tr>
                            <Td>
                              <b class="text-ink">{item.name}</b>
                              <div class="text-xs text-ink-muted">
                                per {item.unit}
                              </div>
                            </Td>
                            <Td align="right">{item.quantity}</Td>
                            <Td align="right">{formatRupiah(item.price)}</Td>
                            <Td align="right">
                              {formatRupiah(
                                (item.quantity - item.returned) * item.price,
                              )}
                            </Td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </Table>
                </TableWrap>
              </div>

              <div class="ml-auto max-w-xs space-y-1.5 text-sm">
                <div class="flex justify-between">
                  <span class="text-ink-muted">Subtotal</span>
                  <span>{formatRupiah(saleTotals(sale()).subtotal)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-ink-muted">Diskon</span>
                  <span>-{formatRupiah(saleTotals(sale()).discount)}</span>
                </div>
                <div class="flex justify-between border-t border-line pt-1.5 font-bold">
                  <span>Total</span>
                  <span>{formatRupiah(saleTotals(sale()).grandTotal)}</span>
                </div>
              </div>
            </div>
          )}
        </Show>
      </Drawer>

      <Show when={returnOpen() && selected()}>
        {(sale) => (
          <Modal
            open
            onOpenChange={(open) => {
              setReturnOpen(open);
              if (!open) setReturnError("");
            }}
            title="Retur penjualan"
            description={`${sale().number} · ${sale().cashier}`}
            footer={
              <>
                <Button onClick={() => setReturnOpen(false)}>Batal</Button>
                <Button variant="primary" onClick={() => void submitReturn()}>
                  Simpan retur
                </Button>
              </>
            }
          >
            <div class="space-y-3">
              <div class="space-y-2">
                <For each={sale().items}>
                  {(item) => {
                    const remaining = () => item.quantity - item.returned;
                    return (
                      <Show when={remaining() > 0}>
                        <div class="grid grid-cols-1 items-center gap-2 rounded-[6px] border border-line p-2 sm:grid-cols-[1fr_90px]">
                          <div>
                            <b class="text-sm text-ink">{item.name}</b>
                            <div class="text-xs text-ink-muted">
                              Sisa {remaining()} {item.unit} ·{" "}
                              {formatRupiah(item.price - item.discount)}/unit
                            </div>
                          </div>
                          <Input
                            aria-label={`Jumlah retur ${item.name}`}
                            type="number"
                            min="0"
                            max={remaining()}
                            value={returnQuantities()[item.productId] ?? 0}
                            onInput={(event) =>
                              setReturnQuantity(
                                item.productId,
                                Number(event.currentTarget.value),
                              )
                            }
                          />
                        </div>
                      </Show>
                    );
                  }}
                </For>
              </div>
              <Field label="Alasan retur" required>
                <Textarea
                  value={returnReason()}
                  onInput={(event) =>
                    setReturnReason(event.currentTarget.value)
                  }
                  placeholder="Contoh: barang rusak atau salah kirim."
                />
              </Field>
              <div class="flex justify-between border-t border-line pt-2 text-sm">
                <span class="text-ink-muted">Nilai retur</span>
                <b>{formatRupiah(returnPreview())}</b>
              </div>
              <Show when={returnError()}>
                <p class="text-xs font-semibold text-danger">{returnError()}</p>
              </Show>
            </div>
          </Modal>
        )}
      </Show>

      <Show when={voidOpen() && selected()}>
        {(sale) => (
          <Modal
            open
            onOpenChange={(open) => {
              setVoidOpen(open);
              if (!open) setVoidError("");
            }}
            title="Void transaksi?"
            description={`${sale().number} · ${formatRupiah(saleTotals(sale()).grandTotal)}`}
            footer={
              <>
                <Button onClick={() => setVoidOpen(false)}>Batal</Button>
                <Button variant="soft-danger" onClick={() => void submitVoid()}>
                  Void transaksi
                </Button>
              </>
            }
          >
            <div class="space-y-3">
              <p class="text-sm text-ink-secondary">
                Void membatalkan transaksi, mengembalikan stok, dan mencatat
                pengeluaran. Tindakan ini masuk ke audit.
              </p>
              <Field label="Alasan void" required>
                <Textarea
                  value={voidReason()}
                  onInput={(event) => setVoidReason(event.currentTarget.value)}
                  placeholder="Contoh: salah input metode pembayaran."
                />
              </Field>
              <Show when={voidError()}>
                <p class="text-xs font-semibold text-danger">{voidError()}</p>
              </Show>
            </div>
          </Modal>
        )}
      </Show>

      <div id="print-area" />
    </>
  );
}
