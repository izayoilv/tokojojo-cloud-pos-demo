export type PosConnection = "ONLINE" | "OFFLINE" | "GRACE" | "LOCKED";

export type PosScreen =
  | "ENROLLMENT"
  | "LOCK"
  | "OPEN_SHIFT"
  | "SELL"
  | "PAYMENT"
  | "RECEIPT"
  | "HISTORY"
  | "CLOSE_SHIFT"
  | "SYNC"
  | "SETTINGS"
  | "HARD_LOCK";

export type DeviceStatus = "PENDING" | "ACTIVE" | "REVOKED";

export type PosDevice = {
  name: string;
  platform: "TAURI";
  status: DeviceStatus;
  enrolledBy?: string;
  requestedAt: string;
  lastCheck: string;
};

export type PaymentMethod =
  "TUNAI" | "QRIS" | "DEBIT" | "TRANSFER" | "CAMPURAN" | "HUTANG";

export type PosProductUnit = {
  id: string;
  name: string;
  conversionQty: number;
  sellingPrice: number;
  barcode: string;
};

export type PosProduct = {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  stock: number;
  units: PosProductUnit[];
};

export type CartLine = {
  id: string;
  productId: string;
  name: string;
  unitId: string;
  unitName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

export type CartTotals = {
  subtotal: number;
  discount: number;
  total: number;
  itemCount: number;
};

export type Payment = {
  method: PaymentMethod;
  amount: number;
  reference?: string;
};

export type SaleStatus = "COMPLETED" | "PARTIAL_RETURN" | "VOIDED";

export type PosSale = {
  id: string;
  invoice: string;
  time: string;
  cashier: string;
  shiftId: string;
  items: CartLine[];
  subtotal: number;
  discount: number;
  total: number;
  payments: Payment[];
  change: number;
  status: SaleStatus;
  customer?: string;
  flaggedForReview?: boolean;
};

export type Shift = {
  id: string;
  userId: string;
  userName: string;
  openedAt: string;
  openingCash: number;
  source: "ONLINE" | "OFFLINE";
  status: "OPEN" | "CLOSED";
  closedAt?: string;
  cashSales: number;
  refunds: number;
  expectedCash?: number;
  actualCash?: number;
  difference?: number;
};

export type HeldCart = {
  id: string;
  label: string;
  lines: CartLine[];
  createdAt: string;
};

export type SyncSnapshot = {
  lastSync: string;
  pending: number;
  accepted: number;
  duplicate: number;
  flagged: number;
  rejected: number;
  quarantine: Array<{ id: string; reason: string }>;
};

export type PosSettings = {
  paperSize: "58mm" | "80mm";
  autoPrint: boolean;
  localPin: string;
  lockTimeoutMinutes: number;
};

export type UserSession = {
  username: string;
  name: string;
  role: "CASHIER" | "ADMIN" | "OWNER";
};
