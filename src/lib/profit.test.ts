import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import { median, summarizeMarket } from "./market";
import {
  calculateProfit,
  lookupShippingRate,
  maxAllowablePrice,
  negotiationPlan,
  type ProfitInput,
} from "./profit";
import type { MarketComp, Settings } from "./types";
import { detectSource, normalizeUrl } from "./url";

// テスト用の設定（すべて確認済み扱い、計算しやすい値）
const settings: Settings = {
  ...DEFAULT_SETTINGS,
  exchangeRates: { USD: 150, GBP: 200, EUR: 160, AUD: 100, CAD: 110 },
  exchangeRatesUpdatedAt: "2026-10-01T00:00:00Z",
  fxFeePct: 2,
  fxFeeConfirmed: true,
  buyAndShip: {
    rateTable: [
      { maxWeightG: 500, priceJpy: 1000 },
      { maxWeightG: 1000, priceJpy: 2000 },
    ],
    extraPer500gJpy: 500,
    rateTableConfirmed: true,
    proxyFeePct: 6,
    handlingFeeJpy: 0,
  },
  customs: {
    dutyRatePct: 10,
    consumptionTaxPct: 10,
    smallValueExemption: false,
    exemptionThresholdJpy: 10000,
    confirmed: true,
  },
  sales: { platform: "mercari", feePct: 10, domesticShippingJpy: 700, packagingJpy: 100, confirmed: true },
};

const base: ProfitInput = {
  currency: "USD",
  price: 20, // 3,000円
  localShipping: 0,
  localShippingConfirmed: true,
  useProxyPurchase: false,
  weightG: 800,
  weightConfirmed: true,
  consolidatedTotalWeightG: null,
  customsOverrideJpy: null,
  otherCostJpy: 0,
  expectedSalePriceJpy: 12000,
  marketComps: [],
};

const comp = (priceJpy: number, sold = true, observedAt = "2026-10-01T00:00:00Z"): MarketComp => ({
  id: String(priceJpy),
  platform: "mercari",
  title: "x",
  priceJpy,
  sold,
  observedAt,
});

describe("calculateProfit", () => {
  it("BUY&SHIP送料・関税・手数料を含めて利益を計算する", () => {
    const r = calculateProfit(base, settings);
    const get = (k: string) => r.lines.find((l) => l.key === k)?.amountJpy;
    expect(get("item")).toBe(3000);
    expect(get("fxFee")).toBe(60); // 3000 × 2%
    expect(get("intlShipping")).toBe(2000); // 800g → 1000g帯
    expect(get("duty")).toBe(500); // (3000+2000) × 10%
    expect(get("importTax")).toBe(550); // (5000+500) × 10%
    expect(r.totalPurchaseCostJpy).toBe(3000 + 0 + 60 + 0 + 2000 + 500 + 550);
    expect(r.totalSalesCostJpy).toBe(1200 + 700 + 100);
    expect(r.profitJpy).toBe(12000 - 6110 - 2000); // 3890
    expect(r.marginPct).toBe(32.4);
    expect(r.certainty).toBe("estimate"); // 販売価格は常に推定
    expect(r.verdict).toBe("pass");
  });

  it("同梱時は国際送料を重量で按分する", () => {
    const r = calculateProfit({ ...base, weightG: 500, consolidatedTotalWeightG: 2000 }, settings);
    // 2000g → 2000円 (1000g帯) + 1000g超過分 500g×2 = 3000円、その25%
    expect(r.lines.find((l) => l.key === "intlShipping")?.amountJpy).toBe(750);
  });

  it("重量が未入力なら利益は未確定扱い", () => {
    const r = calculateProfit({ ...base, weightG: null }, settings);
    expect(r.certainty).toBe("unknown");
    expect(r.verdict).toBe("undetermined");
    expect(r.missing).toContain("BUY&SHIP 国際送料");
  });

  it("販売価格も相場もなければ利益はnull", () => {
    const r = calculateProfit({ ...base, expectedSalePriceJpy: null }, settings);
    expect(r.profitJpy).toBeNull();
    expect(r.verdict).toBe("undetermined");
  });

  it("想定販売価格が未入力なら相場の中央値を使う", () => {
    const r = calculateProfit(
      { ...base, expectedSalePriceJpy: null, marketComps: [comp(10000), comp(12000), comp(14000)] },
      settings,
    );
    expect(r.salePriceJpy).toBe(12000);
    expect(r.salePriceSource).toBe("market");
  });

  it("少額免税を有効にすると課税価格1万円以下は関税0", () => {
    const r = calculateProfit(base, {
      ...settings,
      customs: { ...settings.customs, smallValueExemption: true },
    });
    expect(r.lines.find((l) => l.key === "duty")?.amountJpy).toBe(0);
  });

  it("関税の実額を入力した場合はそれを使う", () => {
    const r = calculateProfit({ ...base, customsOverrideJpy: 300 }, settings);
    expect(r.lines.find((l) => l.key === "customs")?.amountJpy).toBe(300);
    expect(r.lines.find((l) => l.key === "duty")).toBeUndefined();
  });

  it("利益条件を下回ると fail", () => {
    const r = calculateProfit({ ...base, expectedSalePriceJpy: 8000 }, settings);
    expect(r.verdict).toBe("fail");
  });

  it("仕入れ価格の目安を超えると fail", () => {
    const r = calculateProfit({ ...base, price: 100, expectedSalePriceJpy: 100000 }, settings);
    expect(r.verdict).toBe("fail");
  });
});

