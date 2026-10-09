-- AI Resell Assistant: Supabase (PostgreSQL) テーブル定義
-- Phase 1 はローカルJSONで動作します。インターネット公開時にこのSQLを
-- Supabase の SQL Editor で実行し、src/lib/db に Supabase 版の Repository を追加します。
-- すべてのテーブルで行レベルセキュリティ(RLS)を有効にし、本人のデータしか読み書きできないようにします。

create extension if not exists "pgcrypto";

-- 設定（ユーザーごとに1行。項目追加に強いよう JSON で保存）
create table if not exists settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 商品（仕入れ候補〜販売済みまで）
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  source text not null check (source in ('depop', 'ebay', 'other')),
  url text not null,
  normalized_url text not null,
  image_url text,

  title text not null,
  brand text not null,
  category text,
  size text,
  condition text,
  model_number text,
  notes text,

  currency text not null,
  price numeric(12, 2) not null check (price > 0),
  local_shipping numeric(12, 2),
  local_shipping_confirmed boolean not null default false,

  use_proxy_purchase boolean not null default false,
  weight_g integer,
  weight_confirmed boolean not null default false,
  consolidated_total_weight_g integer,
  customs_override_jpy integer,
  other_cost_jpy integer not null default 0,

  expected_sale_price_jpy integer,

  status text not null default 'candidate',
  favorite boolean not null default false,

  purchased_at date,
  actual_purchase_jpy integer,
  tracking_number text,
  sold_at date,
  actual_sale_price_jpy integer,

  -- 同じユーザーが同じ商品URLを二重登録しない
  unique (user_id, normalized_url)
);
create index if not exists products_user_status_idx on products (user_id, status);

-- 国内相場（メルカリなどで確認した価格を手動登録）
create table if not exists market_comps (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'mercari',
  title text not null,
  price_jpy integer not null check (price_jpy > 0),
  sold boolean not null default true,
  size text,
  condition text,
  url text,
  observed_at timestamptz not null default now(),
  note text
);
create index if not exists market_comps_product_idx on market_comps (product_id);

-- 行レベルセキュリティ
alter table settings enable row level security;
alter table products enable row level security;
alter table market_comps enable row level security;

create policy "own settings" on settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own products" on products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own market comps" on market_comps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
