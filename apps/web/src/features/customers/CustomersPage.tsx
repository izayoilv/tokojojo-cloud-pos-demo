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
  Td,
  Textarea,
  Th,
  useToast,
} from "@tokojojo/ui";
import { Plus } from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";

import { useAuth } from "../../app/auth";
import { repository } from "../../data/repository";
import type { Customer } from "../../data/types";
import { formatRupiah } from "../../lib/format";

export function CustomersPage() {
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = createSignal("");
  const [editing, setEditing] = createSignal<Customer | null | undefined>();
  const [saving, setSaving] = createSignal(false);

  const customersQuery = createQuery(() => ({
    queryKey: ["customers"],
    queryFn: () => repository.listCustomers(),
  }));

  const customers = () => customersQuery.data ?? [];
  const canEdit = () =>
    auth.user()?.role === "OWNER" ||
    auth.user()?.role === "ADMIN" ||
    auth.user()?.role === "CASHIER";

  const filtered = createMemo(() => {
    const needle = search().trim().toLowerCase();
    if (!needle) return customers();
    return customers().filter(
      (customer) =>
        customer.name.toLowerCase().includes(needle) ||
        customer.phone.includes(needle),
    );
  });

  const [form, setForm] = createSignal({
    name: "",
    phone: "",
    address: "",
    notes: "",
    active: true,
  });

  const openEditor = (customer: Customer | null) => {
    setForm({
      name: customer?.name ?? "",
      phone: customer?.phone ?? "",
      address: customer?.address ?? "",
      notes: customer?.notes ?? "",
      active: customer?.active ?? true,
    });
    setEditing(customer);
  };

  const save = async () => {
    const values = form();
    if (!values.name.trim()) {
      toast.notify("Nama pelanggan wajib diisi.", "danger");
      return;
    }
    setSaving(true);
    try {
      const current = editing();
      await repository.saveCustomer({
        id: current?.id ?? "",
        name: values.name.trim(),
        phone: values.phone.trim(),
        address: values.address.trim(),
        notes: values.notes.trim(),
        outstanding: current?.outstanding ?? 0,
        active: values.active,
      });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.notify("Pelanggan tersimpan.");
      setEditing(undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Relasi pelanggan dan piutang"
        title="Pelanggan"
        subtitle="Data pelanggan untuk penjualan tunai, hutang, dan piutang."
        actions={
          <Show when={canEdit()}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => openEditor(null)}
            >
              <Plus size={14} /> Tambah Pelanggan
            </Button>
          </Show>
        }
      />

      <Panel>
        <div class="border-b border-line p-4">
          <SearchInput
            aria-label="Cari pelanggan"
            class="max-w-md"
            placeholder="Cari nama atau telepon..."
            value={search()}
            onInput={(event) => setSearch(event.currentTarget.value)}
          />
        </div>
        <Show
          when={!customersQuery.isError}
          fallback={
            <ErrorState
              message="Pelanggan tidak dapat dimuat."
              onRetry={() => void customersQuery.refetch()}
            />
          }
        >
          <Show
            when={!customersQuery.isPending}
            fallback={<TableSkeleton rows={6} cols={5} />}
          >
            <Show
              when={filtered().length > 0}
              fallback={
                <EmptyState
                  title="Belum ada pelanggan"
                  description="Tambahkan pelanggan pertama untuk transaksi hutang."
                  action={
                    <Show when={canEdit()}>
                      <Button size="sm" onClick={() => openEditor(null)}>
                        Tambah Pelanggan
                      </Button>
                    </Show>
                  }
                />
              }
            >
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Nama</Th>
                      <Th>Telepon</Th>
                      <Th>Alamat</Th>
                      <Th align="right">Piutang</Th>
                      <Th>Status</Th>
                      <Th align="center">Aksi</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={filtered()}>
                      {(customer) => (
                        <tr class="hover:bg-hover">
                          <Td>
                            <b class="text-ink">{customer.name}</b>
                            <div class="text-xs text-ink-muted">
                              {customer.notes}
                            </div>
                          </Td>
                          <Td class="font-mono text-[11px]">
                            {customer.phone}
                          </Td>
                          <Td>{customer.address}</Td>
                          <Td align="right">
                            <b
                              class={
                                customer.outstanding > 0 ? "text-danger" : ""
                              }
                            >
                              {formatRupiah(customer.outstanding)}
                            </b>
                          </Td>
                          <Td>
                            <Badge
                              tone={customer.active ? "success" : "neutral"}
                            >
                              {customer.active ? "Aktif" : "Nonaktif"}
                            </Badge>
                          </Td>
                          <Td align="center">
                            <Button
                              size="sm"
                              onClick={() => openEditor(customer)}
                            >
                              {canEdit() ? "Edit" : "Lihat"}
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

      <Show when={editing() !== undefined}>
        <Modal
          open
          onOpenChange={(open) => !open && setEditing(undefined)}
          title={editing() ? "Edit Pelanggan" : "Tambah Pelanggan"}
          description="Pelanggan dipakai untuk penjualan hutang dan piutang."
          footer={
            <>
              <Button onClick={() => setEditing(undefined)}>Batal</Button>
              <Show when={canEdit()}>
                <Button
                  variant="primary"
                  loading={saving()}
                  onClick={() => void save()}
                >
                  Simpan
                </Button>
              </Show>
            </>
          }
        >
          <div class="space-y-4">
            <Field label="Nama pelanggan" required>
              <Input
                value={form().name}
                disabled={!canEdit()}
                onInput={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.currentTarget.value,
                  }))
                }
              />
            </Field>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Telepon">
                <Input
                  value={form().phone}
                  disabled={!canEdit()}
                  onInput={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.currentTarget.value,
                    }))
                  }
                />
              </Field>
              <Field label="Status">
                <Select
                  value={form().active ? "active" : "inactive"}
                  disabled={!canEdit()}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      active: event.currentTarget.value === "active",
                    }))
                  }
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </Select>
              </Field>
            </div>
            <Field label="Alamat">
              <Input
                value={form().address}
                disabled={!canEdit()}
                onInput={(event) =>
                  setForm((current) => ({
                    ...current,
                    address: event.currentTarget.value,
                  }))
                }
              />
            </Field>
            <Field label="Catatan">
              <Textarea
                value={form().notes}
                disabled={!canEdit()}
                onInput={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.currentTarget.value,
                  }))
                }
              />
            </Field>
            <Show when={editing()}>
              <div class="rounded-[6px] border border-line bg-subtle p-3 text-sm">
                <div class="flex items-center justify-between">
                  <span class="text-ink-secondary">Piutang berjalan</span>
                  <b class="text-danger">
                    {formatRupiah(editing()?.outstanding ?? 0)}
                  </b>
                </div>
                <p class="mt-1 text-xs text-ink-muted">
                  Riwayat penjualan dan pembayaran mengikuti data contoh.
                </p>
              </div>
            </Show>
          </div>
        </Modal>
      </Show>
    </>
  );
}
