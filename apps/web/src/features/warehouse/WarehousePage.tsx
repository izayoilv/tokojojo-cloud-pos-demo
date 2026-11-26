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
import { createSignal, For, Show } from "solid-js";

import { useAuth } from "../../app/auth";
import { canReviewOpname } from "../../app/rbac";
import { repository } from "../../data/repository";
import type { LocationCode, TransferItem } from "../../data/types";
import { formatDateTime } from "../../lib/format";

type WarehouseTab = "MUTASI" | "OPNAME";

export function WarehousePage() {
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = createSignal<WarehouseTab>("MUTASI");
  const [createOpen, setCreateOpen] = createSignal(false);
  const [from, setFrom] = createSignal<LocationCode>("WH-BACK");
  const [to, setTo] = createSignal<LocationCode>("STORE-FRONT");
  const [productId, setProductId] = createSignal("");
  const [qty, setQty] = createSignal("1");

  const transfersQuery = createQuery(() => ({
    queryKey: ["transfers"],
    queryFn: () => repository.listTransfers(),
  }));
  const opnamesQuery = createQuery(() => ({
    queryKey: ["opnames"],
    queryFn: () => repository.listOpnames(),
  }));
  const productsQuery = createQuery(() => ({
    queryKey: ["products"],
    queryFn: () => repository.listProducts(),
  }));

  const loading = () => transfersQuery.isPending || opnamesQuery.isPending;
  const failed = () => transfersQuery.isError || opnamesQuery.isError;

  const mutate = async (action: () => Promise<unknown>, message: string) => {
    await action();
    await queryClient.invalidateQueries({ queryKey: ["transfers"] });
    await queryClient.invalidateQueries({ queryKey: ["opnames"] });
    toast.notify(message);
  };

  const createTransfer = async () => {
    const product = (productsQuery.data ?? []).find(
      (p) => p.id === productId(),
    );
    if (!product) {
      toast.notify("Pilih produk terlebih dahulu.", "danger");
      return;
    }
    const item: TransferItem = {
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      quantity: Number(qty()) || 1,
    };
    await mutate(
      () => repository.createTransfer(from(), to(), [item]),
      "Mutasi dibuat — menunggu serah terima.",
    );
    setCreateOpen(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Mutasi stok dan persetujuan opname"
        title="Gudang"
        subtitle="Mutasi dipindahkan saat selesai; opname disetujui di sini."
        actions={
          <Show when={tab() === "MUTASI"}>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={14} /> Buat Mutasi
            </Button>
          </Show>
        }
      />

      <Tabs
        value={tab()}
        onChange={setTab}
        items={[
          {
            value: "MUTASI",
            label: "Mutasi",
            count: transfersQuery.data?.length ?? 0,
          },
          {
            value: "OPNAME",
            label: "Opname",
            count: opnamesQuery.data?.length ?? 0,
          },
        ]}
        label="Tampilan gudang"
        id="warehouse-tabs"
        panelId="warehouse-panel"
        class="mb-3"
      />

      <div
        role="tabpanel"
        id="warehouse-panel"
        aria-labelledby={`warehouse-tabs-tab-${tab()}`}
      >
        <Show
          when={!failed()}
          fallback={
            <Panel>
              <ErrorState
                message="Data gudang tidak dapat dimuat."
                onRetry={() => {
                  void transfersQuery.refetch();
                  void opnamesQuery.refetch();
                }}
              />
            </Panel>
          }
        >
          <Show
            when={!loading()}
            fallback={
              <Panel>
                <TableSkeleton rows={7} cols={6} />
              </Panel>
            }
          >
            <Show when={tab() === "MUTASI"}>
              <Panel>
                <Show
                  when={(transfersQuery.data ?? []).length > 0}
                  fallback={
                    <EmptyState
                      title="Belum ada mutasi"
                      description="Buat mutasi pertama dari gudang ke area toko."
                    />
                  }
                >
                  <TableWrap>
                    <Table class="min-w-[920px]">
                      <thead>
                        <tr>
                          <Th>No. Mutasi</Th>
                          <Th>Dari</Th>
                          <Th>Ke</Th>
                          <Th>Dibuat</Th>
                          <Th align="center">Item</Th>
                          <Th>Status</Th>
                          <Th align="center">Aksi</Th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={transfersQuery.data ?? []}>
                          {(transfer) => (
                            <tr class="hover:bg-hover">
                              <Td class="font-mono text-[11px]">
                                {transfer.number}
                              </Td>
                              <Td>{transfer.from}</Td>
                              <Td>{transfer.to}</Td>
                              <Td>
                                {transfer.createdBy}
                                <div class="text-xs text-ink-muted">
                                  {formatDateTime(transfer.created)}
                                </div>
                              </Td>
                              <Td align="center">{transfer.itemCount}</Td>
                              <Td>
                                <Badge
                                  tone={
                                    transfer.status === "COMPLETED"
                                      ? "success"
                                      : transfer.status === "CANCELLED"
                                        ? "neutral"
                                        : "warning"
                                  }
                                >
                                  {transfer.status}
                                </Badge>
                              </Td>
                              <Td align="center">
                                <Show when={transfer.status === "PENDING"}>
                                  <div class="flex justify-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="success"
                                      onClick={() =>
                                        void mutate(
                                          () =>
                                            repository.completeTransfer(
                                              transfer.id,
                                            ),
                                          "Mutasi selesai. Stok sudah dipindahkan.",
                                        )
                                      }
                                    >
                                      Selesaikan
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="soft-danger"
                                      onClick={() =>
                                        void mutate(
                                          () =>
                                            repository.cancelTransfer(
                                              transfer.id,
                                            ),
                                          "Mutasi dibatalkan.",
                                        )
                                      }
                                    >
                                      Batal
                                    </Button>
                                  </div>
                                </Show>
                              </Td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </Table>
                  </TableWrap>
                </Show>
              </Panel>
            </Show>

            <Show when={tab() === "OPNAME"}>
              <div class="space-y-3">
                <For each={opnamesQuery.data ?? []}>
                  {(opname) => (
                    <Panel>
                      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
                        <div>
                          <div class="flex items-center gap-2">
                            <b class="font-mono text-sm text-ink">
                              {opname.number}
                            </b>
                            <Badge
                              tone={
                                opname.status === "APPROVED"
                                  ? "success"
                                  : opname.status === "REJECTED"
                                    ? "danger"
                                    : "warning"
                              }
                            >
                              {opname.status === "PENDING_REVIEW"
                                ? "Menunggu review"
                                : opname.status === "APPROVED"
                                  ? "Disetujui"
                                  : "Ditolak"}
                            </Badge>
                          </div>
                          <div class="text-xs text-ink-muted">
                            {opname.location} · {opname.items.length} produk ·{" "}
                            {opname.createdBy}
                          </div>
                        </div>
                        <Show
                          when={
                            opname.status === "PENDING_REVIEW" &&
                            canReviewOpname(auth.user()?.role ?? "WAREHOUSE")
                          }
                        >
                          <div class="flex gap-2">
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() =>
                                void mutate(
                                  () =>
                                    repository.setOpnameStatus(
                                      opname.id,
                                      "APPROVED",
                                    ),
                                  "Opname disetujui. Selisih diterapkan.",
                                )
                              }
                            >
                              Setujui
                            </Button>
                            <Button
                              size="sm"
                              variant="soft-danger"
                              onClick={() =>
                                void mutate(
                                  () =>
                                    repository.setOpnameStatus(
                                      opname.id,
                                      "REJECTED",
                                    ),
                                  "Opname ditolak.",
                                )
                              }
                            >
                              Tolak
                            </Button>
                          </div>
                        </Show>
                      </div>
                      <TableWrap>
                        <Table class="min-w-[560px]">
                          <thead>
                            <tr>
                              <Th>Produk</Th>
                              <Th align="right">Sistem</Th>
                              <Th align="right">Fisik</Th>
                              <Th align="right">Selisih</Th>
                            </tr>
                          </thead>
                          <tbody>
                            <For each={opname.items}>
                              {(item) => (
                                <tr>
                                  <Td>{item.productName}</Td>
                                  <Td align="right">{item.systemQty}</Td>
                                  <Td align="right">{item.physicalQty}</Td>
                                  <Td
                                    align="right"
                                    class={
                                      item.physicalQty - item.systemQty < 0
                                        ? "font-bold text-danger"
                                        : "font-bold text-success"
                                    }
                                  >
                                    {item.physicalQty - item.systemQty > 0
                                      ? "+"
                                      : ""}
                                    {item.physicalQty - item.systemQty}
                                  </Td>
                                </tr>
                              )}
                            </For>
                          </tbody>
                        </Table>
                      </TableWrap>
                    </Panel>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </Show>

        <Modal
          open={createOpen()}
          onOpenChange={setCreateOpen}
          title="Buat Mutasi"
          description="Mutasi pending harus diselesaikan agar stok berpindah."
          footer={
            <>
              <Button onClick={() => setCreateOpen(false)}>Batal</Button>
              <Button variant="primary" onClick={() => void createTransfer()}>
                Buat mutasi
              </Button>
            </>
          }
        >
          <div class="space-y-3">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Dari">
                <Select
                  value={from()}
                  onChange={(event) =>
                    setFrom(event.currentTarget.value as LocationCode)
                  }
                >
                  <option value="WH-BACK">Gudang belakang</option>
                  <option value="STORE-FRONT">Area toko</option>
                </Select>
              </Field>
              <Field label="Ke">
                <Select
                  value={to()}
                  onChange={(event) =>
                    setTo(event.currentTarget.value as LocationCode)
                  }
                >
                  <option value="STORE-FRONT">Area toko</option>
                  <option value="WH-BACK">Gudang belakang</option>
                </Select>
              </Field>
            </div>
            <Field label="Produk">
              <Select
                value={productId()}
                onChange={(event) => setProductId(event.currentTarget.value)}
              >
                <option value="">Pilih produk...</option>
                <For each={productsQuery.data ?? []}>
                  {(product) => (
                    <option value={product.id}>{product.name}</option>
                  )}
                </For>
              </Select>
            </Field>
            <Field label="Jumlah">
              <Input
                type="number"
                min="1"
                value={qty()}
                onInput={(event) => setQty(event.currentTarget.value)}
              />
            </Field>
          </div>
        </Modal>
      </div>
    </>
  );
}
