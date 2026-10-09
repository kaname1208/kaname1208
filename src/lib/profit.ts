import { summarizeMarket } from "./market";
import type { Certainty, Product, RateTier, Settings } from "./types";

// 利益計算に必要な商品情報だけを取り出した形（入力フォームのプレビューでも使う）
export type ProfitInput = Pick<
  Product,
  | "currency"
  | "price"
  | "localShipping"
  | "localShippingConfirmed"
  | "useProxyPurchase"
  | "weightG"
  | "weightConfirmed"
  | "consolidatedTotalWeightG"
  | "customsOverrideJpy"
  | "otherCostJpy"
  | "expectedSalePriceJpy"
  | "marketComps"
>;

export interface CostLine {
  key: string;
  label: string;
  group: "purchase" | "sales";
  amountJpy: number | null; // null = 未入力で計算できない
  certainty: Certainty;
  note?: string;
}

export type Verdict = "pass" | "fail" | "undetermined";

export interface ProfitResult {
  lines: CostLine[];
  itemPriceJpy: number;
  totalPurchaseCostJpy: number; // 仕入れ総原価（未入力は0として合算）
  totalSalesCostJpy: number; // 国内販売関連費用
  salePriceJpy: number | null;
  salePriceSource: "manual" | "market" | "none";
  profitJpy: number | null; // 未入力項目を0とした参考値。販売価格が無い場合のみnull
  marginPct: number | null;
  certainty: Certainty; // 結果全体の確からしさ（最も弱いもの）
  missing: string[]; // 未入力の項目名
  verdict: Verdict;
  verdictReasons: string[];
}

const yen = (n: number) => Math.round(n);

export function toJpy(amount: number, currency: Product["currency"], settings: Settings): number {
  if (currency === "JPY") return amount;
  return amount * settings.exchangeRates[currency];
}

/** 重量からBUY&SHIPの料金表で国際送料を求める */
export function lookupShippingRate(
  weightG: number,
  table: RateTier[],
  extraPer500gJpy: number,
): number {
  const sorted = [...table].sort((a, b) => a.maxWeightG - b.maxWeightG);
  if (sorted.length === 0) return 0;
  const tier = sorted.find((t) => weightG <= t.maxWeightG);
  if (tier) return tier.priceJpy;
  const last = sorted[sorted.length - 1];
  const over = weightG - last.maxWeightG;
  return last.priceJpy + Math.ceil(over / 500) * extraPer500gJpy;
}

function weakest(certainties: Certainty[]): Certainty {
  if (certainties.includes("unknown")) return "unknown";
  if (certainties.includes("estimate")) return "estimate";
  return "confirmed";
}

/**
 * 予想利益 ＝ 想定販売価格 − 仕入れ総原価 − 国内販売関連費用
 * 利益率   ＝ 予想利益 ÷ 想定販売価格 × 100
 */
