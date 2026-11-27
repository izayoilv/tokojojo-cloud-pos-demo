import { useBeforeLeave, useLocation, useNavigate } from "@solidjs/router";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  PageHeader,
  Panel,
  Select,
  Switch,
  Table,
  TableSkeleton,
  TableWrap,
  Tabs,
  Td,
  Textarea,
  Th,
  usePreferences,
  useToast,
} from "@tokojojo/ui";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { useAuth } from "../../app/auth";
import { canManageSettings } from "../../app/rbac";
import { repository } from "../../data/repository";
import { formatDateTime } from "../../lib/format";
import { ForbiddenPage } from "../errors/ErrorPages";

type SettingsTab = "PROFIL" | "STRUK" | "STOK" | "PERANGKAT" | "TAMPILAN";

const tabs: Array<{ value: SettingsTab; label: string }> = [
  { value: "PROFIL", label: "Profil Toko" },
  { value: "STRUK", label: "Struk" },
  { value: "STOK", label: "Stok" },
  { value: "PERANGKAT", label: "Perangkat & Sesi" },
  { value: "TAMPILAN", label: "Tampilan" },
];

function SettingsRow(props: {
  label: string;
  description: string;
  children: import("solid-js").JSX.Element;
}) {
  return (
    <div class="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
      <div>
        <div class="text-sm font-semibold text-ink">{props.label}</div>
        <div class="text-xs text-ink-muted">{props.description}</div>
      </div>
      <div class="shrink-0">{props.children}</div>
    </div>
  );
}

