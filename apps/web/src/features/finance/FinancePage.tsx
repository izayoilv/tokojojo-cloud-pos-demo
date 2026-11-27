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
import type { PaymentMethod } from "../../data/types";
import {
  formatCompactRupiah,
  formatDate,
  formatRupiah,
} from "../../lib/format";

type FinanceTab = "ARUS" | "PIUTANG" | "HUTANG";

export function FinancePage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = createSignal<FinanceTab>("ARUS");
  const [modalOpen, setModalOpen] = createSignal(false);
  const [type, setType] = createSignal<"IN" | "OUT">("IN");
  const [category, setCategory] = createSignal("Penjualan");
  const [method, setMethod] = createSignal<PaymentMethod>("TUNAI");
  const [amount, setAmount] = createSignal("");
  const [reference, setReference] = createSignal("");

  const flowsQuery = createQuery(() => ({
    queryKey: ["cashFlows"],
    queryFn: () => repository.listCashFlows(),
  }));
  const receivablesQuery = createQuery(() => ({
    queryKey: ["receivables"],
    queryFn: () => repository.listReceivables(),
  }));
  const payablesQuery = createQuery(() => ({
    queryKey: ["payables"],
    queryFn: () => repository.listPayables(),
  }));

  const flows = () => flowsQuery.data ?? [];
  const loading = () =>
    flowsQuery.isPending ||
    receivablesQuery.isPending ||
    payablesQuery.isPending;
  const failed = () =>
    flowsQuery.isError || receivablesQuery.isError || payablesQuery.isError;
  const outstandingPayables = createMemo(() =>
    (payablesQuery.data ?? []).filter((item) => item.total - item.paid > 0),
  );

  const totals = createMemo(() => {
    const income = flows()
      .filter((flow) => flow.type === "IN")
      .reduce((sum, flow) => sum + flow.amount, 0);
    const expense = flows()
      .filter((flow) => flow.type === "OUT")
      .reduce((sum, flow) => sum + flow.amount, 0);
    return { income, expense, net: income - expense };
  });

  const saveCash = async () => {
    if (!(Number(amount()) > 0)) {
      toast.notify("Nominal harus lebih dari nol.", "danger");
      return;
    }
    await repository.createCashFlow({
      time: new Date().toISOString(),
      type: type(),
      category: category(),
      method: method(),
      amount: Number(amount()),
      reference: reference() || "MANUAL",
    });
    await queryClient.invalidateQueries({ queryKey: ["cashFlows"] });
    setModalOpen(false);
    setAmount("");
    setReference("");
    toast.notify("Arus kas tersimpan.");
  };

  return (
    <>
      <PageHeader
        eyebrow="Kas, piutang, dan hutang"
        title="Keuangan"
        subtitle="Arus kas otomatis dari transaksi dan entri manual operator."
        actions={
          <Button
            size="sm"
            variant="primary"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={14} /> Catat Kas
          </Button>
        }
      />

      <div class="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Panel class="p-4">
          <div class="text-xs font-bold text-ink-muted uppercase">
            Kas masuk
          </div>
          <div class="mt-1 text-xl font-extrabold text-success">
            {formatCompactRupiah(totals().income)}
          </div>
        </Panel>
        <Panel class="p-4">
          <div class="text-xs font-bold text-ink-muted uppercase">
            Kas keluar
          </div>
          <div class="mt-1 text-xl font-extrabold text-danger">
            {formatCompactRupiah(totals().expense)}
          </div>
        </Panel>
        <Panel class="p-4">
          <div class="text-xs font-bold text-ink-muted uppercase">
            Saldo bersih
          </div>
          <div class="mt-1 text-xl font-extrabold text-ink">
            {formatCompactRupiah(totals().net)}
          </div>
        </Panel>
      </div>

      <Tabs
        value={tab()}
        onChange={setTab}
        items={[
          { value: "ARUS", label: "Arus Kas", count: flows().length },
          {
            value: "PIUTANG",
            label: "Piutang",
            count: receivablesQuery.data?.length ?? 0,
          },
          {
            value: "HUTANG",
            label: "Hutang",
            count: outstandingPayables().length,
          },
        ]}
        label="Tampilan keuangan"
        id="finance-tabs"
        panelId="finance-panel"
        class="mb-3"
      />

      <div
        role="tabpanel"
        id="finance-panel"
        aria-labelledby={`finance-tabs-tab-${tab()}`}
      >
        <Show
          when={!failed()}
          fallback={
            <Panel>
              <ErrorState
                message="Data keuangan tidak dapat dimuat."
                onRetry={() => {
                  void flowsQuery.refetch();
                  void receivablesQuery.refetch();
                  void payablesQuery.refetch();
                }}
              />
            </Panel>
          }
        >
          <Show
            when={!loading()}
            fallback={
              <Panel>
                <TableSkeleton rows={8} cols={6} />
              </Panel>
            }
          >
            <Show when={tab() === "ARUS"}>
              <Panel>
                <Show
                  when={flows().length > 0}
                  fallback={
                    <EmptyState
                      title="Belum ada arus kas"
                      description="Catat kas masuk atau keluar pertama."
                    />
                  }
                >
                  <TableWrap>
                    <Table class="min-w-[880px]">
                      <thead>
                        <tr>
                          <Th>Tanggal</Th>
                          <Th>Tipe</Th>
                          <Th>Kategori</Th>
                          <Th>Metode</Th>
                          <Th align="right">Nominal</Th>
                          <Th>Referensi</Th>
                          <Th>Sumber</Th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={flows()}>
                          {(flow) => (
                            <tr class="hover:bg-hover">
                              <Td>{formatDate(flow.time)}</Td>
                              <Td>
                                <Badge
                                  tone={
                                    flow.type === "IN" ? "success" : "danger"
                                  }
                                >
                                  {flow.type === "IN" ? "Masuk" : "Keluar"}
                                </Badge>
                              </Td>
                              <Td>{flow.category}</Td>
                              <Td>{flow.method}</Td>
                              <Td
                                align="right"
                                class={
                                  flow.type === "IN"
                                    ? "font-bold text-success"
                                    : "font-bold text-danger"
                                }
                              >
                                {flow.type === "IN" ? "+" : "−"}
                                {formatRupiah(flow.amount)}
                              </Td>
                              <Td class="font-mono text-[11px]">
                                {flow.reference}
                              </Td>
                              <Td>{flow.source}</Td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </Table>
                  </TableWrap>
                </Show>
              </Panel>
            </Show>

            <Show when={tab() === "PIUTANG"}>
              <Panel>
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Pelanggan</Th>
                        <Th>Invoice</Th>
                        <Th>Jatuh tempo</Th>
                        <Th align="right">Total</Th>
                        <Th align="right">Terbayar</Th>
                        <Th align="right">Sisa</Th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={receivablesQuery.data ?? []}>
                        {(item) => (
                          <tr class="hover:bg-hover">
                            <Td>
                              <b class="text-ink">{item.customerName}</b>
                            </Td>
                            <Td class="font-mono text-xs">{item.invoice}</Td>
                            <Td>{formatDate(item.due)}</Td>
                            <Td align="right">{formatRupiah(item.total)}</Td>
                            <Td align="right">{formatRupiah(item.paid)}</Td>
                            <Td align="right" class="font-bold text-danger">
                              {formatRupiah(item.total - item.paid)}
                            </Td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </Table>
                </TableWrap>
              </Panel>
            </Show>

            <Show when={tab() === "HUTANG"}>
              <Panel>
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Supplier</Th>
                        <Th>Faktur</Th>
                        <Th>Jatuh tempo</Th>
                        <Th align="right">Total</Th>
                        <Th align="right">Sisa</Th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={outstandingPayables()}>
                        {(item) => (
                          <tr class="hover:bg-hover">
                            <Td>
                              <b class="text-ink">{item.supplierName}</b>
                            </Td>
                            <Td class="font-mono text-xs">{item.invoice}</Td>
                            <Td>{formatDate(item.due)}</Td>
                            <Td align="right">{formatRupiah(item.total)}</Td>
                            <Td align="right" class="font-bold text-danger">
                              {formatRupiah(item.total - item.paid)}
                            </Td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </Table>
                </TableWrap>
              </Panel>
            </Show>
          </Show>
        </Show>

        <Modal
          open={modalOpen()}
          onOpenChange={setModalOpen}
          title="Catat Kas"
          description="Entri manual akan tercatat sebagai source MANUAL."
          footer={
            <>
              <Button onClick={() => setModalOpen(false)}>Batal</Button>
              <Button variant="primary" onClick={() => void saveCash()}>
                Simpan
              </Button>
            </>
          }
        >
          <div class="space-y-3">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Tipe">
                <Select
                  value={type()}
                  onChange={(event) =>
                    setType(event.currentTarget.value as "IN" | "OUT")
                  }
                >
                  <option value="IN">Kas masuk</option>
                  <option value="OUT">Kas keluar</option>
                </Select>
              </Field>
              <Field label="Kategori">
                <Select
                  value={category()}
                  onChange={(event) => setCategory(event.currentTarget.value)}
                >
                  <option>Penjualan</option>
                  <option>Pembayaran Piutang</option>
                  <option>Pembelian</option>
                  <option>Listrik & Air</option>
                  <option>Lainnya</option>
                </Select>
              </Field>
              <Field label="Metode">
                <Select
                  value={method()}
                  onChange={(event) =>
                    setMethod(event.currentTarget.value as PaymentMethod)
                  }
                >
                  <option value="TUNAI">Tunai</option>
                  <option value="TRANSFER">Transfer</option>
                  <option value="QRIS">QRIS</option>
                </Select>
              </Field>
              <Field label="Nominal" required>
                <Input
                  type="number"
                  value={amount()}
                  onInput={(event) => setAmount(event.currentTarget.value)}
                />
              </Field>
            </div>
            <Field label="Referensi">
              <Input
                value={reference()}
                placeholder="Opsional"
                onInput={(event) => setReference(event.currentTarget.value)}
              />
            </Field>
          </div>
        </Modal>
      </div>
    </>
  );
}
