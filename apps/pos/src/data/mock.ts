import type {
  CartLine,
  HeldCart,
  PosProduct,
  PosProductUnit,
  PosSale,
  PosSettings,
  SyncSnapshot,
  UserSession,
} from "./types";

export const demoUser: UserSession = {
  username: "dewi.lestari",
  name: "Dewi Lestari",
  role: "CASHIER",
};

const unit = (
  id: string,
  name: string,
  conversionQty: number,
  sellingPrice: number,
  barcode: string,
): PosProductUnit => ({ id, name, conversionQty, sellingPrice, barcode });

export const products: PosProduct[] = [
  {
    id: "PRD-001",
    sku: "SMB-BRS-001",
    barcode: "8992761110012",
    name: "Beras Setra Ramos 5kg",
    category: "Sembako",
    stock: 57,
    units: [unit("PU-001", "Karung", 1, 72500, "8992761110012")],
  },
  {
    id: "PRD-002",
    sku: "SMB-MNY-002",
    barcode: "8992775201027",
    name: "Minyak Bimoli 2L",
    category: "Sembako",
    stock: 66,
    units: [
      unit("PU-002", "Pouch", 1, 38500, "8992775201027"),
      unit("PU-012", "Dus", 12, 450000, "8992775201034"),
    ],
  },
  {
    id: "PRD-003",
    sku: "MIE-IND-003",
    barcode: "089686010947",
    name: "Indomie Goreng Spesial",
    category: "Mie instan",
    stock: 405,
    units: [
      unit("PU-005", "Bungkus", 1, 3500, "089686010947"),
      unit("PU-006", "Dus", 40, 138000, "089686010954"),
    ],
  },
  {
    id: "PRD-004",
    sku: "SMB-GLA-004",
    barcode: "8995177101018",
    name: "Gulaku Gula Pasir 1kg",
    category: "Sembako",
    stock: 18,
    units: [
      unit("PU-004", "Bungkus", 1, 18000, "8995177101018"),
      unit("PU-014", "Dus", 20, 360000, "8995177101025"),
    ],
  },
  {
    id: "PRD-005",
    sku: "MNM-KPI-005",
    barcode: "8991002101234",
    name: "Kopi Kapal Api Renceng",
    category: "Minuman",
    stock: 68,
    units: [unit("PU-005", "Renceng", 1, 15500, "8991002101234")],
  },
  {
    id: "PRD-006",
    sku: "SUS-FFG-006",
    barcode: "8992753102211",
    name: "SKM Frisian Flag 545g",
    category: "Sembako",
    stock: 53,
    units: [unit("PU-006", "Pouch", 1, 17500, "8992753102211")],
  },
  {
    id: "PRD-007",
    sku: "BMB-KCP-007",
    barcode: "8999999001124",
    name: "Kecap Bango Refill 520ml",
    category: "Sembako",
    stock: 11,
    units: [unit("PU-007", "Pouch", 1, 25000, "8999999001124")],
  },
  {
    id: "PRD-008",
    sku: "RTG-SLG-008",
    barcode: "8998866200349",
    name: "Sunlight 650ml",
    category: "Rumah tangga",
    stock: 0,
    units: [unit("PU-008", "Pouch", 1, 15000, "8998866200349")],
  },
  {
    id: "PRD-009",
    sku: "MNM-AQU-009",
    barcode: "8886008101053",
    name: "Aqua 600ml (Dus 24)",
    category: "Minuman",
    stock: 42,
    units: [
      unit("PU-009", "Botol", 1, 4000, "8886008101053"),
      unit("PU-019", "Dus", 24, 52000, "8886008101060"),
    ],
  },
  {
    id: "PRD-010",
    sku: "SMB-TLR-010",
    barcode: "2001000000105",
    name: "Telur Ayam Negeri (Tray 30)",
    category: "Sembako",
    stock: 24,
    units: [unit("PU-010", "Tray", 1, 56000, "2001000000105")],
  },
  {
    id: "PRD-011",
    sku: "MNM-TEH-011",
    barcode: "8991002502016",
    name: "Teh Celup Sariwangi isi 100",
    category: "Minuman",
    stock: 37,
    units: [
      unit("PU-011", "Kotak", 1, 9800, "8991002502016"),
      unit("PU-020", "Dus", 24, 235200, "8991002502023"),
    ],
  },
  {
    id: "PRD-012",
    sku: "RTG-LIF-012",
    barcode: "8999999056230",
    name: "Sabun Lifebuoy Total 10",
    category: "Rumah tangga",
    stock: 54,
    units: [unit("PU-021", "Pcs", 1, 5200, "8999999056230")],
  },
];

