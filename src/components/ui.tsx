import type { ReactNode } from "react";
import type { Confidence } from "@/lib/market";
import { CONFIDENCE_LABELS } from "@/lib/market";
import type { Verdict } from "@/lib/profit";
import type { Certainty } from "@/lib/types";

export function Card({ title, children, actions, className = "" }: {
  title?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, description, actions }: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const tone = {
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-800",
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-blue-100 text-blue-800",
};

export function Badge({ children, color = "gray" }: { children: ReactNode; color?: keyof typeof tone }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${tone[color]}`}>
      {children}
    </span>
  );
}

export const CERTAINTY_LABELS: Record<Certainty, string> = {
  confirmed: "確認済み",
  estimate: "推定",
  unknown: "未入力",
};

export function CertaintyBadge({ value }: { value: Certainty }) {
  const color = value === "confirmed" ? "green" : value === "estimate" ? "amber" : "red";
  return <Badge color={color}>{CERTAINTY_LABELS[value]}</Badge>;
}

export function VerdictBadge({ value }: { value: Verdict }) {
  if (value === "pass") return <Badge color="green">条件クリア</Badge>;
  if (value === "fail") return <Badge color="red">条件未達</Badge>;
  return <Badge color="gray">判定不可</Badge>;
}

export function ConfidenceBadge({ value }: { value: Confidence }) {
  const color = value === "high" ? "green" : value === "medium" ? "blue" : value === "low" ? "amber" : "gray";
  return <Badge color={color}>相場信頼度: {CONFIDENCE_LABELS[value]}</Badge>;
}

export function Notice({ children, color = "amber" }: { children: ReactNode; color?: "amber" | "blue" | "red" }) {
  const c = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    red: "border-red-200 bg-red-50 text-red-900",
  }[color];
  return <div className={`rounded-md border px-3 py-2 text-sm ${c}`}>{children}</div>;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}
