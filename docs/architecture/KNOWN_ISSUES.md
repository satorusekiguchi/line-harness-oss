# 既知の重大バグとその教訓

> このファイルはGitHub Issuesの代替として使用する。  
> ステップ配信システムに関わる変更を行う前に必ず読むこと。

---

## ISSUE-001: step0スキップバグ（解決済み）

**重大度**: 🔴 Critical  
**発生日**: 2026-03-30  
**修正コミット**: `1d9f299`  
**ステータス**: ✅ 修正済み（再発防止ルール適用中）

### 症状
新規友だち追加時に、シナリオの最初のステップ（step0）が誰にも配信されなかった。

### 根本原因
`enrollFriendInScenario()` の `current_step_order` 初期値が `0` だった。  
cron の配信ロジックは `step_order > current_step_order` で次ステップを探すため、  
`current_step_order = 0` の場合、`step_order = 0` のstep0は対象外になる。

### 修正内容
初期値を `0` → `-1` に変更（`packages/db/src/scenarios.ts`）

### 再発防止ルール
**`enrollFriendInScenario` の `current_step_order` 初期値を絶対に `0` にしてはならない。必ず `-1`。**

---

## ISSUE-002: ステップ重複送信バグ（解決済み）

**重大度**: 🔴 Critical  
**発生日**: 2026-03-30  
**修正コミット**: `1d9f299`  
**ステータス**: ✅ 修正済み（再発防止ルール適用中）

### 症状
全友だちに同一ステップのメッセージが2回ずつ送信された（49〜156ms間隔）。

### 根本原因
`scheduled()` ハンドラがアクティブなLINEアカウントトークンの数だけ `processStepDeliveries()` をループ呼び出ししていた。  
`getFriendScenariosDueForDelivery()` は全アカウントの期限済みシナリオを返すため、  
N個のトークンがあれば同じシナリオがN回処理される。

### 修正内容
1. `scheduled()` での `processStepDeliveries` 呼び出しを1回のみに変更（`apps/worker/src/index.ts`）
2. `processSingleDelivery` 先頭に原子的クレーム取得を追加（D1 UPDATE WHERE による排他制御）

### 再発防止ルール
**`processStepDeliveries()` は `scheduled()` から必ず1回だけ呼び出すこと。**  
**`processSingleDelivery()` の先頭の原子的クレームUPDATEを削除・移動してはならない。**

#### 原子的クレームのコード（削除禁止）
```typescript
const claim = await db.prepare(`
  UPDATE friend_scenarios SET next_delivery_at = ?
  WHERE id = ? AND status = 'active' AND next_delivery_at <= ?
`).bind(claimUntil, fs.id, now).run();

if (claim.meta.changes === 0) return; // 他インスタンスが処理中
```

#### 二重送信確認クエリ
```sql
SELECT friend_id, scenario_step_id, COUNT(*) as cnt,
       MIN(created_at) as first_sent, MAX(created_at) as last_sent
FROM messages_log
WHERE scenario_step_id IS NOT NULL
GROUP BY friend_id, scenario_step_id
HAVING cnt > 1
ORDER BY first_sent DESC;
```

---

## ISSUE-003: 誤トークンバグ（解決済み）

**重大度**: 🟠 High  
**発生日**: 2026-03-30（ISSUE-002と同時修正）  
**修正コミット**: `1d9f299`  
**ステータス**: ✅ 修正済み（再発防止ルール適用中）

### 症状
複数のLINE公式アカウント運用時、別アカウントのトークンでpushMessageを実行する可能性があった。

### 根本原因
`processSingleDelivery()` が引数で渡された `lineClient`（外部からのトークン）をそのまま使用していた。  
アカウントAの友だちに対して、アカウントBのトークンでメッセージ送信を試みる可能性があった。

### 修正内容
`processSingleDelivery()` 内で友だちの `line_account_id` を使って `line_accounts` テーブルから  
正しいチャネルアクセストークンを取得し、新たな `LineClient` を生成するよう変更。

### 再発防止ルール
**`processSingleDelivery()` でメッセージ送信に使う `LineClient` は、必ず友だちの `line_account_id` からDBで取得したトークンで生成すること。引数のlineClientをそのまま使ってはならない。**

---

## ISSUE-004: webhook即時配信のデグレ（解決済み・教訓）

**重大度**: 🟠 High  
**発生バージョン**: v0.2.0（コミット `983f8a7`）  
**修正コミット**: `1d9f299`（cronによる救済実装で実質的に解決）  
**ステータス**: ✅ 軽減済み

### 症状
step0の即時配信が失敗してもcronが救済できなくなった。

### 根本原因
v0.2.0で `pushMessage` → `replyMessage` に変更された。  
`replyToken` は **30秒で失効**し、**1回しか使えない**ため：
- 処理に時間がかかった場合は失効後に失敗
- LIFF経由の友だち追加ではそもそもreplyTokenが存在しない

### 教訓
webhookでのstep0即時配信はベストエフォート（replyMessage）で構わないが、  
失敗時のフォールバックとしてcronが必ず救済できる設計を維持すること（ISSUE-001の修正がこれを担保）。

---

## チェックリスト：ステップ配信関連ファイルを変更した後

```
apps/worker/src/services/step-delivery.ts を変更した場合:
  □ processSingleDelivery の先頭に原子的クレームUPDATEが残っているか
  □ LineClient が line_accounts テーブルから取得したトークンで生成されているか

apps/worker/src/index.ts を変更した場合:
  □ processStepDeliveries が scheduled() から1回のみ呼ばれているか

packages/db/src/scenarios.ts を変更した場合:
  □ enrollFriendInScenario の current_step_order 初期値が -1 か

apps/worker/src/routes/webhook.ts を変更した場合:
  □ step0のreplyMessage失敗時にadvanceFriendScenarioが呼ばれないことを確認
    （呼ばれてしまうと current_step_order が進んでcronが救済できなくなる）
```

---

## 参考ドキュメント

- `docs/architecture/step-delivery-invariants.md` — 不変条件の詳細説明
- `.cursor/rules/step-delivery-critical.mdc` — CursorAI向け自動警告ルール
