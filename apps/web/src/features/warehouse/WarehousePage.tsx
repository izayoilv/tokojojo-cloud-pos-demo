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
import type { LocationCode, Transfer, TransferItem } from "../../data/types";
import { formatDateTime } from "../../lib/format";
import {
  validateOpnameDraft,
  validateTransferDraft,
} from "./warehouseValidation";

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
  const [createError, setCreateError] = createSignal("");
  const [transferAction, setTransferAction] = createSignal<{
    type: "complete" | "cancel";
    transfer: Transfer;
  } | null>(null);
  const [opnameOpen, setOpnameOpen] = createSignal(false);
  const [opnameLocation, setOpnameLocation] =
    createSignal<LocationCode>("STORE-FRONT");
  const [opnameRows, setOpnameRows] = createSignal<
    Array<{ productId: string; physicalQty: number }>
  >([{ productId: "", physicalQty: 0 }]);
  const [opnameError, setOpnameError] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [decidingOpname, setDecidingOpname] = createSignal(false);

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

  const loading = () =>
    transfersQuery.isPending ||
    opnamesQuery.isPending ||
    productsQuery.isPending;
  const failed = () =>
    transfersQuery.isError || opnamesQuery.isError || productsQuery.isError;

  const mutate = async (action: () => Promise<unknown>, message: string) => {
    await action();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["transfers"] }),
      queryClient.invalidateQueries({ queryKey: ["opnames"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["movements"] }),
    ]);
    toast.notify(message);
  };

  const selectedProduct = () =>
    (productsQuery.data ?? []).find((product) => product.id === productId());
  const availableStock = () => {
    const product = selectedProduct();
    if (!product) return 0;
    return from() === "WH-BACK" ? product.warehouseStock : product.storeStock;
  };

  const createTransfer = async () => {
    if (saving()) return;
    const product = selectedProduct();
    const quantity = Number(qty());
    const error = validateTransferDraft({
      from: from(),
      to: to(),
      productId: productId(),
      quantity,
      products: productsQuery.data ?? [],
    });

    if (error) {
      setCreateError(error);
      return;
    }

    if (!product) return;

    const item: TransferItem = {
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      quantity,
    };

    setSaving(true);
    try {
      await mutate(
        () => repository.createTransfer(from(), to(), [item]),
        "Mutasi dibuat — menunggu serah terima.",
      );
      setCreateOpen(false);
    } catch (caught) {
      setCreateError(
        caught instanceof Error ? caught.message : "Mutasi gagal dibuat.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openTransfer = () => {
    setCreateError("");
    setCreateOpen(true);
  };

  const confirmTransferAction = async () => {
    const action = transferAction();
    if (!action || saving()) return;

    setSaving(true);
    try {
      await mutate(
        () =>
          action.type === "complete"
            ? repository.completeTransfer(action.transfer.id)
            : repository.cancelTransfer(action.transfer.id),
        action.type === "complete"
          ? "Mutasi selesai. Stok sudah dipindahkan."
          : "Mutasi dibatalkan.",
      );
      setTransferAction(null);
    } catch (caught) {
      toast.notify(
        caught instanceof Error ? caught.message : "Mutasi gagal diproses.",
        "danger",
      );
    } finally {
      setSaving(false);
    }
  };

  const stockAt = (location: LocationCode, id: string) => {
    const product = (productsQuery.data ?? []).find((item) => item.id === id);
    if (!product) return 0;
    return location === "WH-BACK" ? product.warehouseStock : product.storeStock;
  };

  const systemQty = (id: string) => stockAt(opnameLocation(), id);

  const decideOpname = async (
    opname: { id: string; number: string },
    status: "APPROVED" | "REJECTED",
    message: string,
  ) => {
    if (decidingOpname()) return;

    setDecidingOpname(true);
    try {
      await mutate(
        () => repository.setOpnameStatus(opname.id, status),
        message,
      );
    } catch (caught) {
      toast.notify(
        caught instanceof Error ? caught.message : "Opname gagal diproses.",
        "danger",
      );
    } finally {
      setDecidingOpname(false);
    }
  };

  const updateOpnameRow = (
    index: number,
    patch: Partial<{ productId: string; physicalQty: number }>,
  ) => {
    setOpnameRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  };

  const addOpnameRow = () => {
    setOpnameRows((current) => [...current, { productId: "", physicalQty: 0 }]);
  };

  const removeOpnameRow = (index: number) => {
    setOpnameRows((current) =>
      current.filter((_, rowIndex) => rowIndex !== index),
    );
  };

  const openOpname = () => {
    setOpnameLocation("STORE-FRONT");
    setOpnameRows([{ productId: "", physicalQty: 0 }]);
    setOpnameError("");
    setOpnameOpen(true);
  };

  const saveOpname = async () => {
    if (saving()) return;
    const error = validateOpnameDraft({
      location: opnameLocation(),
      items: opnameRows(),
    });

    if (error) {
      setOpnameError(error);
      return;
    }

    setSaving(true);
    try {
      await mutate(
        () =>
          repository.createOpname({
            location: opnameLocation(),
            items: opnameRows(),
          }),
        "Opname dibuat — menunggu review.",
      );
      setOpnameOpen(false);
    } catch (caught) {
      setOpnameError(
        caught instanceof Error ? caught.message : "Opname gagal dibuat.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Mutasi stok dan persetujuan opname"
        title="Gudang"
        subtitle="Mutasi dipindahkan saat selesai; opname disetujui di sini."
        actions={
          <>
            <Show when={tab() === "MUTASI"}>
              <Button size="sm" variant="primary" onClick={openTransfer}>
                <Plus size={14} /> Buat Mutasi
              </Button>
            </Show>
            <Show when={tab() === "OPNAME"}>
              <Button size="sm" variant="primary" onClick={openOpname}>
                <Plus size={14} /> Buat Opname
              </Button>
            </Show>
          </>
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
                  void productsQuery.refetch();
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
                                        setTransferAction({
                                          type: "complete",
                                          transfer,
                                        })
                                      }
                                    >
                                      Selesaikan
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="soft-danger"
                                      onClick={() =>
                                        setTransferAction({
                                          type: "cancel",
                                          transfer,
                                        })
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
                              aria-label={`Setujui opname ${opname.number}`}
                              loading={decidingOpname()}
                              onClick={() =>
                                void decideOpname(
                                  opname,
                                  "APPROVED",
                                  "Opname disetujui. Selisih diterapkan.",
                                )
                              }
                            >
                              Setujui
                            </Button>
                            <Button
                              size="sm"
                              variant="soft-danger"
                              aria-label={`Tolak opname ${opname.number}`}
                              loading={decidingOpname()}
                              onClick={() =>
                                void decideOpname(
                                  opname,
                                  "REJECTED",
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
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setCreateError("");
          }}
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
                onChange={(event) => {
                  setProductId(event.currentTarget.value);
                  setCreateError("");
                }}
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
                onInput={(event) => {
                  setQty(event.currentTarget.value);
                  setCreateError("");
                }}
              />
            </Field>
            <p class="text-xs text-ink-muted">
              Stok tersedia di lokasi asal: <b>{availableStock()}</b>
            </p>
            <Show when={createError()}>
              <p role="alert" class="text-xs font-semibold text-danger">
                {createError()}
              </p>
            </Show>
          </div>
        </Modal>

        <Show when={transferAction()}>
          {(action) => (
            <Modal
              open
              onOpenChange={(open) => !open && setTransferAction(null)}
              title={
                action().type === "complete"
                  ? "Selesaikan mutasi?"
                  : "Batalkan mutasi?"
              }
              description={`${action().transfer.number} · ${action().transfer.from} → ${action().transfer.to}`}
              footer={
                <>
                  <Button onClick={() => setTransferAction(null)}>Tidak</Button>
                  <Button
                    variant={
                      action().type === "complete" ? "success" : "soft-danger"
                    }
                    onClick={() => void confirmTransferAction()}
                  >
                    {action().type === "complete" ? "Selesaikan" : "Batalkan"}
                  </Button>
                </>
              }
            >
              <p class="text-sm text-ink-secondary">
                {action().type === "complete"
                  ? "Stok akan dipindahkan dari lokasi asal ke lokasi tujuan."
                  : "Mutasi pending akan dibatalkan tanpa memindahkan stok."}
              </p>
            </Modal>
          )}
        </Show>

        <Show when={opnameOpen()}>
          <Modal
            open
            onOpenChange={(open) => {
              setOpnameOpen(open);
              if (!open) setOpnameError("");
            }}
            title="Buat Opname"
            description="Masukkan jumlah fisik hasil hitung. Selisih menunggu review OWNER/ADMIN."
            footer={
              <>
                <Button onClick={() => setOpnameOpen(false)}>Batal</Button>
                <Button variant="primary" onClick={() => void saveOpname()}>
                  Simpan opname
                </Button>
              </>
            }
          >
            <div class="space-y-3">
              <Field label="Lokasi">
                <Select
                  value={opnameLocation()}
                  onChange={(event) => {
                    const next = event.currentTarget.value as LocationCode;
                    setOpnameLocation(next);
                    setOpnameRows((current) =>
                      current.map((row) =>
                        row.productId
                          ? {
                              ...row,
                              physicalQty: stockAt(next, row.productId),
                            }
                          : row,
                      ),
                    );
                  }}
                >
                  <option value="STORE-FRONT">Area toko</option>
                  <option value="WH-BACK">Gudang belakang</option>
                </Select>
              </Field>
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-ink-secondary">
                    Produk
                  </span>
                  <Button size="sm" variant="secondary" onClick={addOpnameRow}>
                    <Plus size={13} /> Tambah produk
                  </Button>
                </div>
                <For each={opnameRows()}>
                  {(row, index) => (
                    <div class="grid grid-cols-1 gap-2 rounded-[6px] border border-line p-2 sm:grid-cols-[1.6fr_80px_36px]">
                      <Select
                        aria-label="Produk opname"
                        value={row.productId}
                        onChange={(event) => {
                          const id = event.currentTarget.value;
                          updateOpnameRow(index(), {
                            productId: id,
                            physicalQty: stockAt(opnameLocation(), id),
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
                        aria-label="Jumlah fisik"
                        type="number"
                        min="0"
                        value={row.physicalQty}
                        onInput={(event) =>
                          updateOpnameRow(index(), {
                            physicalQty: Number(event.currentTarget.value),
                          })
                        }
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Hapus produk opname"
                        disabled={opnameRows().length === 1}
                        onClick={() => removeOpnameRow(index())}
                      >
                        ×
                      </Button>
                      <span class="text-[11px] text-ink-muted sm:col-span-3">
                        Stok sistem: {systemQty(row.productId)}
                      </span>
                    </div>
                  )}
                </For>
              </div>
              <Show when={opnameError()}>
                <p role="alert" class="text-xs font-semibold text-danger">
                  {opnameError()}
                </p>
              </Show>
            </div>
          </Modal>
        </Show>
      </div>
    </>
  );
}
