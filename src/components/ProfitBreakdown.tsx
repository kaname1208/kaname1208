import { formatYen } from "@/lib/format";
import type { ProfitResult } from "@/lib/profit";
import { CertaintyBadge, Notice, VerdictBadge } from "./ui";

// 利益計算の内訳表。商品詳細と登録フォームのプレビューで共通に使います。
export function ProfitBreakdown({ result, compact = false }: { result: ProfitResult; compact?: boolean }) {
  const purchase = result.lines.filter((l) => l.group === "purchase");
  const sales = result.lines.filter((l) => l.group === "sales");

  const profitColor =
    result.profitJpy == null ? "text-gray-500" : result.profitJpy >= 0 ? "text-green-700" : "text-red-700";

  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-2 gap-3 ${compact ? "" : "sm:grid-cols-4"}`}>
        <Stat label="想定販売価格" value={formatYen(result.salePriceJpy)}
          sub={result.salePriceSource === "market" ? "相場の中央値" : result.salePriceSource === "manual" ? "手入力" : "未設定"} />
        <Stat label="仕入れ総原価" value={formatYen(result.totalPurchaseCostJpy)} />
        <Stat label="予想利益" value={formatYen(result.profitJpy)} className={profitColor}
          sub={result.certainty === "unknown" ? "未確定（参考値）" : result.certainty === "estimate" ? "推定値を含む" : undefined} />
        <Stat label="利益率" value={result.marginPct == null ? "—" : `${result.marginPct}%`} className={profitColor} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <VerdictBadge value={result.verdict} />
        <span className="text-gray-700">{result.verdictReasons.join(" / ")}</span>
      </div>

      {result.certainty === "unknown" && (
        <Notice color="red">
          未入力の費用があるため、利益は確定できません（未入力項目を0円として計算した参考値で、実際はこれより低くなります）。
          <br />未入力: {result.missing.join("、")}
        </Notice>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            <GroupRow label="仕入れ総原価" total={result.totalPurchaseCostJpy} />
            {purchase.map((l) => <LineRow key={l.key} line={l} />)}
            <GroupRow label="国内販売関連費用" total={result.totalSalesCostJpy} />
            {sales.map((l) => <LineRow key={l.key} line={l} />)}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        予想利益 ＝ 想定販売価格 − 仕入れ総原価 − 国内販売関連費用 ／ 利益率 ＝ 予想利益 ÷ 想定販売価格 × 100
      </p>
    </div>
  );
}

function Stat({ label, value, sub, className = "" }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className="rounded-md bg-gray-50 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-bold whitespace-nowrap ${className}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function GroupRow({ label, total }: { label: string; total: number }) {
  return (
    <tr className="border-b border-gray-300 bg-gray-50 font-semibold">
      <td className="px-2 py-1.5">{label}</td>
      <td />
      <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatYen(total)}</td>
    </tr>
  );
}

function LineRow({ line }: { line: ProfitResult["lines"][number] }) {
  const { label, amountJpy, certainty, note } = line;
  return (
    <tr className="border-b border-gray-100">
      <td className="px-2 py-1.5 pl-4">
        {label}
        {note && <div className="text-xs text-gray-500">{note}</div>}
      </td>
      <td className="px-2 py-1.5"><CertaintyBadge value={certainty} /></td>
      <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">{formatYen(amountJpy)}</td>
    </tr>
  );
}
