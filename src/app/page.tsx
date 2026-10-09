import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { Card, Notice, PageHeader } from "@/components/ui";
import { analyzeProduct, realizedProfit } from "@/lib/analysis";
import { getRepo } from "@/lib/db";
import { formatYen } from "@/lib/format";
import type { ProductStatus } from "@/lib/types";

const IN_STOCK: ProductStatus[] = ["purchased", "at_warehouse", "in_transit", "arrived_jp", "inspected", "ready_to_list"];

export default async function DashboardPage() {
  const repo = await getRepo();
  const [products, settings] = await Promise.all([repo.listProducts(), repo.getSettings()]);
  const rows = products.map((p) => ({ product: p, analysis: analyzeProduct(p, settings) }));

  const candidates = rows.filter((r) => r.product.status === "candidate" || r.product.status === "negotiating");
  const passing = candidates
    .filter((r) => r.analysis.profit.verdict === "pass")
    .sort((a, b) => (b.analysis.profit.profitJpy ?? 0) - (a.analysis.profit.profitJpy ?? 0));
  const inStock = rows.filter((r) => IN_STOCK.includes(r.product.status));
  const listed = rows.filter((r) => r.product.status === "listed");
  const sold = rows.filter((r) => r.product.status === "sold");
  const realizedTotal = sold.reduce((acc, r) => acc + (realizedProfit(r.product, settings) ?? 0), 0);
  const unrecorded = sold.filter((r) => realizedProfit(r.product, settings) == null).length;

  const warnings: string[] = [];
  if (!settings.exchangeRatesUpdatedAt) warnings.push("為替レートがサンプル値のままです");
  if (!settings.buyAndShip.rateTableConfirmed) warnings.push("BUY&SHIPの送料表が未確認のサンプル値です");
  if (!settings.customs.confirmed) warnings.push("関税率が推定値です");

  return (
    <>
      <PageHeader
        title="ダッシュボード"
        description="海外古着の仕入れ候補と在庫・利益の状況"
        actions={<Link href="/products/new" className="btn-primary">＋ 商品を登録</Link>}
      />

      {warnings.length > 0 && (
        <div className="mb-5">
          <Notice>
            利益計算の精度を上げるため、<Link href="/settings" className="underline">設定画面</Link>で確認してください: {warnings.join(" / ")}
          </Notice>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="仕入れ候補" value={`${candidates.length}件`} href="/products?status=candidate" />
        <Stat label="条件クリア" value={`${passing.length}件`} href="/products?verdict=pass" />
        <Stat label="在庫（未出品）" value={`${inStock.length}件`} href="/inventory" />
        <Stat label="出品中" value={`${listed.length}件`} href="/products?status=listed" />
        <Stat label="販売済み" value={`${sold.length}件`} href="/sales" />
        <Stat label="実利益（累計）" value={formatYen(realizedTotal)} href="/sales" sub={unrecorded ? `未記録 ${unrecorded}件` : undefined} />
      </div>

      <Card
        title="利益条件を満たす仕入れ候補（予想利益順）"
        actions={<Link href="/products?verdict=pass&sort=profit" className="text-sm text-blue-600 hover:underline">すべて見る</Link>}
      >
        <p className="mb-3 text-xs text-gray-500">
          登録済みの商品だけを、設定した条件（利益 {formatYen(settings.thresholds.minProfitJpy)} 以上・利益率 {settings.thresholds.minMarginPct}% 以上・仕入れ {formatYen(settings.thresholds.maxPurchaseJpy)} 以下）で絞り込んでいます。AIによるおすすめ評価は Phase 2 で追加予定です。
        </p>
        {passing.length === 0 ? (
          <p className="text-sm text-gray-500">条件を満たす候補はまだありません。</p>
        ) : (
          <div className="space-y-3">
            {passing.slice(0, 10).map(({ product, analysis }) => <ProductCard key={product.id} product={product} analysis={analysis} />)}
          </div>
        )}
      </Card>
    </>
  );
}

function Stat({ label, value, href, sub }: { label: string; value: string; href: string; sub?: string }) {
  return (
    <Link href={href} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:border-blue-300">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-amber-700">{sub}</div>}
    </Link>
  );
}
