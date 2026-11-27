import {
  demoPassword,
  payables,
  products,
  sales,
  settings,
  transfers,
  users,
} from "./mock";
import {
  auditEvents,
  cashFlows,
  customers,
  devices,
  opnames,
  purchases,
  receiptSettings,
  receivables,
  stockMovements,
  suppliers,
  webSessions,
} from "./mockExtra";
import type {
  AuditEvent,
  CashFlow,
  Customer,
  Device,
  DeviceStatus,
  Opname,
  Payable,
  Product,
  Purchase,
  ReceiptSettings,
  Receivable,
  Sale,
  StockMovement,
  StoreSettings,
  Supplier,
  Transfer,
  TransferItem,
  User,
  WebSession,
} from "./types";

const delay = (milliseconds = 180) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const clone = <Value>(value: Value): Value => structuredClone(value);

let localProducts = clone(products);
let localCustomers = clone(customers);
let localSuppliers = clone(suppliers);
let localTransfers = clone(transfers);
let localCashFlows = clone(cashFlows);
let localDevices = clone(devices);
let localSessions = clone(webSessions);
let localOpnames = clone(opnames);
let localUsers = clone(users);
let localSettings = clone(settings);
let localReceiptSettings = clone(receiptSettings);

export const repository = {
  async login(username: string, password: string): Promise<User> {
    await delay();
    const user = localUsers.find(
      (candidate) => candidate.username === username.trim().toLowerCase(),
    );

    if (!user || !user.active || password !== demoPassword) {
      throw new Error("Nama pengguna atau kata sandi salah");
    }

    return clone(user);
  },

  async listProducts(): Promise<Product[]> {
    await delay();
    return clone(localProducts);
  },

  async saveProduct(product: Product): Promise<Product> {
    await delay();
    const index = localProducts.findIndex((item) => item.id === product.id);
    let saved: Product;

    if (index === -1) {
      saved = {
        ...product,
        id: `PRD-${String(localProducts.length + 1).padStart(3, "0")}`,
      };
      localProducts = [...localProducts, saved];
    } else {
      saved = product;
      localProducts = localProducts.map((item, itemIndex) =>
        itemIndex === index ? saved : item,
      );
    }

    return clone(saved);
  },

  async setProductActive(id: string, active: boolean): Promise<Product | null> {
    await delay();
    localProducts = localProducts.map((item) =>
      item.id === id ? { ...item, active } : item,
    );
    return clone(localProducts.find((item) => item.id === id) ?? null);
  },

  async listSales(): Promise<Sale[]> {
    await delay();
    return clone(sales);
  },

  async listUsers(): Promise<User[]> {
    await delay();
    return clone(localUsers);
  },

  async saveUser(user: User): Promise<User> {
    await delay();
    const index = localUsers.findIndex((item) => item.id === user.id);
    let saved = user;

    if (index === -1) {
      saved = {
        ...user,
        id: `USR-${String(localUsers.length + 1).padStart(2, "0")}`,
      };
      localUsers = [...localUsers, saved];
    } else {
      localUsers = localUsers.map((item, itemIndex) =>
        itemIndex === index ? saved : item,
      );
    }

    return clone(saved);
  },

  async setUserActive(id: string, active: boolean): Promise<void> {
    await delay();
    localUsers = localUsers.map((item) =>
      item.id === id ? { ...item, active } : item,
    );
  },

  async listCustomers(): Promise<Customer[]> {
    await delay();
    return clone(localCustomers);
  },

  async saveCustomer(customer: Customer): Promise<Customer> {
    await delay();
    const index = localCustomers.findIndex((item) => item.id === customer.id);
    let saved = customer;

    if (index === -1) {
      saved = {
        ...customer,
        id: `CUS-${String(localCustomers.length + 1).padStart(3, "0")}`,
      };
      localCustomers = [...localCustomers, saved];
    } else {
      localCustomers = localCustomers.map((item, itemIndex) =>
        itemIndex === index ? saved : item,
      );
    }

    return clone(saved);
  },

  async listSuppliers(): Promise<Supplier[]> {
    await delay();
    return clone(localSuppliers);
  },

  async saveSupplier(supplier: Supplier): Promise<Supplier> {
    await delay();
    const index = localSuppliers.findIndex((item) => item.id === supplier.id);
    let saved = supplier;

    if (index === -1) {
      saved = {
        ...supplier,
        id: `SUP-${String(localSuppliers.length + 1).padStart(2, "0")}`,
      };
      localSuppliers = [...localSuppliers, saved];
    } else {
      localSuppliers = localSuppliers.map((item, itemIndex) =>
        itemIndex === index ? saved : item,
      );
    }

    return clone(saved);
  },

  async listPurchases(): Promise<Purchase[]> {
    await delay();
    return clone(purchases);
  },

  async listMovements(): Promise<StockMovement[]> {
    await delay();
    return clone(stockMovements);
  },

  async listTransfers(): Promise<Transfer[]> {
    await delay();
    return clone(localTransfers);
  },

  async createTransfer(
    from: Transfer["from"],
    to: Transfer["to"],
    items: TransferItem[],
  ): Promise<Transfer> {
    await delay();
    const transfer: Transfer = {
      id: `TRF-${String(localTransfers.length + 1).padStart(3, "0")}`,
      number: `MUT/2026/11/${String(localTransfers.length + 1).padStart(3, "0")}`,
      from,
      to,
      status: "PENDING",
      created: new Date().toISOString(),
      completed: null,
      createdBy: "Ko Jojo Halim",
      approvedBy: null,
      itemCount: items.length,
      items,
    };
    localTransfers = [transfer, ...localTransfers];
    return clone(transfer);
  },

  async completeTransfer(id: string): Promise<void> {
    await delay();
    localTransfers = localTransfers.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "COMPLETED",
            completed: new Date().toISOString(),
            approvedBy: "Ko Jojo Halim",
          }
        : item,
    );
  },

  async cancelTransfer(id: string): Promise<void> {
    await delay();
    localTransfers = localTransfers.map((item) =>
      item.id === id ? { ...item, status: "CANCELLED" } : item,
    );
  },

  async listOpnames(): Promise<Opname[]> {
    await delay();
    return clone(localOpnames);
  },

  async setOpnameStatus(id: string, status: Opname["status"]): Promise<void> {
    await delay();
    localOpnames = localOpnames.map((item) =>
      item.id === id ? { ...item, status, reviewedBy: "Ko Jojo Halim" } : item,
    );
  },

  async listCashFlows(): Promise<CashFlow[]> {
    await delay();
    return clone(localCashFlows);
  },

  async createCashFlow(
    input: Omit<CashFlow, "id" | "source" | "createdBy">,
  ): Promise<CashFlow> {
    await delay();
    const flow: CashFlow = {
      ...input,
      id: `CF-${String(localCashFlows.length + 1).padStart(3, "0")}`,
      source: "MANUAL",
      createdBy: "Ko Jojo Halim",
    };
    localCashFlows = [flow, ...localCashFlows];
    return clone(flow);
  },

  async listReceivables(): Promise<Receivable[]> {
    await delay();
    return clone(receivables);
  },

  async listPayables(): Promise<Payable[]> {
    await delay();
    return clone(payables);
  },

  async listAuditEvents(): Promise<AuditEvent[]> {
    await delay();
    return clone(auditEvents);
  },

  async listDevices(): Promise<Device[]> {
    await delay();
    return clone(localDevices);
  },

  async setDeviceStatus(id: string, status: DeviceStatus): Promise<void> {
    await delay();
    localDevices = localDevices.map((item) =>
      item.id === id ? { ...item, status } : item,
    );
  },

  async listSessions(): Promise<WebSession[]> {
    await delay();
    return clone(localSessions);
  },

  async revokeSession(id: string): Promise<void> {
    await delay();
    localSessions = localSessions.filter((item) => item.id !== id);
  },

  async getSettings(): Promise<StoreSettings> {
    await delay();
    return clone(localSettings);
  },

  async saveSettings(settingsValue: StoreSettings): Promise<StoreSettings> {
    await delay();
    localSettings = settingsValue;
    return clone(localSettings);
  },

  async getReceiptSettings(): Promise<ReceiptSettings> {
    await delay();
    return clone(localReceiptSettings);
  },

  async saveReceiptSettings(value: ReceiptSettings): Promise<ReceiptSettings> {
    await delay();
    localReceiptSettings = value;
    return clone(localReceiptSettings);
  },
};

export type Repository = typeof repository;
