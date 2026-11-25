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
import { KeyRound, Plus } from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";

import { useAuth } from "../../app/auth";
import { roleMeta } from "../../app/rbac";
import { repository } from "../../data/repository";
import type { Role, User } from "../../data/types";
import { formatDateTime } from "../../lib/format";

type UsersTab = "PENGGUNA" | "AUDIT";

const roles: Role[] = ["OWNER", "ADMIN", "CASHIER", "WAREHOUSE"];

export function UsersPage() {
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = createSignal<UsersTab>("PENGGUNA");
  const [search, setSearch] = createSignal("");
  const [editing, setEditing] = createSignal<User | null | undefined>();
  const [form, setForm] = createSignal({
    name: "",
    username: "",
    role: "CASHIER" as Role,
    email: "",
    phone: "",
    active: true,
  });

  const usersQuery = createQuery(() => ({
    queryKey: ["users"],
    queryFn: () => repository.listUsers(),
  }));
  const auditQuery = createQuery(() => ({
    queryKey: ["audit"],
    queryFn: () => repository.listAuditEvents(),
  }));

  const users = createMemo(() => {
    const needle = search().trim().toLowerCase();
    return (usersQuery.data ?? []).filter(
      (user) =>
        !needle ||
        user.name.toLowerCase().includes(needle) ||
        user.username.toLowerCase().includes(needle),
    );
  });

  const audit = createMemo(() => {
    const needle = search().trim().toLowerCase();
    return (auditQuery.data ?? []).filter(
      (event) =>
        !needle ||
        event.actor.toLowerCase().includes(needle) ||
        event.event.toLowerCase().includes(needle) ||
        event.entity.toLowerCase().includes(needle),
    );
  });

  const openEditor = (user: User | null) => {
    setForm({
      name: user?.name ?? "",
      username: user?.username ?? "",
      role: user?.role ?? "CASHIER",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      active: user?.active ?? true,
    });
    setEditing(user);
  };

  const saveUser = async () => {
    if (!form().name.trim() || !form().username.trim()) {
      toast.notify("Nama dan username wajib diisi.", "danger");
      return;
    }
    await repository.saveUser({
      id: editing()?.id ?? "",
      name: form().name.trim(),
      username: form().username.trim(),
      role: form().role,
      email: form().email.trim(),
      phone: form().phone.trim(),
      active: form().active,
      lastLogin: editing()?.lastLogin ?? new Date().toISOString(),
    });
    await queryClient.invalidateQueries({ queryKey: ["users"] });
    setEditing(undefined);
    toast.notify("Pengguna tersimpan.");
  };

  return (
    <>
      <PageHeader
        eyebrow="Akses karyawan dan jejak audit"
        title="Pengguna & Audit"
        subtitle="Kelola akun dan tinjau aktivitas sistem."
        actions={
          <Show when={tab() === "PENGGUNA"}>
            <Button
              size="sm"
              variant="primary"
              onClick={() => openEditor(null)}
            >
              <Plus size={14} /> Tambah Pengguna
            </Button>
          </Show>
        }
      />

      <Tabs
        value={tab()}
        onChange={setTab}
        items={[
          { value: "PENGGUNA", label: "Pengguna", count: users().length },
          { value: "AUDIT", label: "Audit", count: audit().length },
        ]}
        label="Tampilan pengguna"
        class="mb-3"
      />

      <Panel>
        <div class="border-b border-line p-4">
          <SearchInput
            class="max-w-md"
            placeholder={
              tab() === "PENGGUNA"
                ? "Cari nama atau username..."
                : "Cari aktor, event, atau entitas..."
            }
            value={search()}
            onInput={(event) => setSearch(event.currentTarget.value)}
          />
        </div>

        <Show
          when={tab() === "PENGGUNA"}
          fallback={
            <Show
              when={!auditQuery.isPending}
              fallback={<TableSkeleton rows={7} cols={5} />}
            >
              <TableWrap>
                <Table class="min-w-[860px]">
                  <thead>
                    <tr>
                      <Th>Waktu</Th>
                      <Th>Aktor</Th>
                      <Th>Event</Th>
                      <Th>Entitas</Th>
                      <Th>Ringkasan</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={audit()}>
                      {(event) => (
                        <tr class="hover:bg-hover">
                          <Td>{formatDateTime(event.time)}</Td>
                          <Td>
                            <b class="text-ink">{event.actor}</b>
                            <div class="text-xs text-ink-muted">
                              {event.role}
                            </div>
                          </Td>
                          <Td>
                            <Badge tone="neutral">{event.event}</Badge>
                          </Td>
                          <Td>{event.entity}</Td>
                          <Td class="text-ink-secondary">{event.summary}</Td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </Table>
              </TableWrap>
              <Show when={audit().length === 0}>
                <EmptyState
                  title="Belum ada event"
                  description="Audit log akan terisi setelah ada aktivitas."
                />
              </Show>
            </Show>
          }
        >
          <Show
            when={!usersQuery.isError}
            fallback={
              <ErrorState
                message="Pengguna tidak dapat dimuat."
                onRetry={() => void usersQuery.refetch()}
              />
            }
          >
            <Show
              when={!usersQuery.isPending}
              fallback={<TableSkeleton rows={6} cols={5} />}
            >
              <TableWrap>
                <Table class="min-w-[880px]">
                  <thead>
                    <tr>
                      <Th>Nama</Th>
                      <Th>Username</Th>
                      <Th>Kontak</Th>
                      <Th>Peran</Th>
                      <Th>Status</Th>
                      <Th>Login terakhir</Th>
                      <Th align="center">Aksi</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={users()}>
                      {(user) => {
                        const locked =
                          auth.user()?.role === "ADMIN" &&
                          user.role === "OWNER";
                        return (
                          <tr class="hover:bg-hover">
                            <Td>
                              <b class="text-ink">{user.name}</b>
                            </Td>
                            <Td class="font-mono text-[11px]">
                              {user.username}
                            </Td>
                            <Td>
                              {user.email}
                              <div class="text-xs text-ink-muted">
                                {user.phone}
                              </div>
                            </Td>
                            <Td>
                              <span
                                class="rounded-full px-2 py-0.5 text-xs font-bold"
                                style={{
                                  background: `${roleMeta[user.role].color}18`,
                                  color: roleMeta[user.role].color,
                                }}
                              >
                                {user.role}
                              </span>
                            </Td>
                            <Td>
                              <Badge tone={user.active ? "success" : "neutral"}>
                                {user.active ? "Aktif" : "Nonaktif"}
                              </Badge>
                            </Td>
                            <Td>{formatDateTime(user.lastLogin)}</Td>
                            <Td align="center">
                              <div class="flex justify-center gap-1">
                                <Button
                                  size="sm"
                                  disabled={locked}
                                  onClick={() => openEditor(user)}
                                >
                                  Edit
                                </Button>
                                <Show when={!locked}>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      toast.notify(
                                        "Password sementara dibuat (demo).",
                                        "warning",
                                      )
                                    }
                                  >
                                    <KeyRound size={14} />
                                  </Button>
                                </Show>
                              </div>
                            </Td>
                          </tr>
                        );
                      }}
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
          title={editing() ? "Edit Pengguna" : "Tambah Pengguna"}
          description="Peran menentukan akses modul dan aksi."
          footer={
            <>
              <Button onClick={() => setEditing(undefined)}>Batal</Button>
              <Button variant="primary" onClick={() => void saveUser()}>
                Simpan
              </Button>
            </>
          }
        >
          <div class="space-y-3">
            <Field label="Nama" required>
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
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Username" required>
                <Input
                  value={form().username}
                  onInput={(event) =>
                    setForm((current) => ({
                      ...current,
                      username: event.currentTarget.value,
                    }))
                  }
                />
              </Field>
              <Field label="Peran">
                <Select
                  value={form().role}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.currentTarget.value as Role,
                    }))
                  }
                >
                  <For each={roles}>{(role) => <option>{role}</option>}</For>
                </Select>
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form().email}
                  onInput={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.currentTarget.value,
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
            <Field label="Status">
              <Select
                value={form().active ? "active" : "inactive"}
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
        </Modal>
      </Show>
    </>
  );
}
