import Link from "next/link";
import { toggleFavorite } from "@/app/actions";
import type { analyzeProduct } from "@/lib/analysis";
import { formatMoney, formatYen } from "@/lib/format";
import { SOURCE_LABELS, STATUS_LABELS, type Product } from "@/lib/types";
import { Badge, CertaintyBadge, VerdictBadge } from "./ui";

export function ProductThumb({ src, alt, size = 64 }: { src?: string; alt: string; size?: number }) {
  if (!src) {
    return (
      <div style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
        画像なし
      </div>
    );
  }
  // 外部サイトの画像URLをそのまま表示します（画像の保存はPhase 2で対応）
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={size} height={size} style={{ width: size, height: size }} className="shrink-0 rounded object-cover" referrerPolicy="no-referrer" />;
}

export function ProductCard({ product, analysis }: { product: Product; analysis: ReturnType<typeof analyzeProduct> }) {
  const r = analysis.profit;
  return (
    <div className="flex gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <ProductThumb src={product.imageUrl} alt={product.title} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge color="blue">{SOURCE_LABELS[product.source]}</Badge>
          <Badge>{STATUS_LABELS[product.status]}</Badge>
          <VerdictBadge value={r.verdict} />
          <CertaintyBadge value={r.certainty} />
        </div>
        <Link href={`/products/${product.id}`} className="mt-1 block truncate font-medium text-gray-900 hover:underline">
          {product.title}
        </Link>
        <div className="text-xs text-gray-500">
          {product.brand}{product.size ? ` / ${product.size}` : ""}
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-5">
          <div><dt className="text-gray-500">仕入れ価格</dt><dd>{formatMoney(product.price, product.currency)}</dd></div>
          <div><dt className="text-gray-500">推定総原価</dt><dd>{formatYen(r.totalPurchaseCostJpy)}</dd></div>
          <div><dt className="text-gray-500">想定売価</dt><dd>{formatYen(r.salePriceJpy)}</dd></div>
          <div><dt className="text-gray-500">予想利益</dt><dd className={r.profitJpy != null && r.profitJpy < 0 ? "text-red-700" : "font-semibold"}>{formatYen(r.profitJpy)}</dd></div>
          <div><dt className="text-gray-500">利益率</dt><dd>{r.marginPct == null ? "—" : `${r.marginPct}%`}</dd></div>
        </dl>
      </div>
      <div className="flex flex-col items-end gap-2">
        <form action={toggleFavorite}>
          <input type="hidden" name="id" value={product.id} />
          <button type="submit" aria-label={product.favorite ? "お気に入り解除" : "お気に入り登録"} className={`text-xl leading-none ${product.favorite ? "text-amber-500" : "text-gray-300 hover:text-amber-400"}`}>
            ★
          </button>
        </form>
        <a href={product.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
          元ページ↗
        </a>
      </div>
    </div>
  );
}
