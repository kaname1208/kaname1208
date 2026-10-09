import {
  CONDITIONS,
  CURRENCIES,
  SOURCES,
  STATUSES,
  type Condition,
  type Currency,
  type ProductInput,
  type Settings,
  type Source,
} from "./types";
import { detectSource, isHttpUrl } from "./url";

// フォームから送られてきた値（文字列）を、型のついたデータに変換・検証します。

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optStr = (fd: FormData, k: string) => str(fd, k) || undefined;

/** 空欄なら null、数値でなければ NaN */
export function optNum(fd: FormData, k: string): number | null {
  const v = str(fd, k).replace(/[,，円¥$£€\s]/g, "");
  if (v === "") return null;
  return Number(v);
}

const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";

function oneOf<T extends string>(list: readonly T[], v: string, fallback: T): T {
  return (list as readonly string[]).includes(v) ? (v as T) : fallback;
}

export type FieldErrors = Record<string, string>;

export function parseProductForm(fd: FormData): { data?: ProductInput; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const url = str(fd, "url");
  if (!url) errors.url = "商品URLを入力してください";
  else if (!isHttpUrl(url)) errors.url = "https:// から始まるURLを入力してください";

  const title = str(fd, "title");
  if (!title) errors.title = "商品名を入力してください";

  const brand = str(fd, "brand");
  if (!brand) errors.brand = "ブランドを入力してください";

  const imageUrl = optStr(fd, "imageUrl");
  if (imageUrl && !isHttpUrl(imageUrl)) errors.imageUrl = "画像URLは https:// から始まるURLを入力してください";

  const price = optNum(fd, "price");
  if (price == null || Number.isNaN(price) || price <= 0) errors.price = "出品価格を正の数で入力してください";

  const nonNeg = (k: string, label: string) => {
    const v = optNum(fd, k);
    if (v != null && (Number.isNaN(v) || v < 0)) {
      errors[k] = `${label}は0以上の数値で入力してください`;
      return null;
    }
    return v;
  };
  const localShipping = nonNeg("localShipping", "現地送料");
  const weightG = nonNeg("weightG", "重量");
  const consolidatedTotalWeightG = nonNeg("consolidatedTotalWeightG", "同梱合計重量");
  const customsOverrideJpy = nonNeg("customsOverrideJpy", "関税・消費税");
  const otherCostJpy = nonNeg("otherCostJpy", "その他経費");
  const expectedSalePriceJpy = nonNeg("expectedSalePriceJpy", "想定販売価格");

  if (weightG != null && consolidatedTotalWeightG != null && consolidatedTotalWeightG < weightG) {
    errors.consolidatedTotalWeightG = "同梱合計重量はこの商品の重量以上にしてください";
  }

  if (Object.keys(errors).length > 0) return { errors };

  const sourceRaw = str(fd, "source");
  const source: Source = sourceRaw ? oneOf(SOURCES, sourceRaw, "other") : detectSource(url);

  return {
    errors,
    data: {
      source,
      url,
      imageUrl,
      title,
      brand,
      category: optStr(fd, "category"),
      size: optStr(fd, "size"),
      condition: str(fd, "condition")
        ? oneOf<Condition>(CONDITIONS, str(fd, "condition"), "good")
        : undefined,
      modelNumber: optStr(fd, "modelNumber"),
      notes: optStr(fd, "notes"),
      currency: oneOf<Currency>(CURRENCIES, str(fd, "currency"), "USD"),
      price: price!,
      localShipping,
      localShippingConfirmed: bool(fd, "localShippingConfirmed"),
      useProxyPurchase: bool(fd, "useProxyPurchase"),
      weightG,
      weightConfirmed: bool(fd, "weightConfirmed"),
      consolidatedTotalWeightG,
      customsOverrideJpy,
      otherCostJpy: otherCostJpy ?? 0,
      expectedSalePriceJpy,
      status: oneOf(STATUSES, str(fd, "status"), "candidate"),
      favorite: bool(fd, "favorite"),
    },
  };
}

