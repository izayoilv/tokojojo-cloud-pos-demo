import { recordsCashRefund } from "../lib/calc";
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
  LocationCode,
  Opname,
  Payable,
  PaymentMethod,
  Product,
  Purchase,
  PurchaseItem,
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
let localPurchases = clone(purchases);
let localPayables = clone(payables);
let localMovements = clone(stockMovements);
let localSales = clone(sales);

const nextId = (prefix: string, values: Array<{ id: string }>) => {
  const highest = values.reduce((max, value) => {
    const suffix = Number(/(\d+)$/.exec(value.id)?.[1] ?? 0);
    return Number.isFinite(suffix) ? Math.max(max, suffix) : max;
  }, 0);

  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
};

function syncSupplierPayable(supplierName: string): void {
  const name = supplierName.trim();
  const outstanding = localPayables
    .filter((item) => item.supplierName === name)
    .reduce((sum, item) => sum + Math.max(0, item.total - item.paid), 0);
  const existing = localSuppliers.find((supplier) => supplier.name === name);

  if (existing) {
    localSuppliers = localSuppliers.map((supplier) =>
      supplier.name === name ? { ...supplier, payable: outstanding } : supplier,
    );
    return;
  }

  localSuppliers = [
    ...localSuppliers,
    {
      id: nextId("SUP", localSuppliers),
      code: `SUP-${String(localSuppliers.length + 1).padStart(2, "0")}`,
      name,
      contact: "",
      phone: "",
      address: "",
      termDays: 14,
      payable: outstanding,
      active: true,
    },
  ];
}

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
    return clone(localSales);
  },

  async returnSale(
    id: string,
    returns: Array<{ productId: string; quantity: number }>,
    reason: string,
  ): Promise<Sale> {
    await delay();
    const sale = localSales.find((item) => item.id === id);

    if (!sale) {
      throw new Error("Transaksi tidak ditemukan.");
    }

    if (sale.status === "VOIDED" || sale.status === "RETURNED") {
      throw new Error("Transaksi ini tidak dapat diretur.");
    }

    if (!reason.trim()) {
      throw new Error("Alasan retur wajib diisi.");
    }

    if (returns.length === 0) {
      throw new Error("Pilih minimal satu barang untuk diretur.");
    }

    let refund = 0;
    const nextItems = sale.items.map((item) => {
      const request = returns.find(
        (entry) => entry.productId === item.productId,
      );

      if (!request) return item;

      const remaining = item.quantity - item.returned;

      if (
        !Number.isInteger(request.quantity) ||
        request.quantity <= 0 ||
        request.quantity > remaining
      ) {
        throw new Error(
          `Jumlah retur ${item.name} melebihi jumlah yang tersisa.`,
        );
      }

      refund += request.quantity * (item.price - item.discount);

      return { ...item, returned: item.returned + request.quantity };
    });
    const fullyReturned = nextItems.every(
      (item) => item.returned >= item.quantity,
    );
    const updated: Sale = {
      ...sale,
      items: nextItems,
      status: fullyReturned ? "RETURNED" : "PARTIAL_RETURN",
    };
    const now = new Date().toISOString();
    const movementStart = localMovements.length;

    localMovements = [
      ...returns.map((request, index): StockMovement => {
        const item = nextItems.find(
          (entry) => entry.productId === request.productId,
        )!;

        return {
          id: `MOV-${String(movementStart + index + 1).padStart(3, "0")}`,
          time: now,
          productId: item.productId,
          productName: item.name,
          location: "STORE-FRONT",
          type: "RETURN",
          quantity: request.quantity,
          reference: sale.number,
          note: reason.trim(),
          createdBy: "Ko Jojo Halim",
        };
      }),
      ...localMovements,
    ];
    localProducts = localProducts.map((product) => {
      const request = returns.find((entry) => entry.productId === product.id);

      return request
        ? { ...product, storeStock: product.storeStock + request.quantity }
        : product;
    });
    if (refund > 0 && recordsCashRefund(sale.method)) {
      localCashFlows = [
        {
          id: nextId("CF", localCashFlows),
          time: now,
          type: "OUT",
          category: "Retur penjualan",
          method: sale.method,
          amount: refund,
          reference: sale.number,
          source: "AUTO",
          createdBy: "Ko Jojo Halim",
        },
        ...localCashFlows,
      ];
    }
    localSales = localSales.map((item) => (item.id === id ? updated : item));

    return clone(updated);
  },

  async voidSale(id: string, reason: string): Promise<Sale> {
    await delay();
    const sale = localSales.find((item) => item.id === id);

    if (!sale) {
      throw new Error("Transaksi tidak ditemukan.");
    }

    if (sale.status === "VOIDED") {
      throw new Error("Transaksi sudah dibatalkan.");
    }

    if (!reason.trim()) {
      throw new Error("Alasan void wajib diisi.");
    }

    const quantityByProduct = sale.items
      .map((item) => ({
        productId: item.productId,
        quantity: item.quantity - item.returned,
        item,
      }))
      .filter((entry) => entry.quantity > 0);
    const refund = quantityByProduct.reduce(
      (sum, entry) =>
        sum + entry.quantity * (entry.item.price - entry.item.discount),
      0,
    );
    const now = new Date().toISOString();
    const movementStart = localMovements.length;
    const updated: Sale = { ...sale, status: "VOIDED" };

    localSales = localSales.map((item) => (item.id === id ? updated : item));
    localMovements = [
      ...quantityByProduct.map((entry, index): StockMovement => ({
        id: `MOV-${String(movementStart + index + 1).padStart(3, "0")}`,
        time: now,
        productId: entry.productId,
        productName: entry.item.name,
        location: "STORE-FRONT",
        type: "SALE_VOID",
        quantity: entry.quantity,
        reference: sale.number,
        note: reason.trim(),
        createdBy: "Ko Jojo Halim",
      })),
      ...localMovements,
    ];
    localProducts = localProducts.map((product) => {
      const entry = quantityByProduct.find(
        (item) => item.productId === product.id,
      );

      return entry
        ? { ...product, storeStock: product.storeStock + entry.quantity }
        : product;
    });

    if (refund > 0 && recordsCashRefund(sale.method)) {
      localCashFlows = [
        {
          id: nextId("CF", localCashFlows),
          time: now,
          type: "OUT",
          category: "Void penjualan",
          method: sale.method,
          amount: refund,
          reference: sale.number,
          source: "AUTO",
          createdBy: "Ko Jojo Halim",
        },
        ...localCashFlows,
      ];
    }

    return clone(updated);
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
    return clone(localPurchases);
  },

  async createPurchase(input: {
    supplierName: string;
    invoice: string;
    due: string;
    items: PurchaseItem[];
  }): Promise<Purchase> {
    await delay();
    const invoice = input.invoice.trim();

    if (!input.supplierName.trim()) {
      throw new Error("Supplier wajib dipilih.");
    }

    if (!invoice) {
      throw new Error("Faktur supplier wajib diisi.");
    }

    if (
      localPurchases.some(
        (purchase) =>
          purchase.status !== "CANCELLED" &&
          purchase.invoice.toLowerCase() === invoice.toLowerCase(),
      )
    ) {
      throw new Error("Faktur supplier sudah ada.");
    }

    if (input.items.length === 0) {
      throw new Error("Tambahkan minimal satu barang.");
    }

    if (
      input.items.some(
        (item) =>
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0 ||
          !Number.isInteger(item.unitCost) ||
          item.unitCost <= 0,
      )
    ) {
      throw new Error("Jumlah dan harga barang harus valid.");
    }

    const total = input.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0,
    );
    const now = new Date().toISOString();
    const purchase: Purchase = {
      id: nextId("PUR", localPurchases),
      number: `PB/2026/11/${String(localPurchases.length + 15).padStart(3, "0")}`,
      supplierName: input.supplierName.trim(),
      invoice,
      date: now,
      due: input.due,
      total,
      paid: 0,
      status: "RECEIVED",
      payStatus: "UNPAID",
      itemCount: input.items.length,
      items: input.items,
    };

    const movementStart = localMovements.length;
    localPurchases = [purchase, ...localPurchases];
    localMovements = [
      ...input.items.map((item, index): StockMovement => ({
        id: `MOV-${String(movementStart + index + 1).padStart(3, "0")}`,
        time: now,
        productId: item.productId,
        productName: item.productName,
        location: "WH-BACK",
        type: "PURCHASE",
        quantity: item.quantity,
        reference: invoice,
        note: "Pembelian diterima",
        createdBy: "Ko Jojo Halim",
      })),
      ...localMovements,
    ];
    localProducts = localProducts.map((product) => {
      const item = input.items.find((entry) => entry.productId === product.id);

      return item
        ? {
            ...product,
            warehouseStock: product.warehouseStock + item.quantity,
          }
        : product;
    });
    localPayables = [
      {
        id: nextId("PAY", localPayables),
        supplierName: purchase.supplierName,
        invoice,
        due: input.due,
        total,
        paid: 0,
        status: "UNPAID",
      },
      ...localPayables,
    ];
    syncSupplierPayable(purchase.supplierName);

    return clone(purchase);
  },

  async payPurchase(
    id: string,
    amount: number,
    method: PaymentMethod,
  ): Promise<Purchase> {
    await delay();
    const purchase = localPurchases.find((item) => item.id === id);

    if (!purchase) {
      throw new Error("Pembelian tidak ditemukan.");
    }

    if (purchase.status === "CANCELLED") {
      throw new Error("Pembelian yang dibatalkan tidak dapat dibayar.");
    }

    const remaining = purchase.total - purchase.paid;

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Nominal pembayaran harus lebih dari nol.");
    }

    if (amount > remaining) {
      throw new Error("Nominal melebihi sisa hutang.");
    }

    const nextPaid = purchase.paid + amount;
    const payStatus = nextPaid >= purchase.total ? "PAID" : "PARTIAL";
    const updated: Purchase = {
      ...purchase,
      paid: nextPaid,
      payStatus,
    };

    localPurchases = localPurchases.map((item) =>
      item.id === id ? updated : item,
    );
    const payable = localPayables.find(
      (item) => item.invoice === purchase.invoice,
    );

    localPayables = payable
      ? localPayables.map((item) =>
          item.id === payable.id
            ? {
                ...item,
                paid: item.paid + amount,
                status: item.paid + amount >= item.total ? "PAID" : "PARTIAL",
              }
            : item,
        )
      : [
          {
            id: nextId("PAY", localPayables),
            supplierName: purchase.supplierName,
            invoice: purchase.invoice,
            due: purchase.due,
            total: purchase.total,
            paid: nextPaid,
            status: payStatus === "PAID" ? "PAID" : "PARTIAL",
          },
          ...localPayables,
        ];
    syncSupplierPayable(purchase.supplierName);
    localCashFlows = [
      {
        id: nextId("CF", localCashFlows),
        time: new Date().toISOString(),
        type: "OUT",
        category: "Pembayaran hutang",
        method,
        amount,
        reference: purchase.invoice,
        source: "AUTO",
        createdBy: "Ko Jojo Halim",
      },
      ...localCashFlows,
    ];

    return clone(updated);
  },

  async cancelPurchase(id: string): Promise<Purchase> {
    await delay();
    const purchase = localPurchases.find((item) => item.id === id);

    if (!purchase) {
      throw new Error("Pembelian tidak ditemukan.");
    }

    if (purchase.status === "CANCELLED") {
      return clone(purchase);
    }

    if (purchase.paid > 0) {
      throw new Error("Pembelian yang sudah dibayar tidak dapat dibatalkan.");
    }

    if (purchase.status === "RECEIVED") {
      for (const item of purchase.items ?? []) {
        const product = localProducts.find(
          (entry) => entry.id === item.productId,
        );

        if (!product || product.warehouseStock < item.quantity) {
          throw new Error(
            "Stok gudang tidak cukup untuk membatalkan pembelian.",
          );
        }
      }

      localProducts = localProducts.map((product) => {
        const item = purchase.items?.find(
          (entry) => entry.productId === product.id,
        );

        return item
          ? {
              ...product,
              warehouseStock: product.warehouseStock - item.quantity,
            }
          : product;
      });
      const movementStart = localMovements.length;
      localMovements = [
        ...(purchase.items ?? []).map((item, index): StockMovement => ({
          id: `MOV-${String(movementStart + index + 1).padStart(3, "0")}`,
          time: new Date().toISOString(),
          productId: item.productId,
          productName: item.productName,
          location: "WH-BACK",
          type: "PURCHASE_CANCEL",
          quantity: -item.quantity,
          reference: purchase.invoice,
          note: "Pembatalan pembelian",
          createdBy: "Ko Jojo Halim",
        })),
        ...localMovements,
      ];
    }

    localPayables = localPayables.filter(
      (item) => item.invoice !== purchase.invoice,
    );
    syncSupplierPayable(purchase.supplierName);
    const updated: Purchase = { ...purchase, status: "CANCELLED" };
    localPurchases = localPurchases.map((item) =>
      item.id === id ? updated : item,
    );

    return clone(updated);
  },

  async listMovements(): Promise<StockMovement[]> {
    await delay();
    return clone(localMovements);
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

    if (from === to) {
      throw new Error("Lokasi asal dan tujuan harus berbeda.");
    }

    if (items.length === 0) {
      throw new Error("Tambahkan minimal satu barang.");
    }

    const seen = new Set<string>();

    for (const item of items) {
      if (seen.has(item.productId)) {
        throw new Error("Produk tidak boleh duplikat dalam satu mutasi.");
      }
      seen.add(item.productId);

      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error("Jumlah harus berupa angka bulat lebih dari nol.");
      }

      const product = localProducts.find(
        (entry) => entry.id === item.productId,
      );

      if (!product) {
        throw new Error("Produk tidak ditemukan.");
      }

      const reserved = localTransfers
        .filter(
          (transfer) => transfer.status === "PENDING" && transfer.from === from,
        )
        .flatMap((transfer) => transfer.items ?? [])
        .filter((entry) => entry.productId === item.productId)
        .reduce((sum, entry) => sum + entry.quantity, 0);
      const available =
        (from === "WH-BACK" ? product.warehouseStock : product.storeStock) -
        reserved;

      if (item.quantity > available) {
        throw new Error(
          from === "WH-BACK"
            ? "Stok gudang tidak cukup."
            : "Stok toko tidak cukup.",
        );
      }
    }

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
    const transfer = localTransfers.find((item) => item.id === id);

    if (!transfer) {
      throw new Error("Mutasi tidak ditemukan.");
    }

    if (transfer.status !== "PENDING") {
      throw new Error("Hanya mutasi pending yang dapat diselesaikan.");
    }

    const now = new Date().toISOString();
    const movementStart = localMovements.length;
    const items = transfer.items ?? [];

    if (items.length === 0) {
      throw new Error("Mutasi tidak memiliki barang.");
    }

    for (const item of items) {
      const product = localProducts.find(
        (entry) => entry.id === item.productId,
      );

      if (!product) {
        throw new Error("Produk tidak ditemukan.");
      }

      const available =
        transfer.from === "WH-BACK"
          ? product.warehouseStock
          : product.storeStock;

      if (item.quantity > available) {
        throw new Error(
          transfer.from === "WH-BACK"
            ? "Stok gudang tidak cukup."
            : "Stok toko tidak cukup.",
        );
      }
    }

    localProducts = localProducts.map((product) => {
      const item = items.find((entry) => entry.productId === product.id);

      if (!item) return product;

      return {
        ...product,
        warehouseStock:
          transfer.from === "WH-BACK"
            ? product.warehouseStock - item.quantity
            : product.warehouseStock,
        storeStock:
          transfer.from === "STORE-FRONT"
            ? product.storeStock - item.quantity
            : product.storeStock,
      };
    });
    localProducts = localProducts.map((product) => {
      const item = items.find((entry) => entry.productId === product.id);

      if (!item) return product;

      return {
        ...product,
        warehouseStock:
          transfer.to === "WH-BACK"
            ? product.warehouseStock + item.quantity
            : product.warehouseStock,
        storeStock:
          transfer.to === "STORE-FRONT"
            ? product.storeStock + item.quantity
            : product.storeStock,
      };
    });

    const movements: StockMovement[] = items.flatMap((item, index) => [
      {
        id: `MOV-${String(movementStart + index * 2 + 1).padStart(3, "0")}`,
        time: now,
        productId: item.productId,
        productName: item.productName,
        location: transfer.from,
        type: "TRANSFER_OUT",
        quantity: -item.quantity,
        reference: transfer.number,
        note: "Mutasi keluar",
        createdBy: "Ko Jojo Halim",
      },
      {
        id: `MOV-${String(movementStart + index * 2 + 2).padStart(3, "0")}`,
        time: now,
        productId: item.productId,
        productName: item.productName,
        location: transfer.to,
        type: "TRANSFER_IN",
        quantity: item.quantity,
        reference: transfer.number,
        note: "Mutasi masuk",
        createdBy: "Ko Jojo Halim",
      },
    ]);

    localMovements = [...movements, ...localMovements];
    localTransfers = localTransfers.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "COMPLETED",
            completed: now,
            approvedBy: "Ko Jojo Halim",
          }
        : item,
    );
  },

  async cancelTransfer(id: string): Promise<void> {
    await delay();
    const transfer = localTransfers.find((item) => item.id === id);

    if (!transfer) {
      throw new Error("Mutasi tidak ditemukan.");
    }

    if (transfer.status !== "PENDING") {
      throw new Error("Hanya mutasi pending yang dapat dibatalkan.");
    }

    localTransfers = localTransfers.map((item) =>
      item.id === id ? { ...item, status: "CANCELLED" } : item,
    );
  },

  async listOpnames(): Promise<Opname[]> {
    await delay();
    return clone(localOpnames);
  },

  async createOpname(input: {
    location: LocationCode;
    items: Array<{ productId: string; physicalQty: number }>;
  }): Promise<Opname> {
    await delay();

    if (input.items.length === 0) {
      throw new Error("Tambahkan minimal satu produk.");
    }

    const ids = new Set<string>();

    for (const item of input.items) {
      if (ids.has(item.productId)) {
        throw new Error("Produk tidak boleh duplikat.");
      }
      ids.add(item.productId);

      if (!Number.isInteger(item.physicalQty) || item.physicalQty < 0) {
        throw new Error("Jumlah fisik harus angka bulat nol atau lebih.");
      }
    }

    const items = input.items.map((item) => {
      const product = localProducts.find(
        (entry) => entry.id === item.productId,
      );

      if (!product) {
        throw new Error("Produk tidak ditemukan.");
      }

      return {
        productId: product.id,
        productName: product.name,
        systemQty:
          input.location === "WH-BACK"
            ? product.warehouseStock
            : product.storeStock,
        physicalQty: item.physicalQty,
      };
    });
    const opname: Opname = {
      id: nextId("OPN", localOpnames),
      number: `OPN/2026/11/${String(localOpnames.length + 1).padStart(3, "0")}`,
      location: input.location,
      status: "PENDING_REVIEW",
      created: new Date().toISOString(),
      createdBy: "Ko Jojo Halim",
      reviewedBy: null,
      items,
    };

    localOpnames = [opname, ...localOpnames];
    return clone(opname);
  },

  async setOpnameStatus(id: string, status: Opname["status"]): Promise<void> {
    await delay();
    const opname = localOpnames.find((item) => item.id === id);

    if (!opname) {
      throw new Error("Opname tidak ditemukan.");
    }

    if (opname.status !== "PENDING_REVIEW") {
      throw new Error("Status opname tidak dapat diubah.");
    }

    if (status === "APPROVED") {
      const movementStart = localMovements.length;
      const movements: StockMovement[] = [];

      localProducts = localProducts.map((product) => {
        const item = opname.items.find(
          (entry) => entry.productId === product.id,
        );

        if (!item) return product;

        const difference = item.physicalQty - item.systemQty;
        const current =
          opname.location === "WH-BACK"
            ? product.warehouseStock
            : product.storeStock;
        const next = current + difference;

        if (next < 0) {
          throw new Error(
            `Stok ${product.name} tidak cukup untuk menerapkan selisih opname.`,
          );
        }

        if (difference !== 0) {
          movements.push({
            id: `MOV-${String(movementStart + movements.length + 1).padStart(3, "0")}`,
            time: new Date().toISOString(),
            productId: product.id,
            productName: product.name,
            location: opname.location,
            type: "OPNAME",
            quantity: difference,
            reference: opname.number,
            note: "Penyesuaian opname",
            createdBy: "Ko Jojo Halim",
          });
        }

        return opname.location === "WH-BACK"
          ? { ...product, warehouseStock: next }
          : { ...product, storeStock: next };
      });
      localMovements = [...movements, ...localMovements];
    }

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
    return clone(localPayables);
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
