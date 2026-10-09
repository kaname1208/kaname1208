import type { MarketComp, Product, ProductInput, Settings } from "../types";

// 保存先（JSONファイル / Supabase など）を差し替えられるようにするための共通インターフェースです。
export interface Repository {
  listProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  findByNormalizedUrl(normalizedUrl: string): Promise<Product | null>;
  createProduct(input: ProductInput, normalizedUrl: string): Promise<Product>;
  updateProduct(id: string, patch: Partial<Product>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  addMarketComp(productId: string, comp: Omit<MarketComp, "id">): Promise<void>;
  deleteMarketComp(productId: string, compId: string): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
}
