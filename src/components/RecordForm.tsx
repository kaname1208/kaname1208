"use client";

import { useActionState } from "react";
import { saveRecord, type FormState } from "@/app/actions";
import type { Product } from "@/lib/types";
import { FieldError } from "./ui";

const day = (iso?: string) => (iso ? iso.slice(0, 10) : "");

// 仕入れ・販売の実績を記録するフォーム
export function RecordForm({ product }: { product: Product }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRecord, { errors: {} });
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={product.id} />
      <div>
        <label className="label" htmlFor="purchasedAt">購入日</label>
        <input id="purchasedAt" type="date" name="purchasedAt" defaultValue={day(product.purchasedAt)} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="actualPurchaseJpy">実際の仕入れ総額（円・送料税込）</label>
        <input id="actualPurchaseJpy" name="actualPurchaseJpy" inputMode="numeric" defaultValue={product.actualPurchaseJpy ?? ""} className="input" />
        <FieldError message={state.errors.actualPurchaseJpy} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="trackingNumber">追跡番号</label>
        <input id="trackingNumber" name="trackingNumber" defaultValue={product.trackingNumber ?? ""} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="soldAt">販売日</label>
        <input id="soldAt" type="date" name="soldAt" defaultValue={day(product.soldAt)} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="actualSalePriceJpy">実際の販売価格（円）</label>
        <input id="actualSalePriceJpy" name="actualSalePriceJpy" inputMode="numeric" defaultValue={product.actualSalePriceJpy ?? ""} className="input" />
        <FieldError message={state.errors.actualSalePriceJpy} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "保存中…" : "実績を保存"}</button>
        {state.message && <span className="text-sm text-gray-600">{state.message}</span>}
      </div>
    </form>
  );
}
