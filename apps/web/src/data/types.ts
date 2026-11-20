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

export type SaleStatus = "COMPLETED" | "PARTIAL_RETURN";
export type PaymentMethod = "TUNAI" | "QRIS" | "DEBIT";

export type Sale = {
  id: string;
  number: string;
  time: string;
  cashier: string;
  terminal: string;
  method: PaymentMethod;
  status: SaleStatus;
  received: number;
  items: SaleItem[];
};

export type Transfer = {
  id: string;
  number: string;
  from: LocationCode;
  to: LocationCode;
  status: "PENDING" | "COMPLETED";
  created: string;
  completed: string | null;
  createdBy: string;
  approvedBy: string | null;
  itemCount: number;
};

export type Payable = {
  id: string;
  supplierName: string;
  invoice: string;
  due: string;
  total: number;
  paid: number;
  status: "PARTIAL" | "UNPAID";
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