export function parseSettingsForm(fd: FormData, current: Settings): { data?: Settings; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const num = (k: string, label: string, fallback: number) => {
    const v = optNum(fd, k);
    if (v == null) return fallback;
    if (Number.isNaN(v) || v < 0) {
      errors[k] = `${label}は0以上の数値で入力してください`;
      return fallback;
    }
    return v;
  };

  // 料金表: "500:1500" の形式で1行ずつ
  const rateTable: Settings["buyAndShip"]["rateTable"] = [];
  for (const line of str(fd, "rateTable").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = line.replace(/[,\s円g]/g, "").match(/^(\d+)[:：](\d+)$/);
    if (!m) {
      errors.rateTable = `料金表の形式が正しくありません: 「${line}」（例: 500:1500）`;
      break;
    }
    rateTable.push({ maxWeightG: Number(m[1]), priceJpy: Number(m[2]) });
  }
  if (!errors.rateTable && rateTable.length === 0) errors.rateTable = "料金表を1行以上入力してください";
  rateTable.sort((a, b) => a.maxWeightG - b.maxWeightG);

  const rates = { ...current.exchangeRates };
  for (const c of Object.keys(rates) as (keyof typeof rates)[]) {
    rates[c] = num(`rate_${c}`, `${c}のレート`, rates[c]);
  }
  const ratesChanged = (Object.keys(rates) as (keyof typeof rates)[]).some(
    (c) => rates[c] !== current.exchangeRates[c],
  );

  const data: Settings = {
    thresholds: {
      minProfitJpy: num("minProfitJpy", "最低予想利益", current.thresholds.minProfitJpy),
      minMarginPct: num("minMarginPct", "最低利益率", current.thresholds.minMarginPct),
      maxPurchaseJpy: num("maxPurchaseJpy", "仕入れ価格の目安", current.thresholds.maxPurchaseJpy),
    },
    exchangeRates: rates,
    exchangeRatesUpdatedAt:
      ratesChanged || bool(fd, "ratesConfirmed")
        ? new Date().toISOString()
        : current.exchangeRatesUpdatedAt,
    fxFeePct: num("fxFeePct", "為替・決済手数料", current.fxFeePct),
    fxFeeConfirmed: bool(fd, "fxFeeConfirmed"),
    buyAndShip: {
      rateTable,
      extraPer500gJpy: num("extraPer500gJpy", "追加料金", current.buyAndShip.extraPer500gJpy),
      rateTableConfirmed: bool(fd, "rateTableConfirmed"),
      proxyFeePct: num("proxyFeePct", "購入代行手数料", current.buyAndShip.proxyFeePct),
      handlingFeeJpy: num("handlingFeeJpy", "荷物ごとの手数料", current.buyAndShip.handlingFeeJpy),
    },
    customs: {
      dutyRatePct: num("dutyRatePct", "関税率", current.customs.dutyRatePct),
      consumptionTaxPct: num("consumptionTaxPct", "輸入消費税率", current.customs.consumptionTaxPct),
      smallValueExemption: bool(fd, "smallValueExemption"),
      exemptionThresholdJpy: num("exemptionThresholdJpy", "免税基準額", current.customs.exemptionThresholdJpy),
      confirmed: bool(fd, "customsConfirmed"),
    },
    sales: {
      platform: str(fd, "platform") || current.sales.platform,
      feePct: num("salesFeePct", "販売手数料", current.sales.feePct),
      domesticShippingJpy: num("domesticShippingJpy", "国内発送費", current.sales.domesticShippingJpy),
      packagingJpy: num("packagingJpy", "梱包資材費", current.sales.packagingJpy),
      confirmed: bool(fd, "salesConfirmed"),
    },
    negotiation: {
      openingPct: num("openingPct", "最初の交渉価格", current.negotiation.openingPct),
      maxPct: num("maxPct", "最大交渉価格", current.negotiation.maxPct),
    },
  };
  if (data.negotiation.openingPct > data.negotiation.maxPct) {
    errors.openingPct = "最初の交渉価格は最大交渉価格以下にしてください";
  }
  return Object.keys(errors).length ? { errors } : { data, errors };
}
