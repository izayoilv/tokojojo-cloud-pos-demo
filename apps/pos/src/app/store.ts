import { batch, createMemo, createSignal } from "solid-js";

import {
  demoCart,
  demoUser,
  initialHeldCarts,
  initialSales,
  initialSync,
  products,
  settings as defaultSettings,
} from "../data/mock";
import type {
  CartLine,
  DeviceStatus,
  HeldCart,
  PaymentMethod,
  PosConnection,
  PosDevice,
  PosSale,
  PosScreen,
  PosSettings,
  Shift,
  SyncSnapshot,
  UserSession,
} from "../data/types";
import {
  cartTotals,
  changeDue,
  expectedCash,
  paymentMethodsFor,
} from "../lib/posCalc";

export const DEMO_PIN = "4321";
export const DEMO_PASSWORD = "tokojojo";

const cloneLines = (lines: CartLine[]): CartLine[] =>
  lines.map((line) => ({ ...line }));

const cloneSale = (sale: PosSale): PosSale => ({
  ...sale,
  items: cloneLines(sale.items),
  payments: sale.payments.map((payment) => ({ ...payment })),
});

const nowIso = () => new Date().toISOString();

const formatSyncTime = () =>
  `${new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date())} WIB`;

export function createPosStore() {
  const [screen, setScreen] = createSignal<PosScreen>("ENROLLMENT");
  const [device, setDevice] = createSignal<PosDevice>({
    name: "POS-01 · Batavia",
    platform: "TAURI",
    status: "PENDING",
    requestedAt: "2026-11-24T09:12:00+07:00",
    lastCheck: "2026-11-24T14:30:00+07:00",
  });
  const [connection, setConnectionSignal] =
    createSignal<PosConnection>("ONLINE");
  const [session, setSession] = createSignal<UserSession | null>(null);
  const [pinError, setPinError] = createSignal<string | null>(null);
  const [pinAttempts, setPinAttempts] = createSignal(0);
  const [pinLockedUntil, setPinLockedUntil] = createSignal<number | null>(null);
  const [selectedUser, setSelectedUser] = createSignal<UserSession>(demoUser);
  const [shift, setShift] = createSignal<Shift | null>(null);
  const [cart, setCart] = createSignal<CartLine[]>([]);
  const [heldCarts, setHeldCarts] = createSignal<HeldCart[]>(
    initialHeldCarts.map((held) => ({
      ...held,
      lines: cloneLines(held.lines),
    })),
  );
  const [sales, setSales] = createSignal<PosSale[]>(
    initialSales.map(cloneSale),
  );
  const [paymentMethod, setPaymentMethod] = createSignal<PaymentMethod | null>(
    null,
  );
  const [cashReceived, setCashReceivedSignal] = createSignal(0);
  const [paymentReference, setPaymentReferenceSignal] = createSignal("");
  const [receipt, setReceipt] = createSignal<PosSale | null>(null);
  const [queue, setQueue] = createSignal<SyncSnapshot>({
    ...initialSync,
    quarantine: [...initialSync.quarantine],
  });
  const [posSettings, setPosSettings] = createSignal<PosSettings>({
    ...defaultSettings,
  });
  const [error, setError] = createSignal<string | null>(null);

  let lineSequence = 1;
  let heldSequence = initialHeldCarts.length + 1;
  let saleSequence = initialSales.length + 1;
  let invoiceSequence = 125;
  let shiftSequence = 2;

  const allowedMethods = () => paymentMethodsFor(connection());
  const currentTotals = () => cartTotals(cart());

  const beginSession = () => {
    setSession({ ...selectedUser() });
    setPinError(null);
    setPinAttempts(0);
    setPinLockedUntil(null);
    setError(null);
    setScreen(
      connection() === "LOCKED"
        ? "HARD_LOCK"
        : shift()?.status === "OPEN"
          ? "SELL"
          : "OPEN_SHIFT",
    );
  };

  const approveDevice = () => {
    setDevice((current) => ({
      ...current,
      status: "ACTIVE",
      enrolledBy: "Admin Toko",
      lastCheck: nowIso(),
    }));
    setPinError(null);
    setPinAttempts(0);
    setError(null);
    setScreen("LOCK");
  };

  const setDeviceStatus = (status: DeviceStatus) => {
    setDevice((current) => ({
      ...current,
      status,
      lastCheck: nowIso(),
    }));

    if (status !== "ACTIVE") {
      setSession(null);
      setError(null);
      setScreen("ENROLLMENT");
      return;
    }

    setPinError(null);
    setPinAttempts(0);
    setError(null);
    setScreen("LOCK");
  };

  const unlockPin = (pin: string) => {
    if (device().status !== "ACTIVE") {
      setPinError("Perangkat belum aktif.");
      return;
    }

    const lockedUntil = pinLockedUntil();

    if (lockedUntil && Date.now() < lockedUntil) {
      const seconds = Math.ceil((lockedUntil - Date.now()) / 1000);
      setPinError(
        `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(seconds / 60)} menit.`,
      );
      return;
    }

    if (lockedUntil) {
      setPinLockedUntil(null);
      setPinAttempts(0);
    }

    if (pinAttempts() >= 10) {
      setPinError("Batas PIN tercapai. Gunakan kata sandi admin.");
      return;
    }

    setPinError(null);

    if (pin === posSettings().localPin) {
      beginSession();
      return;
    }

    const attempts = pinAttempts() + 1;
    setPinAttempts(attempts);

    if (attempts >= 10) {
      setPinError("Batas PIN tercapai. Gunakan kata sandi admin.");
    } else if (attempts >= 5) {
      setPinLockedUntil(Date.now() + 5 * 60_000);
      setPinError("Terlalu banyak percobaan. Coba lagi dalam 5 menit.");
    } else {
      setPinError("PIN salah");
    }
  };

  const unlockWithPassword = (password: string) => {
    if (device().status !== "ACTIVE") {
      setPinError("Perangkat belum aktif.");
      return;
    }

    if (password === DEMO_PASSWORD) {
      beginSession();
      return;
    }

    setPinError("Kata sandi salah");
  };

  const selectUser = (user: UserSession) => {
    setSelectedUser({ ...user });
    setPinAttempts(0);
    setPinLockedUntil(null);
    setPinError(null);
    setError(null);
  };

  const lock = () => {
    setSession(null);
    setError(null);
    setScreen(
      device().status !== "ACTIVE"
        ? "ENROLLMENT"
        : connection() === "LOCKED"
          ? "HARD_LOCK"
          : "LOCK",
    );
  };

  const openShift = (openingCash: number) => {
    const user = session();
    if (!user) {
      setError("Sesi berakhir. Masuk kembali.");
      setScreen("LOCK");
      return;
    }

    if (connection() === "LOCKED") {
      setError("Terkunci: buka shift membutuhkan koneksi.");
      return;
    }

    if (!Number.isFinite(openingCash) || openingCash < 0) {
      setError("Modal awal tidak valid.");
      return;
    }

    if (shift()?.status === "OPEN") {
      setError("Shift masih terbuka.");
      return;
    }

    setShift({
      id: `SHIFT-${String(shiftSequence++).padStart(2, "0")}`,
      userId: user.username,
      userName: user.name,
      openedAt: nowIso(),
      openingCash: Math.round(openingCash),
      source:
        connection() === "OFFLINE" || connection() === "GRACE"
          ? "OFFLINE"
          : "ONLINE",
      status: "OPEN",
      cashSales: 0,
      refunds: 0,
    });
    setCart(demoCart());
    setPaymentMethod(null);
    setCashReceivedSignal(0);
    setPaymentReferenceSignal("");
    setReceipt(null);
    setError(null);
    setScreen("SELL");
  };

  const closeShift = (actualCash: number) => {
    const current = shift();
    if (!current) {
      setError("Tidak ada shift aktif.");
      return;
    }

    if (connection() === "LOCKED") {
      setError("Terkunci: tutup shift menunggu koneksi.");
      return;
    }

    const expected = expectedCash(
      current.openingCash,
      current.cashSales,
      current.refunds,
    );
    const actual = Number.isFinite(actualCash) ? Math.round(actualCash) : 0;

    setShift({
      ...current,
      status: "CLOSED",
      closedAt: nowIso(),
      expectedCash: expected,
      actualCash: actual,
      difference: actual - expected,
    });
    setCart([]);
    setPaymentMethod(null);
    setCashReceivedSignal(0);
    setPaymentReferenceSignal("");
    setReceipt(null);
    setSession(null);
    setError(null);
    setScreen("LOCK");
  };

  const addProduct = (productId: string, unitId?: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) {
      setError("Produk tidak ditemukan.");
      return;
    }

    if (product.stock <= 0) {
      setError("Stok habis.");
      return;
    }

    const unit = unitId
      ? product.units.find((item) => item.id === unitId)
      : product.units[0];
    if (!unit) {
      setError("Satuan tidak ditemukan.");
      return;
    }

    const existing = cart().find(
      (line) => line.productId === product.id && line.unitId === unit.id,
    );

    if (existing) {
      setCart((lines) =>
        lines.map((line) =>
          line.id === existing.id
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        ),
      );
    } else {
      setCart((lines) => [
        ...lines,
        {
          id: `LINE-${lineSequence++}`,
          productId: product.id,
          name: product.name,
          unitId: unit.id,
          unitName: unit.name,
          quantity: 1,
          unitPrice: unit.sellingPrice,
          discount: 0,
        },
      ]);
    }

    setError(null);
  };

  const setQuantity = (lineId: string, quantity: number) => {
    const nextQuantity = Math.floor(quantity);
    if (nextQuantity <= 0) {
      setCart((lines) => lines.filter((line) => line.id !== lineId));
      return;
    }

    setCart((lines) =>
      lines.map((line) =>
        line.id === lineId ? { ...line, quantity: nextQuantity } : line,
      ),
    );
  };

  const removeLine = (lineId: string) => {
    setCart((lines) => lines.filter((line) => line.id !== lineId));
  };

  const clearCart = () => {
    setCart([]);
    setPaymentMethod(null);
    setCashReceivedSignal(0);
    setPaymentReferenceSignal("");
    setError(null);
  };

  const holdCart = () => {
    const lines = cart();
    if (lines.length === 0) {
      setError("Keranjang kosong.");
      return;
    }

    const sequence = heldSequence++;
    const held: HeldCart = {
      id: `HOLD-${String(sequence).padStart(3, "0")}`,
      label: `Pesanan #${sequence}`,
      lines: cloneLines(lines),
      createdAt: nowIso(),
    };

    setHeldCarts((current) => [...current, held]);
    setCart([]);
    setPaymentMethod(null);
    setCashReceivedSignal(0);
    setPaymentReferenceSignal("");
    setError(null);
  };

  const recallCart = (id: string) => {
    const held = heldCarts().find((item) => item.id === id);
    if (!held) {
      setError("Pesanan tahanan tidak ditemukan.");
      return;
    }

    if (cart().length > 0) {
      setError("Kosongkan keranjang sebelum memanggil pesanan.");
      return;
    }

    setCart(cloneLines(held.lines));
    setHeldCarts((current) => current.filter((item) => item.id !== id));
    setPaymentMethod(null);
    setCashReceivedSignal(0);
    setPaymentReferenceSignal("");
    setError(null);
    setScreen("SELL");
  };

  const go = (next: PosScreen) => {
    if (
      connection() === "LOCKED" &&
      (next === "SELL" || next === "PAYMENT" || next === "OPEN_SHIFT")
    ) {
      setError("Terkunci: selesaikan koneksi terlebih dahulu.");
      return;
    }

    if (next === "SELL" || next === "PAYMENT") {
      if (!session()) {
        setError("Sesi berakhir. Masuk kembali.");
        setScreen("LOCK");
        return;
      }
      if (shift()?.status !== "OPEN") {
        setError("Buka shift terlebih dahulu.");
        setScreen("OPEN_SHIFT");
        return;
      }
    }

    if (next === "OPEN_SHIFT" && !session()) {
      setError("Sesi berakhir. Masuk kembali.");
      setScreen("LOCK");
      return;
    }

    if (next === "PAYMENT") {
      if (cart().length === 0) {
        setError("Keranjang kosong. Tambahkan produk terlebih dahulu.");
        return;
      }

      if (allowedMethods().length === 0) {
        setError("Terkunci: pembayaran tidak tersedia.");
        return;
      }
    }

    setError(null);
    setScreen(next);
  };

  const selectPaymentMethod = (method: PaymentMethod) => {
    if (!allowedMethods().includes(method)) {
      setError(
        connection() === "LOCKED"
          ? "Terkunci: pembayaran tidak tersedia."
          : "Offline: hanya tunai yang tersedia.",
      );
      return;
    }

    setPaymentMethod(method);
    setPaymentReferenceSignal("");
    if (method === "TUNAI") {
      setCashReceivedSignal(currentTotals().total);
    }
    setError(null);
  };

  const setCashReceived = (amount: number) => {
    if (!Number.isFinite(amount)) return;
    setCashReceivedSignal(Math.max(0, Math.round(amount)));
  };

  const setPaymentReference = (value: string) => {
    setPaymentReferenceSignal(value);
  };

  const completeSale = () => {
    if (connection() === "LOCKED") {
      setError("Terkunci: transaksi baru diblokir.");
      return;
    }

    if (!session()) {
      setError("Sesi berakhir. Masuk kembali.");
      setScreen("LOCK");
      return;
    }

    if (shift()?.status !== "OPEN") {
      setError("Buka shift terlebih dahulu.");
      setScreen("OPEN_SHIFT");
      return;
    }

    const lines = cart();
    if (lines.length === 0) {
      setError("Keranjang kosong. Tambahkan produk terlebih dahulu.");
      return;
    }

    const totals = currentTotals();
    if (totals.total <= 0) {
      setError("Total transaksi harus lebih dari nol.");
      return;
    }

    const method = paymentMethod();
    if (!method || !allowedMethods().includes(method)) {
      setError("Pilih metode pembayaran yang tersedia.");
      return;
    }

    const reference = paymentReference().trim();
    if (method !== "TUNAI" && !reference) {
      setError("Referensi pembayaran wajib diisi.");
      return;
    }

    let received = totals.total;
    let change = 0;

    if (method === "TUNAI") {
      received = cashReceived();
      if (received < totals.total) {
        setError("Uang diterima kurang dari total.");
        return;
      }
      change = changeDue(totals.total, received);
    }

    const saleTime = new Date();
    const sale: PosSale = {
      id: `SALE-${String(saleSequence++).padStart(3, "0")}`,
      invoice: `INV/${saleTime.getFullYear()}/${String(
        saleTime.getMonth() + 1,
      ).padStart(2, "0")}/${String(invoiceSequence++).padStart(5, "0")}`,
      time: nowIso(),
      cashier: session()?.name ?? "Kasir",
      shiftId: shift()?.id ?? "-",
      items: cloneLines(lines),
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      customer: method === "HUTANG" ? reference : undefined,
      payments: [
        {
          method,
          amount: received,
          reference: reference || undefined,
        },
      ],
      change,
      status: "COMPLETED",
      flaggedForReview: connection() === "GRACE" ? true : undefined,
    };

    setSales((current) => [sale, ...current]);

    if (method === "TUNAI") {
      setShift((current) =>
        current
          ? { ...current, cashSales: current.cashSales + totals.total }
          : current,
      );
    }

    if (connection() === "OFFLINE") {
      setQueue((current) => ({
        ...current,
        pending: current.pending + 1,
      }));
    }

    if (connection() === "GRACE") {
      setQueue((current) => ({
        ...current,
        pending: current.pending + 1,
        flagged: current.flagged + 1,
      }));
    }

    setReceipt(sale);
    setCart([]);
    setPaymentMethod(null);
    setCashReceivedSignal(0);
    setPaymentReferenceSignal("");
    setError(null);
    setScreen("RECEIPT");
  };

  const newTransaction = () => {
    setReceipt(null);
    setPaymentMethod(null);
    setCashReceivedSignal(0);
    setPaymentReferenceSignal("");
    setError(null);

    if (connection() === "LOCKED") {
      setScreen("HARD_LOCK");
      return;
    }
    if (!session()) {
      setScreen("LOCK");
      return;
    }

    setScreen(shift()?.status === "OPEN" ? "SELL" : "OPEN_SHIFT");
  };

  const setConnection = (next: PosConnection) => {
    const current = connection();
    if (current === next) return;

    batch(() => {
      setConnectionSignal(next);
      setPaymentMethod(null);
      setCashReceivedSignal(0);
      setPaymentReferenceSignal("");
      setError(null);

      if (next === "LOCKED") {
        setScreen("HARD_LOCK");
        return;
      }

      if (current === "LOCKED") {
        if (device().status !== "ACTIVE") {
          setScreen("ENROLLMENT");
        } else if (next === "ONLINE") {
          setScreen("LOCK");
        } else {
          setScreen("HARD_LOCK");
        }
      }
    });
  };

  const syncNow = () => {
    if (connection() !== "ONLINE") {
      setError("Sinkronisasi membutuhkan koneksi online.");
      return;
    }

    setQueue((current) => ({
      ...current,
      accepted: current.accepted + current.pending,
      pending: 0,
      lastSync: formatSyncTime(),
    }));
    setError(null);
  };

  const saveSettings = (next: Partial<PosSettings>) => {
    setPosSettings((current) => ({ ...current, ...next }));
    setError(null);
  };

  const setSessionRole = (role: UserSession["role"]) => {
    setSession((current) => (current ? { ...current, role } : current));
    setError(null);
  };

  const saleActionTarget = (saleId: string) => {
    if (connection() !== "ONLINE") {
      setError("Retur/void membutuhkan koneksi online.");
      return null;
    }

    const role = session()?.role;
    if (role !== "ADMIN" && role !== "OWNER") {
      setError("Hanya ADMIN/OWNER yang dapat memproses retur/void.");
      return null;
    }

    if (shift()?.status !== "OPEN") {
      setError("Buka shift aktif untuk memproses retur/void.");
      return null;
    }

    const sale = sales().find((item) => item.id === saleId);
    if (!sale || sale.status !== "COMPLETED") {
      setError("Transaksi ini tidak dapat diubah.");
      return null;
    }

    return sale;
  };

  const returnSale = (saleId: string, refundAmount?: number) => {
    const target = saleActionTarget(saleId);
    if (!target) return;

    const refund = refundAmount ?? target.total;
    if (!Number.isFinite(refund) || refund <= 0 || refund > target.total) {
      setError("Jumlah retur tidak valid.");
      return;
    }

    if (target.payments.some((payment) => payment.method === "TUNAI")) {
      setShift((current) =>
        current ? { ...current, refunds: current.refunds + refund } : current,
      );
    }

    setSales((current) =>
      current.map((sale) =>
        sale.id === saleId
          ? { ...sale, status: "PARTIAL_RETURN", refundedAmount: refund }
          : sale,
      ),
    );
    setError(null);
  };

  const voidSale = (saleId: string) => {
    const target = saleActionTarget(saleId);
    if (!target) return;

    if (target.payments.length > 0 || (target.refundedAmount ?? 0) > 0) {
      setError("Void hanya untuk transaksi tanpa pembayaran atau retur.");
      return;
    }

    if (target.payments.some((payment) => payment.method === "TUNAI")) {
      setShift((current) =>
        current
          ? { ...current, refunds: current.refunds + target.total }
          : current,
      );
    }

    setSales((current) =>
      current.map((sale) =>
        sale.id === saleId
          ? { ...sale, status: "VOIDED", refundedAmount: target.total }
          : sale,
      ),
    );
    setError(null);
  };

  const clearError = () => setError(null);

  const totals = createMemo(currentTotals);
  const paymentMethods = createMemo(allowedMethods);
  const deviceStatus = createMemo(() => device().status);
  const categories = createMemo(() => [
    "Semua",
    ...Array.from(new Set(products.map((product) => product.category))),
  ]);

  return {
    state: {
      screen,
      device,
      deviceStatus,
      connection,
      session,
      selectedUser,
      pinError,
      pinAttempts,
      pinLockedUntil,
      shift,
      cart,
      heldCarts,
      sales,
      paymentMethod,
      cashReceived,
      paymentReference,
      receipt,
      queue,
      settings: posSettings,
      error,
      products,
      totals,
      paymentMethods,
      categories,
    },
    actions: {
      approveDevice,
      setDeviceStatus,
      unlockPin,
      unlockWithPassword,
      selectUser,
      lock,
      openShift,
      closeShift,
      addProduct,
      setQuantity,
      removeLine,
      clearCart,
      holdCart,
      recallCart,
      go,
      selectPaymentMethod,
      setCashReceived,
      setPaymentReference,
      completeSale,
      newTransaction,
      setConnection,
      syncNow,
      saveSettings,
      setSessionRole,
      returnSale,
      voidSale,
      clearError,
    },
  };
}

export type PosStore = ReturnType<typeof createPosStore>;
