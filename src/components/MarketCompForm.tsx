"use client";

import { useActionState, useEffect, useRef } from "react";
import { addMarketComp, type FormState } from "@/app/actions";
import { CONDITION_LABELS, CONDITIONS } from "@/lib/types";
import { FieldError } from "./ui";

export function MarketCompForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addMarketComp, { errors: {} });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.message && Object.keys(state.errors).length === 0) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="grid gap-3 rounded-md bg-gray-50 p-3 sm:grid-cols-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="platform" value="mercari" />
      <div className="sm:col-span-2">
        <label className="label" htmlFor="comp-title">類似商品の商品名 *</label>
        <input id="comp-title" name="title" className="input" placeholder="メルカリで見つけた類似商品" />
        <FieldError message={state.errors.title} />
      </div>
      <div>
        <label className="label" htmlFor="comp-price">価格（円）*</label>
        <input id="comp-price" name="priceJpy" inputMode="numeric" className="input" />
        <FieldError message={state.errors.priceJpy} />
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="sold" defaultChecked /> 売却済み（SOLD）
        </label>
      </div>
      <div>
        <label className="label" htmlFor="comp-size">サイズ</label>
        <input id="comp-size" name="size" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="comp-condition">状態</label>
        <select id="comp-condition" name="condition" className="input" defaultValue="">
          <option value="">未選択</option>
          {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="comp-url">URL（任意）</label>
        <input id="comp-url" name="url" className="input" placeholder="https://jp.mercari.com/item/..." />
        <FieldError message={state.errors.url} />
      </div>
      <div>
        <label className="label" htmlFor="comp-date">確認日</label>
        <input id="comp-date" type="date" name="observedAt" className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="comp-note">メモ</label>
        <input id="comp-note" name="note" className="input" placeholder="型番・年代など比較のポイント" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "追加中…" : "相場データを追加"}</button>
        {state.message && <span className="text-sm text-gray-600">{state.message}</span>}
      </div>
    </form>
  );
}
