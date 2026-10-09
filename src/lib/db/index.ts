import "server-only";
import { connection } from "next/server";
import { JsonStore } from "./json-store";
import type { Repository } from "./repository";

// Phase 1 はローカルのJSONファイルに保存します。
// Supabase 版は supabase/schema.sql を用意済みで、Repository を実装すれば差し替えられます。
export const repo: Repository = new JsonStore();

/** ページ（Server Component）からデータにアクセスするときに使います（毎回リクエスト時に読み込み） */
export async function getRepo(): Promise<Repository> {
  await connection();
  return repo;
}
