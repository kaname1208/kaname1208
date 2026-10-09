// アプリ全体で使う「データの形」の定義です。
// データベース（JSONファイル / 将来のSupabase）に保存されるのもこの形です。

export const SOURCES = ["depop", "ebay", "other"] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<Source, string> = {
  depop: "Depop",
  ebay: "eBay",
  other: "その他",
};

export const CURRENCIES = ["USD", "GBP", "EUR", "AUD", "CAD", "JPY"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CONDITIONS = [
  "new",
  "like_new",
  "good",
  "fair",
  "poor",
] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
  new: "新品・未使用",
  like_new: "未使用に近い",
  good: "目立った傷や汚れなし",
  fair: "やや傷や汚れあり",
  poor: "傷や汚れあり",
};

export const STATUSES = [
  "candidate",
  "negotiating",
  "purchased",
  "at_warehouse",
  "in_transit",
  "arrived_jp",
  "inspected",
  "ready_to_list",
  "listed",
  "sold",
  "cancelled",
] as const;
export type ProductStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<ProductStatus, string> = {
  candidate: "仕入れ候補",
  negotiating: "交渉中",
  purchased: "購入済み",
  at_warehouse: "海外倉庫到着",
  in_transit: "国際配送中",
  arrived_jp: "国内到着",
  inspected: "検品済み",
  ready_to_list: "出品準備完了",
  listed: "出品中",
  sold: "販売済み",
  cancelled: "キャンセル・返品",
};

export const PRIORITY_BRANDS = [
  "Carhartt",
  "Nike",
  "adidas",
  "Stüssy",
  "Levi's",
  "Dickies",
  "Columbia",
  "L.L.Bean",
];

/**
 * 金額の「確からしさ」。
 * - confirmed: ユーザーが確認した値（請求書・公式料金など）
 * - estimate:  見積もり・設定値からの推定
 * - unknown:   未入力。利益は確定値として扱えない
 */
export type Certainty = "confirmed" | "estimate" | "unknown";

/** メルカリなどで確認した販売相場（手動登録） */
export interface MarketComp {
  id: string;
  platform: string; // 例: "mercari"
  title: string;
  priceJpy: number;
  sold: boolean; // true=売却済み, false=出品中
  size?: string;
  condition?: Condition;
  url?: string;
  observedAt: string; // 相場を確認した日時 (ISO)
  note?: string;
}

export interface Product {
  id: string;
  createdAt: string;
  updatedAt: string;

  // 仕入れ元
  source: Source;
  url: string;
  normalizedUrl: string; // 重複検出用
  imageUrl?: string;

  // 商品情報
  title: string;
  brand: string;
  category?: string;
  size?: string;
  condition?: Condition;
  modelNumber?: string; // 型番
  notes?: string;

  // 価格（現地通貨）
  currency: Currency;
  price: number;
  localShipping: number | null; // 現地送料（出品者→BUY&SHIP倉庫）。null=未入力
  localShippingConfirmed: boolean;

  // 輸入関連
  useProxyPurchase: boolean; // BUY&SHIP購入代行を使うか
  weightG: number | null; // 推定重量(g)。null=未入力
  weightConfirmed: boolean;
  consolidatedTotalWeightG: number | null; // 同梱する荷物の合計重量(g)。null=単独発送
  customsOverrideJpy: number | null; // 関税+輸入消費税の実額（わかっている場合）
  otherCostJpy: number; // その他経費

  // 販売
  expectedSalePriceJpy: number | null; // 想定販売価格。null=相場から自動
  marketComps: MarketComp[];

  // 管理
  status: ProductStatus;
  favorite: boolean;

  // 実績（購入後・販売後に記録）
  purchasedAt?: string;
  actualPurchaseJpy?: number | null; // 実際の仕入れ総額
  trackingNumber?: string;
  soldAt?: string;
  actualSalePriceJpy?: number | null;
}

export type ProductInput = Omit<
  Product,
  "id" | "createdAt" | "updatedAt" | "normalizedUrl" | "marketComps"
>;

export interface RateTier {
  maxWeightG: number;
  priceJpy: number;
}

export interface Settings {
  thresholds: {
    minProfitJpy: number;
    minMarginPct: number;
    maxPurchaseJpy: number;
  };
  /** 1 外貨 = 何円か */
  exchangeRates: Record<Exclude<Currency, "JPY">, number>;
  exchangeRatesUpdatedAt: string | null;
  fxFeePct: number; // 為替・決済手数料(%)
  fxFeeConfirmed: boolean;
  buyAndShip: {
    rateTable: RateTier[]; // 重量帯ごとの国際送料
    extraPer500gJpy: number; // 表の上限を超えた場合 500g ごとの追加料金
    rateTableConfirmed: boolean; // 公式料金で確認済みか
    proxyFeePct: number; // 購入代行手数料(%)
    handlingFeeJpy: number; // 同梱・保険などの1荷物あたり手数料
  };
  customs: {
    dutyRatePct: number; // 関税率（推定）
    consumptionTaxPct: number; // 輸入消費税
    smallValueExemption: boolean; // 課税価格1万円以下の免税を適用するか
    exemptionThresholdJpy: number;
    confirmed: boolean;
  };
  sales: {
    platform: string;
    feePct: number; // 販売手数料
    domesticShippingJpy: number;
    packagingJpy: number;
    confirmed: boolean;
  };
  negotiation: {
    openingPct: number; // 最初の交渉価格 (出品価格の%)
    maxPct: number; // 最大交渉価格 (出品価格の%)
  };
}
