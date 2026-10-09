# 設計メモ

## フォルダ構成

```
├─ src/
│  ├─ app/                    画面（Next.js App Router。フォルダ名がURLになる）
│  │  ├─ page.tsx             /            ダッシュボード
│  │  ├─ products/            /products    商品・候補一覧（検索・絞り込み）
│  │  │  ├─ new/              /products/new 商品登録（利益のリアルタイム試算）
│  │  │  └─ [id]/             /products/xxx 商品詳細・利益分析・相場・実績
│  │  │     └─ edit/          商品編集
│  │  ├─ inventory/           仕入れ・在庫管理
│  │  ├─ sales/               売上・利益分析
│  │  ├─ settings/            設定（送料表・税率・手数料・条件）
│  │  └─ actions.ts           Server Actions（保存・更新・削除の処理）
│  ├─ components/             画面部品（フォーム・内訳表・カードなど）
│  └─ lib/                    画面に依存しないロジック
│     ├─ types.ts             データの型定義
│     ├─ defaults.ts          初期設定値
│     ├─ profit.ts            利益計算・最大許容価格・交渉目安  ← アプリの中核
│     ├─ market.ts            相場の中央値・信頼度
│     ├─ url.ts               URL正規化（重複検出）・販売元判定
│     ├─ forms.ts             フォーム入力の検証
│     ├─ analysis.ts          商品ごとの分析まとめ・実利益
│     ├─ profit.test.ts       自動テスト
│     └─ db/                  データ保存
│        ├─ repository.ts     保存先の共通インターフェース
│        ├─ json-store.ts     ローカルJSON版（Phase 1）
│        └─ index.ts          使用する保存先の切り替え
├─ supabase/schema.sql        Supabase用テーブル定義（RLS付き）
├─ data/                      ローカルデータ（Git対象外）
└─ docs/                      設計資料
```

**拡張のしかた**: 保存先は `Repository` インターフェースで抽象化しているので、Supabase版を追加しても画面のコードは変わりません。販売先（メルカリ以外）は設定の `sales.platform` と相場の `platform` で区別できるようにしています。

## データベース設計

| テーブル | 主な項目 | 用途 |
| --- | --- | --- |
| `products` | 販売元・URL・正規化URL・商品情報・価格/通貨・現地送料・重量・同梱合計重量・関税実額・想定販売価格・ステータス・お気に入り・購入日・実仕入れ額・追跡番号・販売日・実販売価格 | 仕入れ候補〜販売済みまで1商品1行 |
| `market_comps` | 商品ID・プラットフォーム・商品名・価格・売却済みか・サイズ・状態・URL・確認日時 | 国内相場（手動登録） |
| `settings` | ユーザーID・設定JSON | 為替・送料表・税率・手数料・判定条件 |

- `(user_id, normalized_url)` にユニーク制約 → 重複登録防止
- 全テーブルで RLS（行レベルセキュリティ）を有効化し、本人の行だけ読み書き可能
- 将来の追加予定: `negotiations`（交渉履歴）, `ai_analyses`（AI結果のキャッシュ・費用記録）, `recommendations`（日次提案の履歴）, `photos`（Supabase Storage）

## 計算上の前提（要確認事項）

| 項目 | 初期値 | 根拠 |
| --- | --- | --- |
| BUY&SHIP 国際送料 | 500g 1,500円〜（サンプル） | **未確認**。公式の送料計算で要確認 |
| BUY&SHIP 購入代行手数料 | 6% | BUY&SHIP日本語ヘルプ記載 |
| 為替・決済手数料 | 3% | カード会社により異なる（推定） |
| 関税率 | 10% | 衣類は品目で異なる（推定） |
| 輸入消費税 | 10% | |
| メルカリ販売手数料 | 10% | |
| 国内発送費 / 梱包 | 750円 / 100円 | 推定（サイズで変動） |

## ロードマップ

- **Phase 1 残り**: Supabase 版 Repository + ログイン（Supabase Auth）→ Vercel公開
- **Phase 2**: OpenAI API（低コストモデル、キャッシュ、月額上限、モックAIモード）で商品評価・交渉文・写真解析・出品文
- **Phase 3**: eBay公式API（Browse API）連携の調査・実装、ランキング、毎朝9時の定期分析とメール通知
- **Phase 4**: 実績データを使った予測改善、配送の同梱最適化、売上分析の高度化
