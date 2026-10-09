import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SETTINGS } from "../defaults";
import type { MarketComp, Product, ProductInput, Settings } from "../types";
import type { Repository } from "./repository";

interface DbFile {
  products: Product[];
  settings: Settings | null;
}

// 商品と設定は data/db.json に保存されます（Gitには含めません）。
// Vercel など本番環境ではファイルが消えるため、Supabase へ切り替えてください。
export class JsonStore implements Repository {
  private file: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dir = process.env.DATA_DIR ?? path.join(process.cwd(), "data")) {
    this.file = path.join(dir, "db.json");
  }

  private async read(): Promise<DbFile> {
    try {
      return JSON.parse(await readFile(this.file, "utf8")) as DbFile;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return { products: [], settings: null };
      throw e;
    }
  }

  private async write(db: DbFile) {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await rename(tmp, this.file);
  }

  // 同時に書き込んでデータが壊れないよう、変更は1件ずつ順番に処理します
  private mutate<T>(fn: (db: DbFile) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const db = await this.read();
      const result = await fn(db);
      await this.write(db);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async listProducts() {
    const db = await this.read();
    return [...db.products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getProduct(id: string) {
    return (await this.read()).products.find((p) => p.id === id) ?? null;
  }

  async findByNormalizedUrl(normalizedUrl: string) {
    return (await this.read()).products.find((p) => p.normalizedUrl === normalizedUrl) ?? null;
  }

  createProduct(input: ProductInput, normalizedUrl: string) {
    return this.mutate((db) => {
      const now = new Date().toISOString();
      const product: Product = {
        ...input,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        normalizedUrl,
        marketComps: [],
      };
      db.products.push(product);
      return product;
    });
  }

  updateProduct(id: string, patch: Partial<Product>) {
    return this.mutate((db) => {
      const p = db.products.find((x) => x.id === id);
      if (!p) throw new Error("商品が見つかりません");
      Object.assign(p, patch, { id, updatedAt: new Date().toISOString() });
      return p;
    });
  }

  deleteProduct(id: string) {
    return this.mutate((db) => {
      db.products = db.products.filter((p) => p.id !== id);
    });
  }

  addMarketComp(productId: string, comp: Omit<MarketComp, "id">) {
    return this.mutate((db) => {
      const p = db.products.find((x) => x.id === productId);
      if (!p) throw new Error("商品が見つかりません");
      p.marketComps.push({ ...comp, id: randomUUID() });
      p.updatedAt = new Date().toISOString();
    });
  }

  deleteMarketComp(productId: string, compId: string) {
    return this.mutate((db) => {
      const p = db.products.find((x) => x.id === productId);
      if (!p) return;
      p.marketComps = p.marketComps.filter((c) => c.id !== compId);
    });
  }

  async getSettings(): Promise<Settings> {
    const saved = (await this.read()).settings;
    // 新しい設定項目が増えても動くよう、初期値とマージします
    return saved ? mergeSettings(DEFAULT_SETTINGS, saved) : DEFAULT_SETTINGS;
  }

  saveSettings(settings: Settings) {
    return this.mutate((db) => {
      db.settings = settings;
    });
  }
}

function mergeSettings(defaults: Settings, saved: Partial<Settings>): Settings {
  return {
    ...defaults,
    ...saved,
    thresholds: { ...defaults.thresholds, ...saved.thresholds },
    exchangeRates: { ...defaults.exchangeRates, ...saved.exchangeRates },
    buyAndShip: { ...defaults.buyAndShip, ...saved.buyAndShip },
    customs: { ...defaults.customs, ...saved.customs },
    sales: { ...defaults.sales, ...saved.sales },
    negotiation: { ...defaults.negotiation, ...saved.negotiation },
  };
}
