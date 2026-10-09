import type { Settings } from "./types";

// 初期設定値。すべて設定画面から変更できます。
// 「Confirmed: false」の項目は推定値・サンプル値です。必ず公式情報で確認してください。
export const DEFAULT_SETTINGS: Settings = {
  thresholds: {
    minProfitJpy: 3000,
    minMarginPct: 30,
    maxPurchaseJpy: 10000,
  },
  // サンプル値。設定画面の「為替レートを取得」または手入力で更新してください。
  exchangeRates: {
    USD: 150,
    GBP: 200,
    EUR: 165,
    AUD: 100,
    CAD: 110,
  },
  exchangeRatesUpdatedAt: null,
  fxFeePct: 3,
  fxFeeConfirmed: false,
  buyAndShip: {
    // サンプル値（未確認）。BUY&SHIPの公式送料計算で確認して書き換えてください。
    rateTable: [
      { maxWeightG: 500, priceJpy: 1500 },
      { maxWeightG: 1000, priceJpy: 2300 },
      { maxWeightG: 1500, priceJpy: 3100 },
      { maxWeightG: 2000, priceJpy: 3900 },
    ],
    extraPer500gJpy: 800,
    rateTableConfirmed: false,
    // BUY&SHIP日本語ヘルプ記載の購入代行手数料（商品代金の6%）。変更があれば修正してください。
    proxyFeePct: 6,
    handlingFeeJpy: 0,
  },
  customs: {
    // 衣類の関税率は品目・素材で異なります（目安として10%を仮置き）。
    dutyRatePct: 10,
    consumptionTaxPct: 10,
    // 少額免税はニット製衣類などが対象外になるため、初期値は「適用しない」（保守的）
    smallValueExemption: false,
    exemptionThresholdJpy: 10000,
    confirmed: false,
  },
  sales: {
    platform: "mercari",
    feePct: 10,
    domesticShippingJpy: 750,
    packagingJpy: 100,
    confirmed: false,
  },
  negotiation: {
    openingPct: 75,
    maxPct: 90,
  },
};
