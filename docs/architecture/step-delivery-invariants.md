# ステップ配信システム — 設計上の不変条件

> **⚠️ このドキュメントを必ず読んでから `step-delivery.ts` / `scenarios.ts` / `index.ts` を変更すること。**  
> 過去に発生した深刻なバグとその修正を記録している。同じ過ちを繰り返さないためのガイドラインである。

---

## 概要：ステップ配信の全体フロー

```
友だち追加（webhookまたはLIFF）
  ↓
enrollFriendInScenario()
  → current_step_order = -1  ← ★不変条件①参照
  → next_delivery_at = now + firstStep.delay_minutes
  ↓
webhook: delay_minutes=0のstep0をreplyMessageで即時送信 (任意。失敗してもcronが救済)
  → 成功時: advanceFriendScenario(id, step0.step_order=0, nextDate)
             → current_step_order = 0
  ↓
cron (*/5 * * * *): getFriendScenariosDueForDelivery()
  → next_delivery_at <= now のレコードを取得
  → processSingleDelivery() → 原子的クレーム → step_order > current_step_order の次ステップを配信
```

---

## ★ 不変条件一覧（変更禁止ルール）

### 不変条件① `enrollFriendInScenario` の初期値は必ず `-1`

**場所**: `packages/db/src/scenarios.ts`

```typescript
// ✅ 正しい
VALUES (?, ?, ?, -1, 'active', ?, ?, ?)
//               ↑ -1 必須

// ❌ 絶対にやってはいけない
VALUES (?, ?, ?, 0, 'active', ?, ?, ?)
//               ↑ 0 はバグ
```

**理由**:  
cronの配信ロジックは `step_order > current_step_order` でネクストステップを検索する。  
`current_step_order = 0` で初期化すると、`step_order=0` のstep0（ウェルカムメッセージ等）が永久にスキップされる。  
`-1` にすることで、cronが `step_order > -1 = step0` を正しく検出できる。

**影響範囲**: 初期値を変更すると、新規友だち追加時にstep0が配信されなくなる。

---

### 不変条件② `processSingleDelivery` の先頭で必ず原子的クレームを取得する

**場所**: `apps/worker/src/services/step-delivery.ts`

```typescript
// ✅ 正しい：処理開始前に必ず原子的UPDATEでクレームを取得
const claim = await db
  .prepare(`
    UPDATE friend_scenarios
    SET next_delivery_at = ?        -- 処理中マーカー（1時間後）
    WHERE id = ?
      AND status = 'active'
      AND next_delivery_at IS NOT NULL
      AND next_delivery_at <= ?
  `)
  .bind(claimUntil, fs.id, now)
  .run();

if (claim.meta.changes === 0) {
  return; // 他のインスタンスがすでに処理済み → スキップ
}

// ← この行より後でメッセージ送信・DB更新を行う
```

**理由**:  
Cloudflare cronは同一タイミングで複数インスタンスが起動することがある。  
クレームなしだと同一メッセージが2回（以上）送信される。  
D1のUPDATE WHERE句による排他制御が唯一の安全策（ロック機構がないため）。

**確認方法**: `messages_log` テーブルで同一 `(friend_id, scenario_step_id)` の重複を確認する。

---

### 不変条件③ `processStepDeliveries` は `scheduled()` から **1回のみ** 呼び出す

**場所**: `apps/worker/src/index.ts`

```typescript
// ✅ 正しい：1回のみ呼び出す
const jobs: Promise<void>[] = [
  processStepDeliveries(env.DB, defaultClient, env.WORKER_URL), // ← 1回
  checkAccountHealth(env.DB),
];
// アカウントごとのループの外に置くこと

// ❌ 絶対にやってはいけない
for (const token of activeTokens) {
  jobs.push(
    processStepDeliveries(env.DB, lineClient, env.WORKER_URL), // ← N回 = 重複送信バグ
  );
}
```