export function calculateProfit(
  input: ProfitInput,
  settings: Settings,
  opts: { priceOverride?: number } = {},
): ProfitResult {
  const price = opts.priceOverride ?? input.price;
  const rateCertainty: Certainty =
    input.currency === "JPY" || settings.exchangeRatesUpdatedAt ? "confirmed" : "estimate";
  const lines: CostLine[] = [];

  // 1. 商品代金
  const itemJpy = yen(toJpy(price, input.currency, settings));
  lines.push({
    key: "item",
    label: "商品代金",
    group: "purchase",
    amountJpy: itemJpy,
    certainty: rateCertainty,
    note:
      input.currency === "JPY"
        ? undefined
        : `${price} ${input.currency} × ${settings.exchangeRates[input.currency]}円` +
          (rateCertainty === "estimate" ? "（為替レート未更新）" : ""),
  });

  // 2. 現地送料
  const localJpy =
    input.localShipping == null ? null : yen(toJpy(input.localShipping, input.currency, settings));
  lines.push({
    key: "localShipping",
    label: "現地送料（出品者→倉庫）",
    group: "purchase",
    amountJpy: localJpy,
    certainty:
      localJpy == null ? "unknown" : input.localShippingConfirmed ? rateCertainty : "estimate",
  });

  const goodsJpy = itemJpy + (localJpy ?? 0);

  // 3. 為替・決済手数料
  lines.push({
    key: "fxFee",
    label: "為替・決済手数料",
    group: "purchase",
    amountJpy: yen((goodsJpy * settings.fxFeePct) / 100),
    certainty: settings.fxFeeConfirmed ? "confirmed" : "estimate",
    note: `${settings.fxFeePct}%`,
  });

  // 4. 購入代行手数料
  lines.push({
    key: "proxyFee",
    label: "購入代行手数料",
    group: "purchase",
    amountJpy: input.useProxyPurchase
      ? yen((goodsJpy * settings.buyAndShip.proxyFeePct) / 100)
      : 0,
    certainty: input.useProxyPurchase ? "estimate" : "confirmed",
    note: input.useProxyPurchase ? `${settings.buyAndShip.proxyFeePct}%` : "利用しない",
  });

  // 5. BUY&SHIP 国際送料（同梱時は重量で按分）
  const bs = settings.buyAndShip;
  let intlJpy: number | null = null;
  let intlNote: string | undefined;
  if (input.weightG != null && input.weightG > 0) {
    const total =
      input.consolidatedTotalWeightG && input.consolidatedTotalWeightG >= input.weightG
        ? input.consolidatedTotalWeightG
        : null;
    if (total) {
      const share = input.weightG / total;
      intlJpy = yen((lookupShippingRate(total, bs.rateTable, bs.extraPer500gJpy) + bs.handlingFeeJpy) * share);
      intlNote = `同梱 ${total}g のうち ${input.weightG}g 分を按分（${Math.round(share * 100)}%）`;
    } else {
      intlJpy = lookupShippingRate(input.weightG, bs.rateTable, bs.extraPer500gJpy) + bs.handlingFeeJpy;
      intlNote = `単独発送 ${input.weightG}g`;
    }
  }
  lines.push({
    key: "intlShipping",
    label: "BUY&SHIP 国際送料",
    group: "purchase",
    amountJpy: intlJpy,
    certainty:
      intlJpy == null
        ? "unknown"
        : bs.rateTableConfirmed && input.weightConfirmed
          ? "confirmed"
          : "estimate",
    note: intlJpy == null ? "重量が未入力です" : intlNote,
  });

  // 6-7. 関税・輸入消費税
  if (input.customsOverrideJpy != null) {
    lines.push({
      key: "customs",
      label: "関税＋輸入消費税（実額）",
      group: "purchase",
      amountJpy: yen(input.customsOverrideJpy),
      certainty: "confirmed",
    });
  } else if (intlJpy == null) {
    lines.push({
      key: "customs",
      label: "関税＋輸入消費税",
      group: "purchase",
      amountJpy: null,
      certainty: "unknown",
      note: "国際送料が決まらないため計算できません",
    });
  } else {
    const c = settings.customs;
    const taxableBase = goodsJpy + intlJpy; // CIF価格（商品＋運賃）を簡易的に使用
    const exempt = c.smallValueExemption && taxableBase <= c.exemptionThresholdJpy;
    const duty = exempt ? 0 : yen((taxableBase * c.dutyRatePct) / 100);
    const tax = exempt ? 0 : yen(((taxableBase + duty) * c.consumptionTaxPct) / 100);
    const certainty: Certainty = c.confirmed ? "confirmed" : "estimate";
    lines.push({
      key: "duty",
      label: "関税",
      group: "purchase",
      amountJpy: duty,
      certainty,
      note: exempt ? "少額免税の対象として計算" : `課税価格 ${taxableBase}円 × ${c.dutyRatePct}%`,
    });
    lines.push({
      key: "importTax",
      label: "輸入消費税",
      group: "purchase",
      amountJpy: tax,
      certainty,
      note: exempt ? "少額免税の対象として計算" : `${c.consumptionTaxPct}%`,
    });
  }

  // その他経費
  lines.push({
    key: "other",
    label: "その他経費",
    group: "purchase",
    amountJpy: yen(input.otherCostJpy || 0),
    certainty: "confirmed",
  });

  // 販売価格
  let salePrice: number | null = null;
  let salePriceSource: ProfitResult["salePriceSource"] = "none";
  let saleCertainty: Certainty = "unknown";
  if (input.expectedSalePriceJpy != null && input.expectedSalePriceJpy > 0) {
    salePrice = yen(input.expectedSalePriceJpy);
    salePriceSource = "manual";
    saleCertainty = "estimate";
  } else {
    const market = summarizeMarket(input.marketComps ?? []);
    if (market.medianJpy != null) {
      salePrice = market.medianJpy;
      salePriceSource = "market";
      saleCertainty = "estimate";
    }
  }

  // 8-10. 国内販売関連費用
  const s = settings.sales;
  const salesCertainty: Certainty = s.confirmed ? "confirmed" : "estimate";
  lines.push({
    key: "salesFee",
    label: "販売手数料",
    group: "sales",
    amountJpy: salePrice == null ? null : yen((salePrice * s.feePct) / 100),
    certainty: salePrice == null ? "unknown" : salesCertainty,
    note: `${s.feePct}%`,
  });
  lines.push({
    key: "domesticShipping",
    label: "国内発送費",
    group: "sales",
    amountJpy: s.domesticShippingJpy,
    certainty: salesCertainty,
  });
  lines.push({
    key: "packaging",
    label: "梱包資材費",
    group: "sales",
    amountJpy: s.packagingJpy,
    certainty: salesCertainty,
  });

  const sum = (group: CostLine["group"]) =>
    lines.filter((l) => l.group === group).reduce((acc, l) => acc + (l.amountJpy ?? 0), 0);
  const totalPurchaseCostJpy = sum("purchase");
  const totalSalesCostJpy = sum("sales");

  const profitJpy =
    salePrice == null ? null : salePrice - totalPurchaseCostJpy - totalSalesCostJpy;
  const marginPct =
    profitJpy == null || !salePrice ? null : Math.round((profitJpy / salePrice) * 1000) / 10;

  const missing = lines.filter((l) => l.amountJpy == null).map((l) => l.label);
  if (salePrice == null) missing.unshift("想定販売価格（または相場データ）");
  const certainty = weakest([...lines.map((l) => l.certainty), saleCertainty]);

  // 仕入れ判断
  const t = settings.thresholds;
  const verdictReasons: string[] = [];
  let failed = false;
  if (itemJpy > t.maxPurchaseJpy) {
    failed = true;
    verdictReasons.push(`商品代金 ${itemJpy.toLocaleString()}円 が目安 ${t.maxPurchaseJpy.toLocaleString()}円 を超えています`);
  }
  if (profitJpy != null && profitJpy < t.minProfitJpy) {
    failed = true;
    verdictReasons.push(`予想利益が最低ライン ${t.minProfitJpy.toLocaleString()}円 未満です`);
  }
  if (marginPct != null && marginPct < t.minMarginPct) {
    failed = true;
    verdictReasons.push(`利益率が最低ライン ${t.minMarginPct}% 未満です`);
  }
  let verdict: Verdict;
  if (failed) {
    verdict = "fail";
  } else if (certainty === "unknown") {
    verdict = "undetermined";
    verdictReasons.push(`未入力の項目があるため判定できません: ${missing.join("、")}`);
  } else {
    verdict = "pass";
    verdictReasons.push("利益額・利益率・仕入れ価格の条件を満たしています");
    if (certainty === "estimate") verdictReasons.push("ただし推定値を含む試算です");
  }

  return {
    lines,
    itemPriceJpy: itemJpy,
    totalPurchaseCostJpy,
    totalSalesCostJpy,
    salePriceJpy: salePrice,
    salePriceSource,
    profitJpy,
    marginPct,
    certainty,
    missing,
    verdict,
    verdictReasons,
  };
}

