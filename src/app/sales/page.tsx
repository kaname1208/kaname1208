import Link from "next/link";
import { Card, Notice, PageHeader } from "@/components/ui";
import { realizedProfit } from "@/lib/analysis";
import { getRepo } from "@/lib/db";
import { formatDate, formatYen } from "@/lib/format";

export default async function SalesPage() {
  const repo = await getRepo();
  const [products, settings] = await Promise.all([repo.listProducts(), repo.getSettings()]);
  const sold = products
    .filter((p) => p.status === "sold")
    .map((p) => ({ p, profit: realizedProfit(p, settings) }))
    .sort((a, b) => (b.p.soldAt ?? "").localeCompare(a.p.soldAt ?? ""));

  const recorded = sold.filter((s) => s.profit != null);
  const revenue = recorded.reduce((acc, s) => acc + (s.p.actualSalePriceJpy ?? 0), 0);
  const profit = recorded.reduce((acc, s) => acc + (s.profit ?? 0), 0);

  // 月別集計（販売日ベース、日本時間）
  const byMonth = new Map<string, { count: number; revenue: number; profit: number }>();
  for (const s of recorded) {
    const key = s.p.soldAt ? s.p.soldAt.slice(0, 7) : "販売日未入力";
    const m = byMonth.get(key) ?? { count: 0, revenue: 0, profit: 0 };
    m.count += 1;
    m.revenue += s.p.actualSalePriceJpy ?? 0;
    m.profit += s.profit ?? 0;
    byMonth.set(key, m);
  }
  const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <>
      <PageHeader title="売上・利益" description="ステータスが「販売済み」で、実際の仕入れ総額と販売価格を記録した商品を集計します。" />
      {sold.length > recorded.length && (
        <div className="mb-5">
          <Notice>販売済みのうち {sold.length - recorded.length} 件は実績（仕入れ総額・販売価格）が未記録のため集計に含まれていません。</Notice>
        </div>
      )}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Card><div className="text-xs text-gray-500">販売件数</div><div className="text-lg font-bold">{recorded.length}件</div></Card>
        <Card><div className="text-xs text-gray-500">売上合計</div><div className="text-lg font-bold">{formatYen(revenue)}</div></Card>
        <Card><div className="text-xs text-gray-500">実利益合計</div><div className={`text-lg font-bold ${profit >= 0 ? "text-green-700" : "text-red-700"}`}>{formatYen(profit)}</div></Card>
      </div>

      <div className="space-y-5">
        <Card title="月別">
          {months.length === 0 ? <p className="text-sm text-gray-400">データなし</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500"><tr><th className="p-1.5">月</th><th className="p-1.5">件数</th><th className="p-1.5 text-right">売上</th><th className="p-1.5 text-right">実利益</th></tr></thead>
              <tbody>
                {months.map(([m, v]) => (
                  <tr key={m} className="border-t border-gray-100">
                    <td className="p-1.5">{m}</td><td className="p-1.5">{v.count}</td>
                    <td className="p-1.5 text-right tabular-nums">{formatYen(v.revenue)}</td>
                    <td className="p-1.5 text-right tabular-nums">{formatYen(v.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="販売済み商品">
          {sold.length === 0 ? <p className="text-sm text-gray-400">販売済みの商品はまだありません。</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs text-gray-500"><tr><th className="p-1.5">商品</th><th className="p-1.5">販売日</th><th className="p-1.5 text-right">仕入れ総額</th><th className="p-1.5 text-right">販売価格</th><th className="p-1.5 text-right">実利益</th></tr></thead>
                <tbody>
                  {sold.map(({ p, profit: pr }) => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="p-1.5"><Link href={`/products/${p.id}`} className="text-blue-700 hover:underline">{p.title}</Link></td>
                      <td className="p-1.5">{formatDate(p.soldAt)}</td>
                      <td className="p-1.5 text-right tabular-nums">{formatYen(p.actualPurchaseJpy)}</td>
                      <td className="p-1.5 text-right tabular-nums">{formatYen(p.actualSalePriceJpy)}</td>
                      <td className="p-1.5 text-right tabular-nums">{pr == null ? <span className="text-amber-700">未記録</span> : formatYen(pr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