**理由**:  
`getFriendScenariosDueForDelivery()` はDBの**全アカウント**の期限済みシナリオを返す。  
複数トークンでループすると、各ループで同じレコードが処理されて重複送信となる。  
（不変条件②の原子的クレームが第2の防御壁だが、そもそも1回呼び出しが原則）

---

### 不変条件④ `processSingleDelivery` は友だちのアカウントから正しいトークンを取得する

**場所**: `apps/worker/src/services/step-delivery.ts`

```typescript
// ✅ 正しい：DBのline_accountsから正しいトークンを取得
const friendWithToken = await db
  .prepare(`
    SELECT f.*, la.channel_access_token as account_token
    FROM friends f
    LEFT JOIN line_accounts la ON la.id = f.line_account_id
    WHERE f.id = ?
  `)
  .bind(fs.friend_id)
  .first<...>();

const lineClient = new LineClient(friendWithToken.account_token);

// ❌ やってはいけない
// 引数で渡されたlineClientをそのまま使う
await lineClient.pushMessage(...); // 別アカウントのトークンで送信→403エラー
```

**理由**:  
複数の公式アカウントを運用している場合、友だちAはアカウントXのユーザーであり、  
アカウントYのトークンではメッセージ送信ができない（LINE API 403エラー）。

---

## よくある間違いと確認チェックリスト

### ステップ配信を修正した場合は必ず確認

- [ ] `enrollFriendInScenario` の初期 `current_step_order` が `-1` か
- [ ] `processSingleDelivery` の先頭に原子的クレームのUPDATEがあるか
- [ ] `scheduled()` 内で `processStepDeliveries` が **1回だけ** 呼ばれているか
- [ ] メッセージ送信に使う `LineClient` が友だちの `line_account_id` から取得したトークンで生成されているか
- [ ] `advanceFriendScenario` 呼び出し時の第3引数（`nextStepOrder`）が `currentStep.step_order` か（`nextStep.step_order` ではない）

### 二重送信が疑われる場合

```sql
-- messages_logで同一ステップの重複を確認
SELECT friend_id, scenario_step_id, COUNT(*) as cnt, MIN(created_at), MAX(created_at)
FROM messages_log
WHERE scenario_step_id IS NOT NULL
GROUP BY friend_id, scenario_step_id
HAVING cnt > 1
ORDER BY MIN(created_at) DESC;
```

重複が見つかった場合は：
1. 不変条件②（原子的クレーム）が正しく実装されているか確認
2. 不変条件③（呼び出し回数）が守られているか確認

### step0が配信されない場合

```sql
-- step0未配信のfriend_scenariosを確認
SELECT fs.*, f.display_name 
FROM friend_scenarios fs
JOIN friends f ON f.id = fs.friend_id
WHERE fs.status = 'active'
  AND fs.current_step_order = -1
  AND fs.next_delivery_at <= datetime('now', '+9 hours');
```

該当レコードがあるにもかかわらず配信されない場合は不変条件①を確認すること。

---

## 過去のインシデント記録

| 日付 | 症状 | 原因 | 修正コミット |
|------|------|------|-------------|
| 2026-03-30 | step0が全友だちにスキップされた | `enrollFriendInScenario`の初期値が`0`（step0と同値） | `1d9f299` |
| 2026-03-30 | step1が全友だちに2回ずつ届いた | `scheduled()`がトークン数分`processStepDeliveries`を呼び出し | `1d9f299` |
| v0.2.0 | step0のwebhook即時配信が失敗するとcronが救済しなくなった | `pushMessage`→`replyMessage`への変更（replyTokenは30秒で失効） | `1d9f299` |

---

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `packages/db/src/scenarios.ts` | `enrollFriendInScenario`, `advanceFriendScenario`, `getFriendScenariosDueForDelivery` |
| `apps/worker/src/services/step-delivery.ts` | `processStepDeliveries`, `processSingleDelivery` |
| `apps/worker/src/index.ts` | cronハンドラ `scheduled()` |
| `apps/worker/src/routes/webhook.ts` | follow eventでstep0をreplyMessageで即時配信する処理 |
