export type Role = "OWNER" | "ADMIN" | "CASHIER" | "WAREHOUSE";

export type LocationCode = "WH-BACK" | "STORE-FRONT";

export type User = {
  id: string;
  name: string;
  username: string;
  role: Role;
  email: string;
  phone: string;
  active: boolean;
  lastLogin: string;
};

export type ProductUnit = {
  id: string;
  name: string;
  conversionQty: number;
  sellingPrice: number;
  barcode: string;
};

export type Product = {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  cost: number;
  price: number;
  warehouseStock: number;
  storeStock: number;
  minStock: number;
  minStoreStock: number;
  color: string;
  units?: ProductUnit[];
  active?: boolean;
};

export type SaleItem = {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  cost: number;
  discount: number;
  returned: number;
};

export type SaleStatus = "COMPLETED" | "PARTIAL_RETURN" | "RETURNED" | "VOIDED";
export type PaymentMethod =
  "TUNAI" | "QRIS" | "DEBIT" | "TRANSFER" | "HUTANG" | "CAMPURAN";

export type Sale = {
  id: string;
  number: string;
  time: string;
  cashier: string;
  terminal: string;
  method: PaymentMethod;
  status: SaleStatus;
  received: number;
  paid: number;
  items: SaleItem[];
};

export type TransferItem = {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
};

export type Transfer = {
  id: string;
  number: string;
  from: LocationCode;
  to: LocationCode;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  created: string;
  completed: string | null;
  createdBy: string;
  approvedBy: string | null;
  itemCount: number;
  items?: TransferItem[];
};

export type Payable = {
  id: string;
  supplierName: string;
  invoice: string;
  due: string;
  total: number;
  paid: number;
  status: "PARTIAL" | "UNPAID" | "PAID";
};

export type StoreSettings = {
  name: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  taxId: string;
  receiptSize: string;
  showPrice: boolean;
  defaultLocation: LocationCode;
  lowStockPercent: number;
};

export type SaleTotals = {
  subtotal: number;
  discount: number;
  grandTotal: number;
  cogs: number;
};

export type StockStatus = "AMAN" | "MENIPIS" | "HABIS";

export type SalesKpis = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  margin: number;
};

export type Supplier = {
  id: string;
  code: string;
  name: string;
  contact: string;
  phone: string;
  address: string;
  termDays: number;
  payable: number;
  active: boolean;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  outstanding: number;
  active: boolean;
};

export type PurchaseStatus = "RECEIVED" | "ORDERED" | "CANCELLED";

export type PurchaseItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
};

export type Purchase = {
  id: string;
  number: string;
  supplierName: string;
  invoice: string;
  date: string;
  due: string;
  total: number;
  paid: number;
  status: PurchaseStatus;
  payStatus: "PAID" | "PARTIAL" | "UNPAID";
  itemCount: number;
  items?: PurchaseItem[];
};

export type StockMovementType =
  | "PURCHASE"
  | "PURCHASE_CANCEL"
  | "SALE"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "OPNAME"
  | "RETURN"
  | "SALE_VOID"
  | "ADJUSTMENT";

export type StockMovement = {
  id: string;
  time: string;
  productId: string;
  productName: string;
  location: LocationCode;
  type: StockMovementType;
  quantity: number;
  reference: string;
  note: string;
  createdBy: string;
};

export type CashFlow = {
  id: string;
  time: string;
  type: "IN" | "OUT";
  category: string;
  method: PaymentMethod;
  amount: number;
  reference: string;
  source: "AUTO" | "MANUAL";
  createdBy: string;
};

export type Receivable = {
  id: string;
  customerName: string;
  invoice: string;
  due: string;
  total: number;
  paid: number;
};

export type AuditEvent = {
  id: string;
  time: string;
  actor: string;
  role: Role;
  event: string;
  entity: string;
  summary: string;
};

export type DeviceStatus = "APPROVED" | "PENDING" | "REVOKED";

export type Device = {
  id: string;
  name: string;
  platform: "WEB" | "POS" | "ANDROID";
  status: DeviceStatus;
  lastSeen: string;
};

export type WebSession = {
  id: string;
  device: string;
  created: string;
  lastSeen: string;
  current: boolean;
};

export type ReceiptSettings = {
  paperSize: "58mm" | "80mm";
  showPrice: boolean;
  footer: string;
  autoPrint: boolean;
};

export type OpnameItem = {
  productId: string;
  productName: string;
  systemQty: number;
  physicalQty: number;
};

export type Opname = {
  id: string;
  number: string;
  location: LocationCode;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  created: string;
  createdBy: string;
  reviewedBy: string | null;
  items: OpnameItem[];
};
