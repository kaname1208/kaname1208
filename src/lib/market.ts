import type { MarketComp } from "./types";

export type Confidence = "high" | "medium" | "low" | "none";

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "高",
  medium: "中",
  low: "低",
  none: "データなし",
};

export interface MarketSummary {
  medianJpy: number | null;
  minJpy: number | null;
  maxJpy: number | null;
  soldCount: number;
  listedCount: number;
  basis: "sold" | "listed" | "none"; // 中央値の根拠
  confidence: Confidence;
  reasons: string[];
  latestObservedAt: string | null;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 手動登録された相場データから中央値と信頼度を出します。
 * 売却済み価格を優先し、なければ出品中の価格を使います（信頼度は下がります）。
 */
export function summarizeMarket(
  comps: MarketComp[],
  now: Date = new Date(),
): MarketSummary {
  const recentLimit = 90 * DAY_MS;
  const sold = comps.filter((c) => c.sold);
  const listed = comps.filter((c) => !c.sold);
  const reasons: string[] = [];

  const basisComps = sold.length > 0 ? sold : listed;
  const basis = sold.length > 0 ? "sold" : listed.length > 0 ? "listed" : "none";
  const prices = basisComps.map((c) => c.priceJpy);

  const recentSold = sold.filter(
    (c) => now.getTime() - new Date(c.observedAt).getTime() <= recentLimit,
  );

  let confidence: Confidence;
  if (basis === "none") {
    confidence = "none";
    reasons.push("相場データが登録されていません");
  } else if (basis === "listed") {
    confidence = "low";
    reasons.push("売却済みデータがなく、出品中の価格のみで計算しています");
  } else if (recentSold.length >= 5) {
    confidence = "high";
    reasons.push(`直近90日の売却済みデータが${recentSold.length}件あります`);
  } else if (recentSold.length >= 3) {
    confidence = "medium";
    reasons.push(`直近90日の売却済みデータが${recentSold.length}件です`);
  } else {
    confidence = "low";
    reasons.push(
      `直近90日の売却済みデータが${recentSold.length}件と少ないです（3件以上推奨）`,
    );
  }

  if (sold.length > recentSold.length) {
    reasons.push(`${sold.length - recentSold.length}件は90日より古いデータです`);
  }

  const observed = comps.map((c) => c.observedAt).sort();
  return {
    medianJpy: median(prices),
    minJpy: prices.length ? Math.min(...prices) : null,
    maxJpy: prices.length ? Math.max(...prices) : null,
    soldCount: sold.length,
    listedCount: listed.length,
    basis,
    confidence,
    reasons,
    latestObservedAt: observed.length ? observed[observed.length - 1] : null,
  };
}