export const initialSales: PosSale[] = [
  {
    id: "SALE-001",
    invoice: "INV/2026/11/00124",
    time: "2026-11-24T14:30:00+07:00",
    cashier: "Dewi Lestari",
    shiftId: "SHIFT-01",
    items: [
      {
        id: "L-1",
        productId: "PRD-005",
        name: "Kopi Kapal Api Renceng",
        unitId: "PU-005",
        unitName: "Renceng",
        quantity: 2,
        unitPrice: 15500,
        discount: 0,
      },
    ],
    subtotal: 31000,
    discount: 0,
    total: 31000,
    payments: [{ method: "TUNAI", amount: 50000 }],
    change: 19000,
    status: "COMPLETED",
  },
  {
    id: "SALE-002",
    invoice: "INV/2026/11/00123",
    time: "2026-11-24T11:20:00+07:00",
    cashier: "Dewi Lestari",
    shiftId: "SHIFT-01",
    items: [
      {
        id: "L-2",
        productId: "PRD-009",
        name: "Aqua 600ml (Dus 24)",
        unitId: "PU-019",
        unitName: "Dus",
        quantity: 1,
        unitPrice: 52000,
        discount: 0,
      },
    ],
    subtotal: 52000,
    discount: 0,
    total: 52000,
    payments: [{ method: "QRIS", amount: 52000 }],
    change: 0,
    status: "COMPLETED",
  },
];

export const initialHeldCarts: HeldCart[] = [
  {
    id: "HOLD-001",
    label: "Warung Bu Sari",
    lines: [
      {
        id: "H-1",
        productId: "PRD-001",
        name: "Beras Setra Ramos 5kg",
        unitId: "PU-001",
        unitName: "Karung",
        quantity: 2,
        unitPrice: 72500,
        discount: 0,
      },
    ],
    createdAt: "2026-11-24T13:10:00+07:00",
  },
];

export const initialSync: SyncSnapshot = {
  lastSync: "24 Nov 2026, 14:30 WIB",
  pending: 0,
  accepted: 118,
  duplicate: 2,
  flagged: 1,
  rejected: 0,
  quarantine: [],
};

export const settings: PosSettings = {
  paperSize: "80mm",
  autoPrint: false,
  localPin: "4321",
  lockTimeoutMinutes: 5,
};

export const demoCart = (): CartLine[] => [
  {
    id: "CART-1",
    productId: "PRD-003",
    name: "Indomie Goreng Spesial",
    unitId: "PU-005",
    unitName: "Bungkus",
    quantity: 12,
    unitPrice: 3500,
    discount: 0,
  },
  {
    id: "CART-2",
    productId: "PRD-001",
    name: "Beras Setra Ramos 5kg",
    unitId: "PU-001",
    unitName: "Karung",
    quantity: 1,
    unitPrice: 72500,
    discount: 0,
  },
  {
    id: "CART-3",
    productId: "PRD-009",
    name: "Aqua 600ml (Dus 24)",
    unitId: "PU-019",
    unitName: "Dus",
    quantity: 1,
    unitPrice: 52000,
    discount: 0,
  },
];