export function SettingsPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const preferences = usePreferences();
  const queryClient = useQueryClient();
  const manage = () =>
    auth.user() ? canManageSettings(auth.user()!.role) : false;
  const requestedTab = () =>
    typeof location.query.tab === "string"
      ? location.query.tab.toUpperCase()
      : "";
  const activeTab = createMemo<SettingsTab>(() => {
    const requested = requestedTab();
    const valid = tabs.find((tab) => tab.value === requested);
    if (valid) return valid.value;
    return manage() ? "PROFIL" : "TAMPILAN";
  });
  const forbidden = () =>
    !manage() && !["TAMPILAN", ""].includes(requestedTab());

  const [storeForm, setStoreForm] = createSignal({
    name: "",
    tagline: "",
    address: "",
    city: "",
    phone: "",
    taxId: "",
  });
  const [receiptForm, setReceiptForm] = createSignal({
    paperSize: "58mm" as "58mm" | "80mm",
    showPrice: true,
    footer: "",
    autoPrint: false,
  });
  const [lowStockPercent, setLowStockPercent] = createSignal(20);
  const [defaultLocation, setDefaultLocation] = createSignal<
    "WH-BACK" | "STORE-FRONT"
  >("WH-BACK");
  const [storeBaseline, setStoreBaseline] = createSignal(storeForm());
  const [receiptBaseline, setReceiptBaseline] = createSignal(receiptForm());
  const [stockBaseline, setStockBaseline] = createSignal({
    lowStockPercent: lowStockPercent(),
    defaultLocation: defaultLocation(),
  });
  const [pendingTab, setPendingTab] = createSignal<SettingsTab | null>(null);
  const [discardOpen, setDiscardOpen] = createSignal(false);
  let leaveRetry: (() => void) | null = null;

  const dirty = createMemo(() => {
    if (activeTab() === "PROFIL") {
      return JSON.stringify(storeForm()) !== JSON.stringify(storeBaseline());
    }

    if (activeTab() === "STRUK") {
      return (
        JSON.stringify(receiptForm()) !== JSON.stringify(receiptBaseline())
      );
    }

    if (activeTab() === "STOK") {
      return (
        lowStockPercent() !== stockBaseline().lowStockPercent ||
        defaultLocation() !== stockBaseline().defaultLocation
      );
    }

    return false;
  });

  useBeforeLeave((event) => {
    if (!dirty() || event.defaultPrevented) return;

    event.preventDefault();
    leaveRetry = () => event.retry(true);
    setPendingTab(null);
    setDiscardOpen(true);
  });

  onMount(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty()) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    onCleanup(() => window.removeEventListener("beforeunload", handler));
  });

  const settingsQuery = createQuery(() => ({
    queryKey: ["settings"],
    queryFn: () => repository.getSettings(),
  }));
  const receiptQuery = createQuery(() => ({
    queryKey: ["receiptSettings"],
    queryFn: () => repository.getReceiptSettings(),
  }));
  const devicesQuery = createQuery(() => ({
    queryKey: ["devices"],
    queryFn: () => repository.listDevices(),
  }));
  const sessionsQuery = createQuery(() => ({
    queryKey: ["sessions"],
    queryFn: () => repository.listSessions(),
  }));

  createEffect(() => {
    const settings = settingsQuery.data;
    if (settings) {
      const next = {
        name: settings.name,
        tagline: settings.tagline,
        address: settings.address,
        city: settings.city,
        phone: settings.phone,
        taxId: settings.taxId,
      };
      setStoreForm(next);
      setStoreBaseline(next);
      setLowStockPercent(settings.lowStockPercent);
      setDefaultLocation(settings.defaultLocation);
      setStockBaseline({
        lowStockPercent: settings.lowStockPercent,
        defaultLocation: settings.defaultLocation,
      });
    }
  });

  createEffect(() => {
    const receipt = receiptQuery.data;
    if (receipt) {
      setReceiptForm(receipt);
      setReceiptBaseline(receipt);
    }
  });

  const saveStore = async () => {
    const settings = settingsQuery.data;
    if (!settings) return;
    await repository.saveSettings({
      ...settings,
      ...storeForm(),
      lowStockPercent: lowStockPercent(),
      defaultLocation: defaultLocation(),
    });
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
    setStoreBaseline(storeForm());
    setStockBaseline({
      lowStockPercent: lowStockPercent(),
      defaultLocation: defaultLocation(),
    });
    toast.notify("Profil toko tersimpan.");
  };

  const saveReceipt = async () => {
    await repository.saveReceiptSettings(receiptForm());
    await queryClient.invalidateQueries({ queryKey: ["receiptSettings"] });
    setReceiptBaseline(receiptForm());
    toast.notify("Pengaturan struk tersimpan.");
  };

  const saveStock = async () => {
    const settings = settingsQuery.data;
    if (!settings) return;
    await repository.saveSettings({
      ...settings,
      lowStockPercent: lowStockPercent(),
      defaultLocation: defaultLocation(),
    });
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
    setStockBaseline({
      lowStockPercent: lowStockPercent(),
      defaultLocation: defaultLocation(),
    });
    toast.notify("Pengaturan stok tersimpan.");
  };

  const requestTab = (tab: SettingsTab) => {
    if (tab === activeTab()) return;

    if (dirty()) {
      setPendingTab(tab);
      setDiscardOpen(true);
      return;
    }

    navigate(`/pengaturan?tab=${tab.toLowerCase()}`);
  };

  const keepEditing = () => {
    setPendingTab(null);
    leaveRetry = null;
    setDiscardOpen(false);
  };

  const discardChanges = () => {
    setStoreBaseline(storeForm());
    setReceiptBaseline(receiptForm());
    setStockBaseline({
      lowStockPercent: lowStockPercent(),
      defaultLocation: defaultLocation(),
    });
    setDiscardOpen(false);

    const tab = pendingTab();
    const retry = leaveRetry;
    setPendingTab(null);
    leaveRetry = null;

    if (tab) {
      navigate(`/pengaturan?tab=${tab.toLowerCase()}`);
    } else if (retry) {
      retry();
    }
  };

  const changeDevice = async (id: string, status: "APPROVED" | "REVOKED") => {
    await repository.setDeviceStatus(id, status);
    await queryClient.invalidateQueries({ queryKey: ["devices"] });
    toast.notify(
      status === "APPROVED" ? "Perangkat disetujui." : "Perangkat dicabut.",
      status === "APPROVED" ? "success" : "warning",
    );
  };

  const revokeSession = async (id: string) => {
    await repository.revokeSession(id);
    await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    toast.notify("Sesi dicabut.", "warning");
  };

  return (
    <>
      <PageHeader
        eyebrow="Administrasi toko dan preferensi perangkat"
        title="Pengaturan"
        subtitle="Kelola profil toko, struk, stok, perangkat, dan tampilan."
      />

      <Show when={!forbidden()} fallback={<ForbiddenPage />}>
        <Tabs
          value={activeTab()}
          onChange={requestTab}
          items={
            manage() ? tabs : tabs.filter((tab) => tab.value === "TAMPILAN")
          }
          label="Bagian pengaturan"
          id="settings-tabs"
          panelId="settings-panel"
          class="mb-3"
        />

        <div
          role="tabpanel"
          id="settings-panel"
          aria-labelledby={`settings-tabs-tab-${activeTab()}`}
        >
          <Show when={activeTab() === "PROFIL" && manage()}>
            <Panel>
              <div class="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                <Field label="Nama toko">
                  <Input
                    value={storeForm().name}
                    onInput={(event) =>
                      setStoreForm((current) => ({
                        ...current,
                        name: event.currentTarget.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Tagline">
                  <Input
                    value={storeForm().tagline}
                    onInput={(event) =>
                      setStoreForm((current) => ({
                        ...current,
                        tagline: event.currentTarget.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Alamat" class="sm:col-span-2">
                  <Input
                    value={storeForm().address}
                    onInput={(event) =>
                      setStoreForm((current) => ({
                        ...current,
                        address: event.currentTarget.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Kota">
                  <Input
                    value={storeForm().city}
                    onInput={(event) =>
                      setStoreForm((current) => ({
                        ...current,
                        city: event.currentTarget.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Telepon">
                  <Input
                    value={storeForm().phone}
                    onInput={(event) =>
                      setStoreForm((current) => ({
                        ...current,
                        phone: event.currentTarget.value,
                      }))
                    }
                  />
                </Field>
                <Field label="NPWP">
                  <Input
                    class="font-mono"
                    value={storeForm().taxId}
                    onInput={(event) =>
                      setStoreForm((current) => ({
                        ...current,
                        taxId: event.currentTarget.value,
                      }))
                    }
                  />
                </Field>
              </div>
              <div class="flex justify-end gap-2 border-t border-line px-4 py-3">
                <Button onClick={() => void settingsQuery.refetch()}>
                  Batal
                </Button>
                <Button variant="primary" onClick={() => void saveStore()}>
                  Simpan perubahan
                </Button>
              </div>
            </Panel>
          </Show>

          <Show when={activeTab() === "STRUK" && manage()}>
            <Panel>
              <SettingsRow
                label="Ukuran kertas"
                description="Lebar kertas printer struk."
              >
                <Select
                  aria-label="Ukuran kertas"
                  value={receiptForm().paperSize}
                  onChange={(event) =>
                    setReceiptForm((current) => ({
                      ...current,
                      paperSize: event.currentTarget.value as "58mm" | "80mm",
                    }))
                  }
                >
                  <option value="58mm">58mm</option>
                  <option value="80mm">80mm</option>
                </Select>
              </SettingsRow>
              <SettingsRow
                label="Tampilkan harga"
                description="Cetak harga satuan di struk."
              >
                <Switch
                  label="Tampilkan harga"
                  checked={receiptForm().showPrice}
                  onChange={(checked) =>
                    setReceiptForm((current) => ({
                      ...current,
                      showPrice: checked,
                    }))
                  }
                />
              </SettingsRow>
              <SettingsRow
                label="Cetak otomatis"
                description="Buka dialog cetak setelah pembayaran."
              >
                <Switch
                  label="Cetak otomatis"
                  checked={receiptForm().autoPrint}
                  onChange={(checked) =>
                    setReceiptForm((current) => ({
                      ...current,
                      autoPrint: checked,
                    }))
                  }
                />
              </SettingsRow>
              <div class="border-t border-line p-4">
                <Field label="Footer struk">
                  <Textarea
                    value={receiptForm().footer}
                    onInput={(event) =>
                      setReceiptForm((current) => ({
                        ...current,
                        footer: event.currentTarget.value,
                      }))
                    }
                  />
                </Field>
              </div>
              <div class="flex justify-end border-t border-line px-4 py-3">
                <Button variant="primary" onClick={() => void saveReceipt()}>
                  Simpan perubahan
                </Button>
              </div>
            </Panel>
          </Show>

          <Show when={activeTab() === "STOK" && manage()}>
            <Panel>
              <SettingsRow
                label="Lokasi default"
                description="Untuk penerimaan dan opname."
              >
                <Select
                  aria-label="Lokasi default"
                  value={defaultLocation()}
                  onChange={(event) =>
                    setDefaultLocation(
                      event.currentTarget.value as "WH-BACK" | "STORE-FRONT",
                    )
                  }
                >
                  <option value="WH-BACK">Gudang belakang</option>
                  <option value="STORE-FRONT">Area toko</option>
                </Select>
              </SettingsRow>
              <SettingsRow
                label="Ambang stok menipis"
                description="Persentase di atas minimum."
              >
                <Input
                  aria-label="Ambang stok menipis"
                  type="number"
                  class="w-24"
                  value={lowStockPercent()}
                  onInput={(event) =>
                    setLowStockPercent(Number(event.currentTarget.value))
                  }
                />
              </SettingsRow>
              <div class="flex justify-end border-t border-line px-4 py-3">
                <Button variant="primary" onClick={() => void saveStock()}>
                  Simpan perubahan
                </Button>
              </div>
            </Panel>
          </Show>

          <Show when={activeTab() === "PERANGKAT" && manage()}>
            <div class="space-y-3">
              <Panel>
                <div class="border-b border-line px-4 py-3">
                  <h3 class="text-sm font-bold text-ink">Perangkat</h3>
                  <p class="text-xs text-ink-muted">
                    Setujui perangkat baru atau cabut akses.
                  </p>
                </div>
                <Show
                  when={!devicesQuery.isPending}
                  fallback={<TableSkeleton rows={4} cols={4} />}
                >
                  <TableWrap>
                    <Table>
                      <thead>
                        <tr>
                          <Th>Perangkat</Th>
                          <Th>Platform</Th>
                          <Th>Status</Th>
                          <Th>Terakhir aktif</Th>
                          <Th align="center">Aksi</Th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={devicesQuery.data ?? []}>
                          {(device) => (
                            <tr class="hover:bg-hover">
                              <Td>
                                <b class="text-ink">{device.name}</b>
                              </Td>
                              <Td>{device.platform}</Td>
                              <Td>
                                <Badge
                                  tone={
                                    device.status === "APPROVED"
                                      ? "success"
                                      : device.status === "PENDING"
                                        ? "warning"
                                        : "danger"
                                  }
                                >
                                  {device.status}
                                </Badge>
                              </Td>
                              <Td>{formatDateTime(device.lastSeen)}</Td>
                              <Td align="center">
                                <div class="flex justify-center gap-1">
                                  <Show when={device.status !== "APPROVED"}>
                                    <Button
                                      size="sm"
                                      variant="success"
                                      onClick={() =>
                                        void changeDevice(device.id, "APPROVED")
                                      }
                                    >
                                      Setujui
                                    </Button>
                                  </Show>
                                  <Show when={device.status !== "REVOKED"}>
                                    <Button
                                      size="sm"
                                      variant="soft-danger"
                                      onClick={() =>
                                        void changeDevice(device.id, "REVOKED")
                                      }
                                    >
                                      Cabut
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
              </Panel>

              <Panel>
                <div class="border-b border-line px-4 py-3">
                  <h3 class="text-sm font-bold text-ink">Sesi Web</h3>
                  <p class="text-xs text-ink-muted">
                    Sesi aktif untuk akun web admin.
                  </p>
                </div>
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Perangkat</Th>
                        <Th>Dibuat</Th>
                        <Th>Terakhir aktif</Th>
                        <Th align="center">Aksi</Th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={sessionsQuery.data ?? []}>
                        {(session) => (
                          <tr class="hover:bg-hover">
                            <Td>
                              {session.device}
                              <Show when={session.current}>
                                <Badge tone="success" class="ml-2">
                                  Sesi ini
                                </Badge>
                              </Show>
                            </Td>
                            <Td>{formatDateTime(session.created)}</Td>
                            <Td>{formatDateTime(session.lastSeen)}</Td>
                            <Td align="center">
                              <Button
                                size="sm"
                                disabled={session.current}
                                variant="soft-danger"
                                onClick={() => void revokeSession(session.id)}
                              >
                                Cabut
                              </Button>
                            </Td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </Table>
                </TableWrap>
              </Panel>
            </div>
          </Show>

          <Show when={activeTab() === "TAMPILAN"}>
            <Panel>
              <SettingsRow
                label="Tema"
                description="Terang, gelap, atau mengikuti sistem."
              >
                <div class="flex gap-1">
                  <For
                    each={
                      [
                        ["light", "Terang"],
                        ["dark", "Gelap"],
                        ["system", "Sistem"],
                      ] as const
                    }
                  >
                    {([value, label]) => (
                      <Button
                        size="sm"
                        variant={
                          preferences.theme() === value
                            ? "primary"
                            : "secondary"
                        }
                        onClick={() => preferences.setTheme(value)}
                      >
                        {label}
                      </Button>
                    )}
                  </For>
                </div>
              </SettingsRow>
              <SettingsRow label="Ukuran teks" description="Normal atau Besar.">
                <div class="flex gap-1">
                  <For
                    each={
                      [
                        ["normal", "Normal"],
                        ["large", "Besar"],
                      ] as const
                    }
                  >
                    {([value, label]) => (
                      <Button
                        size="sm"
                        variant={
                          preferences.textSize() === value
                            ? "primary"
                            : "secondary"
                        }
                        onClick={() => preferences.setTextSize(value)}
                      >
                        {label}
                      </Button>
                    )}
                  </For>
                </div>
              </SettingsRow>
              <div class="flex justify-end border-t border-line px-4 py-3">
                <Button
                  onClick={() => {
                    preferences.setTheme("system");
                    preferences.setTextSize("normal");
                  }}
                >
                  Kembalikan default
                </Button>
              </div>
            </Panel>
          </Show>
        </div>
      </Show>

      <Modal
        open={discardOpen()}
        onOpenChange={(open) => {
          if (!open) keepEditing();
        }}
        title="Buang perubahan?"
        description="Perubahan yang belum disimpan akan hilang."
        footer={
          <>
            <Button onClick={keepEditing}>Batal</Button>
            <Button variant="soft-danger" onClick={discardChanges}>
              Tinggalkan
            </Button>
          </>
        }
      >
        <p class="text-sm text-ink-secondary">
          Simpan perubahan terlebih dahulu jika ingin mempertahankannya.
        </p>
      </Modal>
    </>
  );
}
