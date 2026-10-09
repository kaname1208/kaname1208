import Link from "next/link";
import { updateStatus } from "@/app/actions";
import { Card, PageHeader } from "@/components/ui";
import { analyzeProduct } from "@/lib/analysis";
import { getRepo } from "@/lib/db";
import { formatDate, formatYen } from "@/lib/format";
import { STATUS_LABELS, STATUSES, type ProductStatus } from "@/lib/types";

// 購入後〜出品中までの商品をステータスごとに表示します
const FLOW: ProductStatus[] = ["negotiating", "purchased", "at_warehouse", "in_transit", "arrived_jp", "inspected", "ready_to_list", "listed"];

export default async function InventoryPage() {
  const repo = await getRepo();
  const [products, settings] = await Promise.all([repo.listProducts(), repo.getSettings()]);

  return (
    <>
      <PageHeader title="仕入れ・在庫管理" description="交渉中〜出品中の商品。ステータスはここから直接変更できます。" />
      <div className="space-y-5">
        {FLOW.map((status) => {
          const items = products.filter((p) => p.status === status);
          return (
            <Card key={status} title={`${STATUS_LABELS[status]}（${items.length}）`}>
              {items.length === 0 ? (
                <p className="text-sm text-gray-400">なし</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="text-left text-xs text-gray-500">
                      <tr><th className="p-1.5">商品</th><th className="p-1.5">購入日</th><th className="p-1.5">仕入れ額</th><th className="p-1.5">追跡番号</th><th className="p-1.5">ステータス変更</th></tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <tr key={p.id} className="border-t border-gray-100">
                          <td className="p-1.5">
                            <Link href={`/products/${p.id}`} className="text-blue-700 hover:underline">{p.title}</Link>
                            <div className="text-xs text-gray-500">{p.brand}</div>
                          </td>
                          <td className="p-1.5">{formatDate(p.purchasedAt)}</td>
                          <td className="p-1.5 tabular-nums">
                            {p.actualPurchaseJpy != null ? formatYen(p.actualPurchaseJpy) : <span className="text-gray-500">推定 {formatYen(analyzeProduct(p, settings).profit.totalPurchaseCostJpy)}</span>}
                          </td>
                          <td className="p-1.5 font-mono text-xs">{p.trackingNumber ?? "—"}</td>
                          <td className="p-1.5">
                            <form action={updateStatus} className="flex gap-1">
                              <input type="hidden" name="id" value={p.id} />
                              <select name="status" defaultValue={p.status} className="input py-1" aria-label="ステータス">
                                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                              </select>
                              <button type="submit" className="btn-secondary px-2 py-1">変更</button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
