import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteMarketComp, deleteProduct, toggleFavorite, updateStatus } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { MarketCompForm } from "@/components/MarketCompForm";
import { ProductThumb } from "@/components/ProductCard";
import { ProfitBreakdown } from "@/components/ProfitBreakdown";
import { RecordForm } from "@/components/RecordForm";
import { Badge, Card, ConfidenceBadge, Notice, PageHeader } from "@/components/ui";
import { analyzeProduct, realizedProfit } from "@/lib/analysis";
import { getRepo } from "@/lib/db";
import { formatDate, formatMoney, formatYen } from "@/lib/format";
import { CONDITION_LABELS, SOURCE_LABELS, STATUS_LABELS, STATUSES } from "@/lib/types";

export default async function ProductDetailPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const repo = await getRepo();
  const [product, settings] = await Promise.all([repo.getProduct(id), repo.getSettings()]);
  if (!product) notFound();
  const { profit, market, plan } = analyzeProduct(product, settings);
  const realized = realizedProfit(product, settings);
  const comps = [...product.marketComps].sort((a, b) => b.observedAt.localeCompare(a.observedAt));

  return (
    <>
      <PageHeader
        title={product.title}
        description={<>{product.brand}{product.size ? ` / サイズ ${product.size}` : ""} ・ 登録日 {formatDate(product.createdAt)}</>}
        actions={
          <>
            <a href={product.url} target="_blank" rel="noopener noreferrer" className="btn-secondary">出品ページを開く↗</a>
            <Link href={`/products/${product.id}/edit`} className="btn-secondary">編集</Link>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] [&>*]:min-w-0">
        <div className="space-y-5">
          <Card title="利益分析">
            <ProfitBreakdown result={profit} />
          </Card>

          <Card title="メルカリ相場（手動登録）" actions={<ConfidenceBadge value={market.confidence} />}>
            <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div><div className="text-xs text-gray-500">中央値</div><div className="font-semibold">{formatYen(market.medianJpy)}</div></div>
              <div><div className="text-xs text-gray-500">最安〜最高</div><div>{formatYen(market.minJpy)}〜{formatYen(market.maxJpy)}</div></div>
              <div><div className="text-xs text-gray-500">売却済み / 出品中</div><div>{market.soldCount} / {market.listedCount} 件</div></div>
              <div><div className="text-xs text-gray-500">最終確認日</div><div>{formatDate(market.latestObservedAt)}</div></div>
            </div>
            <ul className="mb-3 list-disc pl-5 text-xs text-gray-600">
              {market.reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
            {product.expectedSalePriceJpy != null && market.medianJpy != null && (
              <Notice color="blue">想定販売価格が手入力されているため、利益計算には手入力の {formatYen(product.expectedSalePriceJpy)} を使っています。</Notice>
            )}

            {comps.length > 0 && (
              <div className="my-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left text-xs text-gray-500">
                    <tr><th className="p-1.5">商品名</th><th className="p-1.5">価格</th><th className="p-1.5">状況</th><th className="p-1.5">サイズ・状態</th><th className="p-1.5">確認日</th><th /></tr>
                  </thead>
                  <tbody>
                    {comps.map((c) => (
                      <tr key={c.id} className="border-t border-gray-100">
                        <td className="p-1.5">
                          {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{c.title}</a> : c.title}
                          {c.note && <div className="text-xs text-gray-500">{c.note}</div>}
                        </td>
                        <td className="p-1.5 tabular-nums">{formatYen(c.priceJpy)}</td>
                        <td className="p-1.5">{c.sold ? <Badge color="green">売却済み</Badge> : <Badge>出品中</Badge>}</td>
                        <td className="p-1.5 text-xs">{c.size ?? "—"} / {c.condition ? CONDITION_LABELS[c.condition] : "—"}</td>
                        <td className="p-1.5 text-xs">{formatDate(c.observedAt)}</td>
                        <td className="p-1.5">
                          <form action={deleteMarketComp}>
                            <input type="hidden" name="productId" value={product.id} />
                            <input type="hidden" name="compId" value={c.id} />
                            <button className="text-xs text-red-600 hover:underline" type="submit">削除</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium text-blue-700">＋ 相場データを追加する</summary>
              <p className="my-2 text-xs text-gray-500">
                メルカリで「売り切れ」で絞り込んで確認した価格を入力してください。自動収集はメルカリの規約上行いません。
              </p>
              <MarketCompForm productId={product.id} />
            </details>
          </Card>

          <Card title="仕入れ・販売の実績">
            <RecordForm product={product} />
            {realized != null && (
              <p className="mt-3 text-sm">
                実利益（販売手数料・送料・梱包は設定値で計算）: <span className={`font-bold ${realized >= 0 ? "text-green-700" : "text-red-700"}`}>{formatYen(realized)}</span>
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <div className="flex gap-3">
              <ProductThumb src={product.imageUrl} alt={product.title} size={96} />
              <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-gray-500">仕入れ先</dt><dd>{SOURCE_LABELS[product.source]}</dd>
                <dt className="text-gray-500">出品価格</dt><dd>{formatMoney(product.price, product.currency)}</dd>
                <dt className="text-gray-500">状態</dt><dd>{product.condition ? CONDITION_LABELS[product.condition] : "—"}</dd>
                <dt className="text-gray-500">型番</dt><dd>{product.modelNumber ?? "—"}</dd>
                <dt className="text-gray-500">重量</dt><dd>{product.weightG != null ? `${product.weightG}g` : "未入力"}</dd>
              </dl>
            </div>
            {product.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{product.notes}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={toggleFavorite}>
                <input type="hidden" name="id" value={product.id} />
                <button type="submit" className="btn-secondary">{product.favorite ? "★ お気に入り解除" : "☆ お気に入り"}</button>
              </form>
            </div>
          </Card>

          <Card title="ステータス">
            <form action={updateStatus} className="flex gap-2">
              <input type="hidden" name="id" value={product.id} />
              <select name="status" defaultValue={product.status} className="input" aria-label="ステータス">
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              <button type="submit" className="btn-secondary shrink-0">変更</button>
            </form>
          </Card>

          <Card title="値下げ交渉の目安">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-gray-500">出品価格</dt><dd>{formatMoney(plan.listPrice, product.currency)}</dd>
              <dt className="text-gray-500">交渉開始価格</dt><dd className="font-semibold">{formatMoney(plan.openingOffer, product.currency)}</dd>
              <dt className="text-gray-500">最大許容価格</dt><dd className="font-semibold">{formatMoney(plan.maxOffer, product.currency)}</dd>
              <dt className="text-gray-500">利益条件の上限</dt><dd>{formatMoney(plan.maxAllowable, product.currency)}</dd>
            </dl>
            <p className="mt-2 text-xs text-gray-600">{plan.note}</p>
            <p className="mt-2 text-xs text-gray-400">英文の交渉メッセージ生成は Phase 2 で追加予定です。</p>
          </Card>

          <Card title="削除">
            <form action={deleteProduct}>
              <input type="hidden" name="id" value={product.id} />
              <ConfirmButton message="この商品を削除します。元に戻せません。よろしいですか？" className="btn-danger">この商品を削除</ConfirmButton>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