describe("lookupShippingRate", () => {
  it("料金表の重量帯を選ぶ", () => {
    expect(lookupShippingRate(300, settings.buyAndShip.rateTable, 500)).toBe(1000);
    expect(lookupShippingRate(500, settings.buyAndShip.rateTable, 500)).toBe(1000);
    expect(lookupShippingRate(501, settings.buyAndShip.rateTable, 500)).toBe(2000);
    expect(lookupShippingRate(1200, settings.buyAndShip.rateTable, 500)).toBe(2500);
  });
});

describe("maxAllowablePrice / negotiationPlan", () => {
  it("最大許容価格では利益条件を満たし、少し上では満たさない", () => {
    const max = maxAllowablePrice(base, settings)!;
    expect(max).toBeGreaterThan(20);
    const at = calculateProfit(base, settings, { priceOverride: max });
    expect(at.profitJpy!).toBeGreaterThanOrEqual(3000);
    expect(at.marginPct!).toBeGreaterThanOrEqual(30);
    const over = calculateProfit(base, settings, { priceOverride: max + 0.5 });
    expect(over.verdict).toBe("fail");
  });

  it("交渉価格は出品価格の75%から、最大90%かつ利益条件以内", () => {
    const plan = negotiationPlan({ ...base, price: 40 }, settings);
    expect(plan.openingOffer).toBeLessThanOrEqual(30);
    expect(plan.maxOffer!).toBeLessThanOrEqual(36);
    expect(plan.maxOffer!).toBeLessThanOrEqual(plan.maxAllowable!);
  });

  it("販売価格がなければ最大価格は出せない", () => {
    expect(maxAllowablePrice({ ...base, expectedSalePriceJpy: null }, settings)).toBeNull();
  });
});

describe("market", () => {
  it("中央値", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3); // 2.5 → 四捨五入
    expect(median([])).toBeNull();
  });

  it("売却済みを優先し、件数で信頼度を決める", () => {
    const now = new Date("2026-10-09T00:00:00Z");
    const s = summarizeMarket([comp(5000), comp(6000), comp(7000), comp(99999, false)], now);
    expect(s.basis).toBe("sold");
    expect(s.medianJpy).toBe(6000);
    expect(s.confidence).toBe("medium");
    expect(summarizeMarket([comp(5000, false)], now).confidence).toBe("low");
    expect(summarizeMarket([], now).confidence).toBe("none");
  });
});

describe("url", () => {
  it("クエリやwwwを除いて正規化する", () => {
    expect(normalizeUrl("https://www.ebay.com/itm/123456789012?hash=abc")).toBe("ebay.com/itm/123456789012");
    expect(normalizeUrl("https://www.ebay.com/itm/Some-Title/123456789012")).toBe("ebay.com/itm/123456789012");
    expect(normalizeUrl("https://www.depop.com/products/user-item-1/")).toBe("depop.com/products/user-item-1");
  });

  it("販売元サイトを判別する", () => {
    expect(detectSource("https://www.depop.com/products/x/")).toBe("depop");
    expect(detectSource("https://www.ebay.co.uk/itm/123456789012")).toBe("ebay");
    expect(detectSource("https://example.com/x")).toBe("other");
  });
});
