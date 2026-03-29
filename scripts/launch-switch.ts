/**
 * 発売日 切り替えスクリプト
 *
 * 実行方法:
 *   WORKER_URL=https://line-crm-worker.sekiguchi.workers.dev \
 *   API_KEY=YOUR_KEY \
 *   COUPON_CODE=NUDE20 \
 *   SCHEDULED_AT="2026-07-20T10:00:00+09:00" \
 *   npx tsx scripts/launch-switch.ts
 *
 * 処理内容:
 *   1. ウェイトリストシナリオを無効化
 *   2. 元のウェルカムシナリオを再有効化
 *   3. 全友だちへの 20%OFF クーポン発売ブロードキャストを作成（予約送信）
 */

const WORKER_URL = process.env.WORKER_URL ?? 'https://line-crm-worker.sekiguchi.workers.dev';
const API_KEY = process.env.API_KEY ?? '';
const COUPON_CODE = process.env.COUPON_CODE ?? 'NUDE20';

// 予約送信日時（未指定の場合は即時送信）
const SCHEDULED_AT = process.env.SCHEDULED_AT ?? null;

// 発売ブロードキャスト送信先URL（公式サイト）
const SHOP_URL = 'https://nudeskincare.jp/';

if (!API_KEY) {
  console.error('❌ API_KEY が設定されていません');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json() as { success: boolean; data: T; error?: string };
  if (!json.success) throw new Error(`API error ${res.status}: ${json.error}`);
  return json.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// 発売ブロードキャスト — 20%OFF クーポン配信
// ─────────────────────────────────────────────────────────────────────────────

function buildLaunchBroadcastFlex(couponCode: string, shopUrl: string): string {
  return JSON.stringify({
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#1a1a1a',
      paddingAll: '24px',
      contents: [
        {
          type: 'text', text: 'お待たせしました',
          size: 'xs', color: '#c8aa90', weight: 'bold', letterSpacing: '3px',
        },
        {
          type: 'text', text: 'nú:d ついに発売🎉',
          size: 'xl', weight: 'bold', color: '#ffffff', margin: 'sm',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '24px',
      contents: [
        {
          type: 'text',
          text: '{{name}}さん、\nウェイトリストにご登録いただきありがとうございます🤍',
          size: 'sm', weight: 'bold', color: '#1a1a1a', wrap: true,
        },
        {
          type: 'text',
          text: 'お待たせしました！nú:dがついに発売開始です。\n約束のクーポンコードをお届けします。',
          size: 'sm', color: '#4a4a4a', wrap: true, margin: 'md',
        },
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#faf7f4',
          cornerRadius: 'lg',
          paddingAll: '20px',
          margin: 'lg',
          borderWidth: '1px',
          borderColor: '#c8aa90',
          contents: [
            {
              type: 'text', text: '✦ ウェイトリスト限定クーポン ✦',
              size: 'xs', color: '#c8aa90', weight: 'bold', align: 'center',
            },
            {
              type: 'text', text: couponCode,
              size: 'xxl', weight: 'bold', color: '#1a1a1a', align: 'center',
              margin: 'sm', letterSpacing: '4px',
            },
            {
              type: 'text', text: '初回購入 20% OFF',
              size: 'sm', color: '#4a4a4a', align: 'center', margin: 'xs',
            },
            { type: 'separator', color: '#e8e0d8', margin: 'md' },
            {
              type: 'text',
              text: '購入画面のクーポンコード欄に入力してください',
              size: 'xs', color: '#9a8878', align: 'center', wrap: true, margin: 'sm',
            },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '20px',
      backgroundColor: '#1a1a1a',
      contents: [
        {
          type: 'button',
          action: { type: 'uri', label: '今すぐ購入する', uri: shopUrl },
          style: 'primary',
          color: '#c8aa90',
          height: 'sm',
        },
        {
          type: 'text', text: '素の肌で、毎日を。nú:d',
          size: 'xs', color: 'rgba(255,255,255,0.4)', align: 'center', margin: 'md',
        },
      ],
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// メイン処理
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 発売日 切り替えスクリプト 開始\n');
  console.log(`   クーポンコード: ${COUPON_CODE}`);
  console.log(`   予約送信: ${SCHEDULED_AT ?? '即時'}\n`);

  // 1. 全シナリオ取得
  console.log('1️⃣  シナリオ一覧を取得中...');
  const scenarios = await api<Array<{
    id: string; name: string; triggerType: string; isActive: boolean;
  }>>('GET', '/api/scenarios');

  const waitlistScenario = scenarios.find(s =>
    s.name.includes('ウェイトリスト') && s.triggerType === 'friend_add'
  );
  const welcomeScenario = scenarios.find(s =>
    s.name.includes('ウェルカム') && s.triggerType === 'friend_add'
  );

  console.log(`   ウェイトリストシナリオ: ${waitlistScenario?.name ?? '未発見'} [${waitlistScenario?.isActive ? '有効' : '無効'}]`);
  console.log(`   ウェルカムシナリオ: ${welcomeScenario?.name ?? '未発見'} [${welcomeScenario?.isActive ? '有効' : '無効'}]`);

  // 2. ウェイトリストシナリオを無効化
  if (waitlistScenario?.isActive) {
    console.log('\n2️⃣  ウェイトリストシナリオを無効化中...');
    await api('PUT', `/api/scenarios/${waitlistScenario.id}`, { isActive: false });
    console.log(`   ✅ 無効化: ${waitlistScenario.name}`);
  } else {
    console.log('\n2️⃣  ウェイトリストシナリオは既に無効（スキップ）');
  }

  // 3. ウェルカムシナリオを再有効化
  if (welcomeScenario && !welcomeScenario.isActive) {
    console.log('\n3️⃣  ウェルカムシナリオを再有効化中...');
    await api('PUT', `/api/scenarios/${welcomeScenario.id}`, { isActive: true });
    console.log(`   ✅ 有効化: ${welcomeScenario.name}`);
  } else if (welcomeScenario?.isActive) {
    console.log('\n3️⃣  ウェルカムシナリオは既に有効（スキップ）');
  } else {
    console.log('\n3️⃣  ⚠️  ウェルカムシナリオが見つかりませんでした。手動で確認してください。');
  }

  // 4. 20%OFFクーポン ブロードキャストを作成
  console.log('\n4️⃣  20%OFFクーポン ブロードキャストを作成中...');
  const broadcastContent = buildLaunchBroadcastFlex(COUPON_CODE, SHOP_URL);

  const broadcast = await api<{ id: string; title: string; status: string; scheduledAt: string | null }>(
    'POST', '/api/broadcasts',
    {
      title: `【発売開始】nú:d ウェイトリスト 20%OFFクーポン`,
      messageType: 'flex',
      messageContent: broadcastContent,
      targetType: 'all',
      scheduledAt: SCHEDULED_AT,
    }
  );

  console.log(`   ✅ ブロードキャスト作成: ${broadcast.title}`);
  console.log(`   ID: ${broadcast.id}`);
  console.log(`   ステータス: ${broadcast.status}`);
  console.log(`   予約日時: ${broadcast.scheduledAt ?? '即時'}`);

  console.log('\n✨ 発売切り替え完了！');
  console.log('   - ウェイトリストシナリオ → 無効');
  console.log('   - ウェルカムシナリオ → 有効');
  console.log(`   - クーポン配信ブロードキャスト → ${broadcast.scheduledAt ? '予約済み' : '即時送信'}`);
  console.log('\n   管理画面でブロードキャストの状況を確認してください:');
  console.log('   https://web-mumumuinc.vercel.app/broadcasts');
}

main().catch((err) => {
  console.error('❌ エラー:', err);
  process.exit(1);
});