/**
 * 利益条件（最低利益額・最低利益率・仕入れ目安）を満たす最大の出品価格（現地通貨）を求めます。
 * 関税の免税判定などで計算が段差になるため、二分探索で求めます。
 * 販売価格が不明な場合や、0でも条件を満たせない場合は null。
 */
export function maxAllowablePrice(input: ProfitInput, settings: Settings): number | null {
  const t = settings.thresholds;
  const ok = (p: number) => {
    const r = calculateProfit(input, settings, { priceOverride: p });
    if (r.profitJpy == null || r.marginPct == null) return false;
    return (
      r.profitJpy >= t.minProfitJpy &&
      r.marginPct >= t.minMarginPct &&
      r.itemPriceJpy <= t.maxPurchaseJpy
    );
  };
  if (!ok(0)) return null;
  let lo = 0;
  let hi = Math.max(input.price, 1);
  while (ok(hi)) {
    hi *= 2;
    if (hi > 1e7) break;
  }
  // 現地通貨で 0.01 単位まで
  for (let i = 0; i < 60 && hi - lo > 0.01; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo * 100) / 100;
}

export interface NegotiationPlan {
  listPrice: number;
  openingOffer: number; // 推奨交渉開始価格
  maxOffer: number | null; // 最大許容仕入れ価格（利益条件優先）
  maxAllowable: number | null;
  note: string;
}

/** 交渉価格の目安。利益条件を満たす価格を優先します。 */
export function negotiationPlan(input: ProfitInput, settings: Settings): NegotiationPlan {
  const round = (n: number) => Math.floor(n * 100) / 100;
  const listPrice = input.price;
  const maxAllowable = maxAllowablePrice(input, settings);
  const pctMax = round((listPrice * settings.negotiation.maxPct) / 100);
  let openingOffer = round((listPrice * settings.negotiation.openingPct) / 100);
  let maxOffer: number | null = null;
  let note: string;
  if (maxAllowable == null) {
    note = "販売価格が未設定、または値下げしても利益条件を満たせません。";
  } else {
    maxOffer = Math.min(pctMax, maxAllowable);
    if (maxAllowable >= listPrice) {
      note = "出品価格のままでも利益条件を満たします。";
    } else if (maxAllowable < openingOffer) {
      openingOffer = round(maxAllowable * 0.9);
      note = "利益条件を満たすには大幅な値下げが必要です。見送りも検討してください。";
    } else {
      note = "最大交渉価格を超える場合は利益条件を満たしません。";
    }
  }
  return { listPrice, openingOffer, maxOffer, maxAllowable, note };
}
