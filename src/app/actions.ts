"use server";

// Server Actions: フォームの送信を受け取り、データを保存する処理です（サーバー側で動きます）。
// Phase 1 はローカル専用で認証がありません。インターネットに公開する前に認証を追加します（README参照）。

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { repo } from "@/lib/db";
import { optNum, parseProductForm, parseSettingsForm, type FieldErrors } from "@/lib/forms";
import { CONDITIONS, STATUSES, type Condition, type ProductStatus } from "@/lib/types";
import { normalizeUrl } from "@/lib/url";

export interface FormState {
  errors: FieldErrors;
  message?: string;
  duplicateId?: string;
}

export async function saveProduct(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("id") ?? "") || null;
  const { data, errors } = parseProductForm(fd);
  if (!data) return { errors, message: "入力内容を確認してください" };

  const normalizedUrl = normalizeUrl(data.url);
  const dup = await repo.findByNormalizedUrl(normalizedUrl);
  if (dup && dup.id !== id) {
    return {
      errors: { url: "このURLの商品はすでに登録されています" },
      message: `重複: 「${dup.title}」として登録済みです`,
      duplicateId: dup.id,
    };
  }

  let savedId: string;
  if (id) {
    await repo.updateProduct(id, { ...data, normalizedUrl });
    savedId = id;
  } else {
    savedId = (await repo.createProduct(data, normalizedUrl)).id;
  }
  revalidatePath("/", "layout");
  redirect(`/products/${savedId}`);
}

export async function deleteProduct(fd: FormData) {
  await repo.deleteProduct(String(fd.get("id")));
  revalidatePath("/", "layout");
  redirect("/products");
}

export async function toggleFavorite(fd: FormData) {
  const id = String(fd.get("id"));
  const p = await repo.getProduct(id);
  if (!p) return;
  await repo.updateProduct(id, { favorite: !p.favorite });
  revalidatePath("/", "layout");
}

export async function updateStatus(fd: FormData) {
  const id = String(fd.get("id"));
  const status = String(fd.get("status")) as ProductStatus;
  if (!STATUSES.includes(status)) return;
  await repo.updateProduct(id, { status });
  revalidatePath("/", "layout");
}

export async function saveRecord(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("id"));
  const errors: FieldErrors = {};
  const num = (k: string) => {
    const v = optNum(fd, k);
    if (v != null && (Number.isNaN(v) || v < 0)) {
      errors[k] = "0以上の数値で入力してください";
      return null;
    }
    return v;
  };
  const actualPurchaseJpy = num("actualPurchaseJpy");
  const actualSalePriceJpy = num("actualSalePriceJpy");
  if (Object.keys(errors).length) return { errors, message: "入力内容を確認してください" };
  const date = (k: string) => String(fd.get(k) ?? "").trim() || undefined;
  await repo.updateProduct(id, {
    purchasedAt: date("purchasedAt"),
    actualPurchaseJpy,
    trackingNumber: String(fd.get("trackingNumber") ?? "").trim() || undefined,
    soldAt: date("soldAt"),
    actualSalePriceJpy,
  });
  revalidatePath("/", "layout");
  return { errors: {}, message: "保存しました" };
}

export async function addMarketComp(_prev: FormState, fd: FormData): Promise<FormState> {
  const productId = String(fd.get("productId"));
  const title = String(fd.get("title") ?? "").trim();
  const price = optNum(fd, "priceJpy");
  const errors: FieldErrors = {};
  if (!title) errors.title = "商品名を入力してください";
  if (price == null || Number.isNaN(price) || price <= 0) errors.priceJpy = "価格を入力してください";
  const url = String(fd.get("url") ?? "").trim();
  if (url && !/^https?:\/\//.test(url)) errors.url = "https:// から始まるURLを入力してください";
  if (Object.keys(errors).length) return { errors, message: "入力内容を確認してください" };

  const cond = String(fd.get("condition") ?? "");
  const observed = String(fd.get("observedAt") ?? "");
  await repo.addMarketComp(productId, {
    platform: String(fd.get("platform") ?? "mercari"),
    title,
    priceJpy: price!,
    sold: fd.get("sold") === "on",
    size: String(fd.get("size") ?? "").trim() || undefined,
    condition: CONDITIONS.includes(cond as Condition) ? (cond as Condition) : undefined,
    url: url || undefined,
    observedAt: observed ? new Date(observed).toISOString() : new Date().toISOString(),
    note: String(fd.get("note") ?? "").trim() || undefined,
  });
  revalidatePath("/", "layout");
  return { errors: {}, message: "相場データを追加しました" };
}

export async function deleteMarketComp(fd: FormData) {
  await repo.deleteMarketComp(String(fd.get("productId")), String(fd.get("compId")));
  revalidatePath("/", "layout");
}

export async function saveSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const current = await repo.getSettings();
  const { data, errors } = parseSettingsForm(fd, current);
  if (!data) return { errors, message: "入力内容を確認してください" };
  await repo.saveSettings(data);
  revalidatePath("/", "layout");
  return { errors: {}, message: "設定を保存しました" };
}

/**
 * 無料の為替API（Frankfurter / 欧州中央銀行の参考レート、APIキー不要）から最新レートを取得します。
 * 取得に失敗しても既存のレートはそのまま残ります。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState が前回の状態を渡すため
export async function fetchExchangeRates(_prev: FormState): Promise<FormState> {
  const current = await repo.getSettings();
  const symbols = Object.keys(current.exchangeRates).join(",");
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=JPY&symbols=${symbols}`, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { date: string; rates: Record<string, number> };
    const rates = { ...current.exchangeRates };
    for (const c of Object.keys(rates) as (keyof typeof rates)[]) {
      const perJpy = body.rates[c];
      if (perJpy > 0) rates[c] = Math.round((1 / perJpy) * 100) / 100; // 1外貨 = 何円
    }
    await repo.saveSettings({ ...current, exchangeRates: rates, exchangeRatesUpdatedAt: new Date().toISOString() });
    revalidatePath("/", "layout");
    return { errors: {}, message: `為替レートを更新しました（${body.date} 時点の参考レート）` };
  } catch (e) {
    return { errors: {}, message: `為替レートを取得できませんでした（${(e as Error).message}）。手入力してください。` };
  }
}
