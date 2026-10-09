"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveProduct, type FormState } from "@/app/actions";
import { calculateProfit, negotiationPlan, type ProfitInput } from "@/lib/profit";
import { formatMoney } from "@/lib/format";
import {
  CONDITION_LABELS,
  CONDITIONS,
  CURRENCIES,
  PRIORITY_BRANDS,
  SOURCE_LABELS,
  SOURCES,
  STATUS_LABELS,
  STATUSES,
  type Product,
  type Settings,
} from "@/lib/types";
import { detectSource } from "@/lib/url";
import { ProfitBreakdown } from "./ProfitBreakdown";
import { Card, FieldError, Notice } from "./ui";

type Values = Record<string, string | boolean>;

function initialValues(p?: Product): Values {
  const s = (v: unknown) => (v == null ? "" : String(v));
  return {
    url: s(p?.url),
    source: p?.source ?? "",
    imageUrl: s(p?.imageUrl),
    title: s(p?.title),
    brand: s(p?.brand),
    category: s(p?.category),
    size: s(p?.size),
    condition: s(p?.condition),
    modelNumber: s(p?.modelNumber),
    notes: s(p?.notes),
    currency: p?.currency ?? "USD",
    price: s(p?.price),
    localShipping: s(p?.localShipping),
    localShippingConfirmed: p?.localShippingConfirmed ?? false,
    useProxyPurchase: p?.useProxyPurchase ?? false,
    weightG: s(p?.weightG),
    weightConfirmed: p?.weightConfirmed ?? false,
    consolidatedTotalWeightG: s(p?.consolidatedTotalWeightG),
    customsOverrideJpy: s(p?.customsOverrideJpy),
    otherCostJpy: p?.otherCostJpy ? String(p.otherCostJpy) : "",
    expectedSalePriceJpy: s(p?.expectedSalePriceJpy),
    status: p?.status ?? "candidate",
    favorite: p?.favorite ?? false,
  };
}

const n = (v: string | boolean) => {
  const t = String(v).replace(/[,\s]/g, "");
  if (t === "") return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
};

