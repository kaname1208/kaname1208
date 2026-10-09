"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const items = [
  { href: "/", label: "ダッシュボード" },
  { href: "/products", label: "商品・候補一覧" },
  { href: "/products/new", label: "商品を登録" },
  { href: "/inventory", label: "仕入れ・在庫" },
  { href: "/sales", label: "売上・利益" },
  { href: "/settings", label: "設定" },
];

// Phase 2 以降で作る画面（まだ未実装）
const upcoming = ["AI値下げ交渉", "写真→出品文章"];

// 現在のURL（usePathname）はリクエスト時にしか分からないため、Suspense で囲みます
export function Nav() {
  return (
    <Suspense fallback={<NavView pathname="" />}>
      <CurrentNav />
    </Suspense>
  );
}

function CurrentNav() {
  return <NavView pathname={usePathname()} />;
}

function NavView({ pathname }: { pathname: string }) {
  const active = (href: string) => {
    if (href === "/products") return pathname === href || (pathname.startsWith("/products/") && pathname !== "/products/new");
    return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav className="border-b border-gray-200 bg-white md:sticky md:top-0 md:h-screen md:self-start md:overflow-y-auto md:w-56 md:shrink-0 md:border-r md:border-b-0">
      <div className="px-4 py-3 md:py-5">
        <Link href="/" className="font-bold text-gray-900">AI Resell Assistant</Link>
        <p className="hidden text-xs text-gray-500 md:block">海外古着 → 国内販売</p>
      </div>
      <ul className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible md:pb-0">
        {items.map((it) => (
          <li key={it.href} className="shrink-0">
            <Link
              href={it.href}
              className={`block rounded-md px-3 py-2 text-sm ${
                active(it.href) ? "bg-blue-50 font-semibold text-blue-700" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden px-4 pt-4 md:block">
        <p className="text-xs font-semibold text-gray-400">Phase 2 で追加予定</p>
        <ul className="mt-1 space-y-1">
          {upcoming.map((u) => (
            <li key={u} className="px-3 py-1 text-sm text-gray-400">{u}</li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
