import type { Source } from "./types";

/**
 * 重複検出用にURLを正規化します。
 * 例: https://www.ebay.com/itm/123456?hash=abc → ebay.com/itm/123456
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
    let path = u.pathname.replace(/\/+$/, "");
    // eBay: /itm/<タイトル>/<ID> 形式も /itm/<ID> にそろえる
    const ebayId = host.startsWith("ebay.") ? path.match(/\/itm\/(?:[^/]+\/)?(\d{9,})/) : null;
    if (ebayId) path = `/itm/${ebayId[1]}`;
    return `${host}${path}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

export function detectSource(raw: string): Source {
  const n = normalizeUrl(raw);
  if (n.startsWith("depop.com")) return "depop";
  if (/^ebay\.[a-z.]+\//.test(n) || n.startsWith("ebay.")) return "ebay";
  return "other";
}

export function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
