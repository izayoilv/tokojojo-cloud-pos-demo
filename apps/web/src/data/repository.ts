import {
  demoPassword,
  payables,
  products,
  sales,
  settings,
  transfers,
  users,
} from "./mock";
import type {
  Payable,
  Product,
  Sale,
  StoreSettings,
  Transfer,
  User,
} from "./types";

const delay = (milliseconds = 180) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const clone = <Value>(value: Value): Value => structuredClone(value);

let localProducts = clone(products);

export const repository = {
  async login(username: string, password: string): Promise<User> {
    await delay();
    const user = users.find(
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

  async listSales(): Promise<Sale[]> {
    await delay();
    return clone(sales);
  },

  async listUsers(): Promise<User[]> {
    await delay();
    return clone(users);
  },

  async listTransfers(): Promise<Transfer[]> {
    await delay();
    return clone(transfers);
  },

  async listPayables(): Promise<Payable[]> {
    await delay();
    return clone(payables);
  },

  async getSettings(): Promise<StoreSettings> {
    await delay();
    return clone(settings);
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
};

export type Repository = typeof repository;
