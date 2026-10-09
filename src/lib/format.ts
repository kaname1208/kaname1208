export function formatYen(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n).toLocaleString("ja-JP")}円`;
}

export function formatMoney(n: number | null | undefined, currency: string): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (currency === "JPY") return formatYen(n);
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}
