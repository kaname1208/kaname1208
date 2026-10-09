import { summarizeMarket } from "./market";
import { calculateProfit, negotiationPlan } from "./profit";
import type { Product, Settings } from "./types";

/** 1商品分の分析（利益・相場・交渉目安）をまとめて計算します */
export function analyzeProduct(product: Product, settings: Settings) {
  return {
    profit: calculateProfit(product, settings),
    market: summarizeMarket(product.marketComps),
    plan: negotiationPlan(product, settings),
  };
}

/**
 * 販売済み商品の実利益。
 * 実際の販売価格 − 実際の仕入れ総額 − 国内販売関連費用（手数料・送料・梱包は設定値）
 * どちらかが未記録なら null。
 */
export function realizedProfit(product: Product, settings: Settings): number | null {
  if (product.actualSalePriceJpy == null || product.actualPurchaseJpy == null) return null;
  const s = settings.sales;
  const salesCost = Math.round((product.actualSalePriceJpy * s.feePct) / 100) + s.domesticShippingJpy + s.packagingJpy;
  return product.actualSalePriceJpy - product.actualPurchaseJpy - salesCost;
}