export function ProductForm({ settings, product }: { settings: Settings; product?: Product }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProduct, { errors: {} });
  const [v, setV] = useState<Values>(() => initialValues(product));
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target;
    setV((prev) => ({
      ...prev,
      [k]: target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target.value,
    }));
  };

  const detected = v.url ? detectSource(String(v.url)) : null;

  // 入力中の値でリアルタイムに利益を試算
  const preview = useMemo(() => {
    const price = n(v.price);
    if (price == null || price <= 0) return null;
    const input: ProfitInput = {
      currency: v.currency as ProfitInput["currency"],
      price,
      localShipping: n(v.localShipping),
      localShippingConfirmed: Boolean(v.localShippingConfirmed),
      useProxyPurchase: Boolean(v.useProxyPurchase),
      weightG: n(v.weightG),
      weightConfirmed: Boolean(v.weightConfirmed),
      consolidatedTotalWeightG: n(v.consolidatedTotalWeightG),
      customsOverrideJpy: n(v.customsOverrideJpy),
      otherCostJpy: n(v.otherCostJpy) ?? 0,
      expectedSalePriceJpy: n(v.expectedSalePriceJpy),
      marketComps: product?.marketComps ?? [],
    };
    return { result: calculateProfit(input, settings), plan: negotiationPlan(input, settings) };
  }, [v, settings, product?.marketComps]);

  const err = state.errors;

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-[1fr_440px] [&>*]:min-w-0">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="space-y-5">
        {state.message && (
          <Notice color={state.duplicateId ? "amber" : "red"}>
            {state.message}
            {state.duplicateId && (
              <> — <Link className="underline" href={`/products/${state.duplicateId}`}>登録済みの商品を見る</Link></>
            )}
          </Notice>
        )}

        <Card title="1. 仕入れ元">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="url">商品URL（Depop / eBay）*</label>
              <input id="url" name="url" className="input" placeholder="https://www.ebay.com/itm/..." value={String(v.url)} onChange={set("url")} />
              <FieldError message={err.url} />
              <p className="mt-1 text-xs text-gray-500">
                商品情報の自動取得は未対応です（公式に許可された方法のみ実装予定）。ページを見ながら下の項目を入力してください。
              </p>
            </div>
            <div>
              <label className="label" htmlFor="source">販売元サイト</label>
              <select id="source" name="source" className="input" value={String(v.source)} onChange={set("source")}>
                <option value="">URLから自動判定{detected ? `（${SOURCE_LABELS[detected]}）` : ""}</option>
                {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="imageUrl">商品画像URL（任意）</label>
              <input id="imageUrl" name="imageUrl" className="input" placeholder="https://..." value={String(v.imageUrl)} onChange={set("imageUrl")} />
              <FieldError message={err.imageUrl} />
            </div>
          </div>
        </Card>

        <Card title="2. 商品情報">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="title">商品名 *</label>
              <input id="title" name="title" className="input" value={String(v.title)} onChange={set("title")} />
              <FieldError message={err.title} />
            </div>
            <div>
              <label className="label" htmlFor="brand">ブランド *</label>
              <input id="brand" name="brand" list="brands" className="input" value={String(v.brand)} onChange={set("brand")} />
              <datalist id="brands">{PRIORITY_BRANDS.map((b) => <option key={b} value={b} />)}</datalist>
              <FieldError message={err.brand} />
            </div>
            <div>
              <label className="label" htmlFor="category">カテゴリ</label>
              <input id="category" name="category" className="input" placeholder="例: ジャケット" value={String(v.category)} onChange={set("category")} />
            </div>
            <div>
              <label className="label" htmlFor="size">サイズ</label>
              <input id="size" name="size" className="input" placeholder="例: L / W32" value={String(v.size)} onChange={set("size")} />
            </div>
            <div>
              <label className="label" htmlFor="condition">状態</label>
              <select id="condition" name="condition" className="input" value={String(v.condition)} onChange={set("condition")}>
                <option value="">未選択</option>
                {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="modelNumber">型番</label>
              <input id="modelNumber" name="modelNumber" className="input" value={String(v.modelNumber)} onChange={set("modelNumber")} />
            </div>
            <div>
              <label className="label" htmlFor="status">ステータス</label>
              <select id="status" name="status" className="input" value={String(v.status)} onChange={set("status")}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="notes">メモ</label>
              <textarea id="notes" name="notes" rows={2} className="input" value={String(v.notes)} onChange={set("notes")} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="favorite" checked={Boolean(v.favorite)} onChange={set("favorite")} /> お気に入り
            </label>
          </div>
        </Card>

        <Card title="3. 価格・輸入コスト">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="price">出品価格 *</label>
              <div className="flex gap-2">
                <input id="price" name="price" inputMode="decimal" className="input" value={String(v.price)} onChange={set("price")} />
                <select name="currency" aria-label="通貨" className="input w-28" value={String(v.currency)} onChange={set("currency")}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <FieldError message={err.price} />
            </div>
            <div>
              <label className="label" htmlFor="localShipping">現地送料（出品者→BUY&SHIP倉庫）</label>
              <input id="localShipping" name="localShipping" inputMode="decimal" className="input" placeholder="送料無料なら 0" value={String(v.localShipping)} onChange={set("localShipping")} />
              <label className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" name="localShippingConfirmed" checked={Boolean(v.localShippingConfirmed)} onChange={set("localShippingConfirmed")} /> 出品ページで確認済み
              </label>
              <FieldError message={err.localShipping} />
            </div>
            <div>
              <label className="label" htmlFor="weightG">推定重量（g）</label>
              <input id="weightG" name="weightG" inputMode="numeric" className="input" placeholder="例: Tシャツ 250 / パーカー 700" value={String(v.weightG)} onChange={set("weightG")} />
              <label className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" name="weightConfirmed" checked={Boolean(v.weightConfirmed)} onChange={set("weightConfirmed")} /> 倉庫で計量済み
              </label>
              <FieldError message={err.weightG} />
            </div>
            <div>
              <label className="label" htmlFor="consolidatedTotalWeightG">同梱する荷物の合計重量（g・任意）</label>
              <input id="consolidatedTotalWeightG" name="consolidatedTotalWeightG" inputMode="numeric" className="input" placeholder="単独発送なら空欄" value={String(v.consolidatedTotalWeightG)} onChange={set("consolidatedTotalWeightG")} />
              <p className="mt-1 text-xs text-gray-500">入力すると国際送料を重量比で按分します</p>
              <FieldError message={err.consolidatedTotalWeightG} />
            </div>
            <div>
              <label className="label" htmlFor="customsOverrideJpy">関税＋輸入消費税の実額（円・任意）</label>
              <input id="customsOverrideJpy" name="customsOverrideJpy" inputMode="numeric" className="input" placeholder="空欄なら設定の税率で推定" value={String(v.customsOverrideJpy)} onChange={set("customsOverrideJpy")} />
              <FieldError message={err.customsOverrideJpy} />
            </div>
            <div>
              <label className="label" htmlFor="otherCostJpy">その他経費（円）</label>
              <input id="otherCostJpy" name="otherCostJpy" inputMode="numeric" className="input" value={String(v.otherCostJpy)} onChange={set("otherCostJpy")} />
              <FieldError message={err.otherCostJpy} />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="useProxyPurchase" checked={Boolean(v.useProxyPurchase)} onChange={set("useProxyPurchase")} />
              BUY&SHIPの購入代行を使う（手数料 {settings.buyAndShip.proxyFeePct}%）
            </label>
          </div>
        </Card>

        <Card title="4. 国内販売価格">
          <label className="label" htmlFor="expectedSalePriceJpy">想定販売価格（円）</label>
          <input id="expectedSalePriceJpy" name="expectedSalePriceJpy" inputMode="numeric" className="input" placeholder="空欄なら登録した相場の中央値を使用" value={String(v.expectedSalePriceJpy)} onChange={set("expectedSalePriceJpy")} />
          <FieldError message={err.expectedSalePriceJpy} />
          <p className="mt-1 text-xs text-gray-500">
            メルカリの相場（売却済み価格）は、保存後の商品詳細画面で1件ずつ登録できます。
          </p>
        </Card>

        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "保存中…" : product ? "変更を保存" : "この商品を保存"}
          </button>
          <Link href={product ? `/products/${product.id}` : "/products"} className="btn-secondary">キャンセル</Link>
        </div>
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <Card title="利益の試算（リアルタイム）">
          {preview ? (
            <div className="space-y-4">
              <ProfitBreakdown result={preview.result} compact />
              <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">
                <div className="font-semibold">交渉の目安</div>
                <div>交渉開始: {formatMoney(preview.plan.openingOffer, String(v.currency))}</div>
                <div>最大許容価格: {formatMoney(preview.plan.maxOffer, String(v.currency))}</div>
                <div className="text-xs">{preview.plan.note}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">出品価格を入力すると試算が表示されます。</p>
          )}
        </Card>
      </div>
    </form>
  );
}
