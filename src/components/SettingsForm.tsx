"use client";

import { useActionState } from "react";
import { fetchExchangeRates, saveSettings, type FormState } from "@/app/actions";
import { formatDate } from "@/lib/format";
import type { Settings } from "@/lib/types";
import { Card, FieldError, Notice } from "./ui";

function NumField({ name, label, value, unit, error, hint }: {
  name: string; label: string; value: number; unit?: string; error?: string; hint?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <div className="flex items-center gap-2">
        <input id={name} name={name} inputMode="decimal" defaultValue={value} className="input" />
        {unit && <span className="shrink-0 text-sm text-gray-600">{unit}</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} /> {label}
    </label>
  );
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettings, { errors: {} });
  const [rateState, rateAction, ratePending] = useActionState<FormState, FormData>(fetchExchangeRates, { errors: {} });
  const e = state.errors;
  const s = settings;

  return (
    <div className="space-y-5">
      <Card title="為替レート（1外貨 = 何円）">
        <form action={rateAction} className="mb-3 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-secondary" disabled={ratePending}>
            {ratePending ? "取得中…" : "最新の参考レートを取得"}
          </button>
          <span className="text-xs text-gray-500">最終更新: {s.exchangeRatesUpdatedAt ? formatDate(s.exchangeRatesUpdatedAt) : "未更新（サンプル値）"}</span>
          {rateState.message && <span className="text-sm text-gray-700">{rateState.message}</span>}
        </form>
      </Card>

      <form action={action} key={s.exchangeRatesUpdatedAt ?? "init"} className="space-y-5">
        {state.message && <Notice color={Object.keys(e).length ? "red" : "blue"}>{state.message}</Notice>}

        <Card title="為替レートの手入力">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {(Object.keys(s.exchangeRates) as (keyof Settings["exchangeRates"])[]).map((c) => (
              <NumField key={c} name={`rate_${c}`} label={c} value={s.exchangeRates[c]} unit="円" error={e[`rate_${c}`]} />
            ))}
          </div>
          <div className="mt-3"><Check name="ratesConfirmed" label="このレートを確認済みにする（最終更新日を今日にする）" checked={false} /></div>
        </Card>

        <Card title="仕入れ判断の条件">
          <div className="grid gap-4 sm:grid-cols-3">
            <NumField name="minProfitJpy" label="最低予想利益" value={s.thresholds.minProfitJpy} unit="円" error={e.minProfitJpy} />
            <NumField name="minMarginPct" label="最低予想利益率" value={s.thresholds.minMarginPct} unit="%" error={e.minMarginPct} />
            <NumField name="maxPurchaseJpy" label="仕入れ価格の目安（上限）" value={s.thresholds.maxPurchaseJpy} unit="円" error={e.maxPurchaseJpy} />
          </div>
        </Card>

        <Card title="購入時の手数料">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumField name="fxFeePct" label="為替・決済手数料" value={s.fxFeePct} unit="%" error={e.fxFeePct}
              hint="クレジットカードやPayPalの外貨決済手数料（カード会社により1.6〜4%程度）" />
            <NumField name="proxyFeePct" label="BUY&SHIP 購入代行手数料" value={s.buyAndShip.proxyFeePct} unit="%" error={e.proxyFeePct}
              hint="購入代行を使う商品だけに適用されます" />
          </div>
          <div className="mt-3"><Check name="fxFeeConfirmed" label="為替・決済手数料を確認済みにする" checked={s.fxFeeConfirmed} /></div>
        </Card>

        <Card title="BUY&SHIP 国際送料の料金表">
          {!s.buyAndShip.rateTableConfirmed && (
            <div className="mb-3"><Notice>初期値は<strong>未確認のサンプル値</strong>です。BUY&SHIP公式サイト・アプリの送料計算で、利用する倉庫（アメリカ・イギリスなど）→日本の料金を確認して書き換えてください。</Notice></div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="rateTable">重量（g以下）:料金（円）を1行ずつ</label>
              <textarea id="rateTable" name="rateTable" rows={6} className="input font-mono"
                defaultValue={s.buyAndShip.rateTable.map((t) => `${t.maxWeightG}:${t.priceJpy}`).join("\n")} />
              <FieldError message={e.rateTable} />
            </div>
            <div className="space-y-4">
              <NumField name="extraPer500gJpy" label="表の上限を超えた場合の追加料金（500gごと）" value={s.buyAndShip.extraPer500gJpy} unit="円" error={e.extraPer500gJpy} />
              <NumField name="handlingFeeJpy" label="1荷物あたりの手数料（同梱・保険など）" value={s.buyAndShip.handlingFeeJpy} unit="円" error={e.handlingFeeJpy} />
            </div>
          </div>
          <div className="mt-3"><Check name="rateTableConfirmed" label="料金表を公式料金で確認済みにする" checked={s.buyAndShip.rateTableConfirmed} /></div>
        </Card>

        <Card title="関税・輸入消費税（推定用）">
          <Notice color="blue">
            衣類の関税率は素材・製法（ニット/布帛）で異なります。転売目的の輸入は個人使用の特例（課税価格を6割で計算）の対象外です。
            課税価格1万円以下の少額免税は、ニット製衣類などが対象外です。正確な金額は税関または到着時の請求額で確認し、商品ごとに「実額」を入力してください。
          </Notice>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <NumField name="dutyRatePct" label="関税率（目安）" value={s.customs.dutyRatePct} unit="%" error={e.dutyRatePct} />
            <NumField name="consumptionTaxPct" label="輸入消費税" value={s.customs.consumptionTaxPct} unit="%" error={e.consumptionTaxPct} />
            <NumField name="exemptionThresholdJpy" label="少額免税の基準額" value={s.customs.exemptionThresholdJpy} unit="円" error={e.exemptionThresholdJpy} />
          </div>
          <div className="mt-3 space-y-2">
            <Check name="smallValueExemption" label="少額免税を適用して計算する（対象品目のみ）" checked={s.customs.smallValueExemption} />
            <Check name="customsConfirmed" label="税率を確認済みにする" checked={s.customs.confirmed} />
          </div>
        </Card>

        <Card title="国内販売の費用">
          <input type="hidden" name="platform" value={s.sales.platform} />
          <div className="grid gap-4 sm:grid-cols-3">
            <NumField name="salesFeePct" label="販売手数料（メルカリ）" value={s.sales.feePct} unit="%" error={e.salesFeePct} />
            <NumField name="domesticShippingJpy" label="国内発送費" value={s.sales.domesticShippingJpy} unit="円" error={e.domesticShippingJpy}
              hint="例: らくらくメルカリ便の料金（サイズにより異なります）" />
            <NumField name="packagingJpy" label="梱包資材費" value={s.sales.packagingJpy} unit="円" error={e.packagingJpy} />
          </div>
          <div className="mt-3"><Check name="salesConfirmed" label="国内販売の費用を確認済みにする" checked={s.sales.confirmed} /></div>
        </Card>

        <Card title="値下げ交渉">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumField name="openingPct" label="最初の交渉価格（出品価格の）" value={s.negotiation.openingPct} unit="%" error={e.openingPct} />
            <NumField name="maxPct" label="最大交渉価格（出品価格の）" value={s.negotiation.maxPct} unit="%" error={e.maxPct} />
          </div>
          <p className="mt-2 text-xs text-gray-500">利益条件を満たす価格が優先されます。</p>
        </Card>

        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "保存中…" : "設定を保存"}</button>
      </form>
    </div>
  );
}
