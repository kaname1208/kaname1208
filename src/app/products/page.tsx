import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { PageHeader } from "@/components/ui";
import { analyzeProduct } from "@/lib/analysis";
import { getRepo } from "@/lib/db";
import { SOURCE_LABELS, SOURCES, STATUS_LABELS, STATUSES } from "@/lib/types";

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = get("q").toLowerCase();
  const source = get("source");
  const status = get("status");
  const verdict = get("verdict");
  const favorite = get("favorite") === "1";
  const sort = get("sort") || "new";

  const repo = await getRepo();
  const [products, settings] = await Promise.all([repo.listProducts(), repo.getSettings()]);
  let rows = products.map((p) => ({ product: p, analysis: analyzeProduct(p, settings) }));

  rows = rows.filter(({ product: p, analysis: a }) => {
    if (q && ![p.title, p.brand, p.notes, p.modelNumber, p.size].join(" ").toLowerCase().includes(q)) return false;
    if (source && p.source !== source) return false;
    if (status && p.status !== status) return false;
    if (verdict && a.profit.verdict !== verdict) return false;
    if (favorite && !p.favorite) return false;
    return true;
  });
  const num = (v: number | null) => v ?? -Infinity;
  if (sort === "profit") rows.sort((a, b) => num(b.analysis.profit.profitJpy) - num(a.analysis.profit.profitJpy));
  if (sort === "margin") rows.sort((a, b) => num(b.analysis.profit.marginPct) - num(a.analysis.profit.marginPct));

  return (
    <>
      <PageHeader
        title="商品・候補一覧"
        description={`${rows.length} 件 / 全 ${products.length} 件`}
        actions={<Link href="/products/new" className="btn-primary">＋ 商品を登録</Link>}
      />

      <form className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-3 lg:grid-cols-7">
        <input name="q" defaultValue={get("q")} placeholder="キーワード・ブランド" className="input col-span-2 lg:col-span-2" />
        <select name="source" defaultValue={source} className="input" aria-label="販売元">
          <option value="">販売元: すべて</option>
          {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
        </select>
        <select name="status" defaultValue={status} className="input" aria-label="ステータス">
          <option value="">ステータス: すべて</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select name="verdict" defaultValue={verdict} className="input" aria-label="判定">
          <option value="">判定: すべて</option>
          <option value="pass">条件クリア</option>
          <option value="fail">条件未達</option>
          <option value="undetermined">判定不可</option>
        </select>
        <select name="sort" defaultValue={sort} className="input" aria-label="並び順">
          <option value="new">新しい順</option>
          <option value="profit">予想利益が高い順</option>
          <option value="margin">利益率が高い順</option>
        </select>
        <div className="col-span-2 flex items-center gap-3 sm:col-span-3 lg:col-span-1">
          <label className="flex items-center gap-1 text-sm whitespace-nowrap">
            <input type="checkbox" name="favorite" value="1" defaultChecked={favorite} /> ★のみ
          </label>
          <button className="btn-secondary" type="submit">絞り込み</button>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          {products.length === 0 ? (
            <>まだ商品がありません。<Link href="/products/new" className="text-blue-600 underline">最初の商品を登録</Link>しましょう。</>
          ) : "条件に合う商品がありません。"}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map(({ product, analysis }) => <ProductCard key={product.id} product={product} analysis={analysis} />)}
        </div>
      )}
    </>
  );
}
