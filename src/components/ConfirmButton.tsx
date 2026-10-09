"use client";

import type { ReactNode } from "react";

// 押す前に確認ダイアログを出すボタン（削除など取り消せない操作用）
export function ConfirmButton({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
