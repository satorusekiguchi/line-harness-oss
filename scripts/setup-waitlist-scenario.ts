/**
 * ウェイトリスト シナリオ セットアップスクリプト
 *
 * 実行方法:
 *   WORKER_URL=https://line-crm-worker.sekiguchi.workers.dev \
 *   API_KEY=YOUR_KEY \
 *   npx tsx scripts/setup-waitlist-scenario.ts
 *
 * 処理内容:
 *   1. 既存の friend_add シナリオをすべて無効化（ウェルカムシナリオ）
 *   2. ウェイトリスト専用シナリオを新規作成
 *   3. ステップ 4 本を作成
 */

const WORKER_URL = process.env.WORKER_URL ?? 'https://line-crm-worker.sekiguchi.workers.dev';
const API_KEY = process.env.API_KEY ?? '';

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
// メッセージ定義
// ─────────────────────────────────────────────────────────────────────────────

/** Step 0: 即時 — ウェイトリスト登録完了 */
const step0Flex = JSON.stringify({
  type: 'bubble',
  size: 'mega',
  header: {
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#f9f5f0',
    paddingAll: '24px',
    contents: [
      {
        type: 'text', text: 'nú:d', size: 'xxl', weight: 'bold',
        color: '#1a1a1a', align: 'center', letterSpacing: '8px',
      },
      {
        type: 'text', text: '2026年7月 発売予定', size: 'xs',
        color: '#c8aa90', align: 'center', margin: 'sm',
        weight: 'bold', letterSpacing: '2px',
      },
    ],
  },
  body: {
    type: 'box',
    layout: 'vertical',
    spacing: 'lg',
    paddingAll: '24px',
    contents: [
      {
        type: 'text',
        text: '{{name}}さん、\nウェイトリストへのご登録ありがとうございます🤍',
        size: 'md', color: '#1a1a1a', wrap: true, weight: 'bold',
      },
      {
        type: 'text',
        text: 'nú:dはヒト型セラミド配合のバリア集中スキンケアブランドです。7月の発売に先駆けて、まず私たちのことを知っていただければ嬉しいです。',
        size: 'sm', color: '#4a4a4a', wrap: true,
      },
      { type: 'separator', color: '#e8e0d8' },
      {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#faf7f4',
        cornerRadius: 'lg',
        paddingAll: '16px',
        contents: [
          {
            type: 'text', text: '✦ ウェイトリスト特典 ✦',
            size: 'xs', color: '#c8aa90', weight: 'bold', align: 'center',
          },
          {
            type: 'text', text: '初回購入 20% OFF',
            size: 'xl', weight: 'bold', color: '#1a1a1a', align: 'center', margin: 'sm',
          },
          {
            type: 'text',
            text: '発売開始時にクーポンコードをLINEでお届けします',
            size: 'xs', color: '#7a7a7a', align: 'center', wrap: true, margin: 'sm',
          },
        ],
      },
    ],
  },
  footer: {
    type: 'box',
    layout: 'vertical',
    paddingAll: '20px',
    backgroundColor: '#f9f5f0',
    contents: [
      {
        type: 'text', text: '発売まで、どうぞお楽しみに ✦',
        size: 'xs', color: '#b0a090', align: 'center',
      },
    ],
  },
});

/** Step 1: 2日後 — ブランドの想い（テキスト） */
const step1Text = `{{name}}さん、こんにちは🌿

改めまして、nú:dです。

私たちが「素の肌を、信じる。」というブランドをつくった理由をお伝えしたくて、メッセージしました。

肌トラブルを抱える方々の声を聞いていると、多くの方が「肌が弱い」と思い込んでいることに気づきました。

でも本来、肌はとても賢い器官。
正しいケアで、自ら潤う力を取り戻せるんです。

nú:dは、肌本来の力を信じて、余分なものは引かず、必要なものだけを届けるスキンケアです。

7月の発売まで、少しずつnú:dのことをお伝えしていきますね🤍

素の肌が、いちばん美しい。`;

/** Step 2: 7日後（Step1配信から5日後）— 主力成分＆商品ティザー */
const step2Flex = JSON.stringify({
  type: 'bubble',
  size: 'mega',
  header: {
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#f0f4f0',
    paddingAll: '20px',
    contents: [
      {
        type: 'text', text: '🧬 ヒト型セラミドって何？',
        weight: 'bold', size: 'lg', color: '#1a1a1a',
      },
      {
        type: 'text', text: 'nú:dが選んだ理由',
        size: 'sm', color: '#6a8a6a', margin: 'sm',
      },
    ],
  },
  body: {
    type: 'box',
    layout: 'vertical',
    spacing: 'md',
    paddingAll: '20px',
    contents: [
      {
        type: 'text',
        text: 'セラミドには植物性・合成・ヒト型の3種類があります。',
        size: 'sm', color: '#4a4a4a', wrap: true,
      },
      { type: 'separator', color: '#e0e8e0', margin: 'md' },
      {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        margin: 'md',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              { type: 'text', text: '✦', color: '#4a7a4a', size: 'sm', flex: 0 },
              {
                type: 'box', layout: 'vertical',
                contents: [
                  { type: 'text', text: 'ヒト型セラミド', weight: 'bold', size: 'sm', color: '#1a1a1a' },
                  {
                    type: 'text',
                    text: '人の肌と同じ構造。浸透力・保湿力が最も高く、肌本来のバリア機能を補修します。',
                    size: 'xs', color: '#4a4a4a', wrap: true,
                  },
                ],
              },
            ],
          },
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              { type: 'text', text: '✦', color: '#999', size: 'sm', flex: 0 },
              {
                type: 'box', layout: 'vertical',
                contents: [
                  { type: 'text', text: '植物性・合成セラミド', size: 'sm', color: '#666' },
                  {
                    type: 'text',
                    text: '表面を覆うだけで、肌内部への働きかけは限定的。',
                    size: 'xs', color: '#999', wrap: true,
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: 'separator', color: '#e0e8e0', margin: 'md' },
      {
        type: 'text',
        text: 'nú:dは全製品に「ヒト型セラミド」を配合。\n乾燥・揺らぎ・敏感肌の方にも、素の肌を取り戻してほしいから。\n\n7月の発売をお楽しみに🌿',
        size: 'sm', color: '#3a3a3a', wrap: true, margin: 'md',
      },
    ],
  },
  footer: {
    type: 'box',
    layout: 'vertical',
    paddingAll: '16px',
    backgroundColor: '#f9f5f0',
    contents: [
      {
        type: 'text',
        text: 'あなたのための20%OFFクーポンを準備しています ✦',
        size: 'xs', color: '#b0a090', align: 'center', wrap: true,
      },
    ],
  },
});

/** Step 3: 14日後（Step2配信から7日後）— 20%OFFクーポン事前告知 */
const step3Flex = JSON.stringify({
  type: 'bubble',
  size: 'mega',
  header: {
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#1a1a1a',
    paddingAll: '24px',
    contents: [
      {
        type: 'text', text: 'ウェイトリスト限定',
        size: 'xs', color: '#c8aa90', weight: 'bold', letterSpacing: '3px',
      },
      {
        type: 'text', text: '先行特典のお知らせ🎁',
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
        text: '{{name}}さん、登録から2週間。\nお待たせしていてありがとうございます🤍',
        size: 'sm', weight: 'bold', color: '#1a1a1a', wrap: true,
      },
      {
        type: 'text',
        text: '7月後半のnú:d発売に合わせて、ウェイトリストにご登録いただいた方全員に「初回購入20%OFFクーポン」をLINEでお届けする予定です。',
        size: 'sm', color: '#4a4a4a', wrap: true, margin: 'md',
      },
      {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#faf7f4',
        cornerRadius: 'lg',
        paddingAll: '16px',
        margin: 'lg',
        contents: [
          {
            type: 'text', text: '発売当日にクーポンが届きます',
            size: 'xs', color: '#c8aa90', weight: 'bold', align: 'center',
          },
          {
            type: 'text', text: '初回購入 20% OFF',
            size: 'xl', weight: 'bold', color: '#1a1a1a', align: 'center', margin: 'sm',
          },
          {
            type: 'text',
            text: '※ このLINEをブロックしないようにしていてください',
            size: 'xxs', color: '#aaa', align: 'center', wrap: true, margin: 'sm',
          },
        ],
      },
      {
        type: 'text',
        text: '引き続き発売をお楽しみに。\n素の肌が、いちばん美しい。',
        size: 'sm', color: '#7a7a7a', wrap: true, margin: 'md',
      },
    ],
  },
  footer: {
    type: 'box',
    layout: 'vertical',
    paddingAll: '20px',
    backgroundColor: '#1a1a1a',
    contents: [
      {
        type: 'text', text: '素の肌で、毎日を。nú:d',
        size: 'xs', color: 'rgba(255,255,255,0.4)', align: 'center',
      },
    ],
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// メイン処理
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 ウェイトリストシナリオ セットアップ開始\n');

  // 1. 既存シナリオ一覧を取得
  console.log('1️⃣  既存シナリオを取得中...');
  const scenarios = await api<Array<{
    id: string; name: string; triggerType: string; isActive: boolean; stepCount: number;
  }>>('GET', '/api/scenarios');

  const friendAddScenarios = scenarios.filter(s => s.triggerType === 'friend_add');
  console.log(`   friend_add シナリオ: ${friendAddScenarios.length} 件`);
  for (const s of friendAddScenarios) {
    console.log(`   - [${s.isActive ? '有効' : '無効'}] ${s.name} (id: ${s.id}, steps: ${s.stepCount})`);
  }

  // 2. 既存の friend_add シナリオを無効化
  console.log('\n2️⃣  既存の friend_add シナリオを無効化中...');
  for (const s of friendAddScenarios) {
    if (s.isActive) {
      await api('PUT', `/api/scenarios/${s.id}`, { isActive: false });
      console.log(`   ✅ 無効化: ${s.name}`);
    } else {
      console.log(`   ⏭️  スキップ（既に無効）: ${s.name}`);
    }
  }

  // 3. ウェイトリストシナリオを作成
  console.log('\n3️⃣  ウェイトリストシナリオを作成中...');
  const scenario = await api<{ id: string; name: string }>('POST', '/api/scenarios', {
    name: 'nú:d ウェイトリストシナリオ',
    description: 'ウェイトリスト登録者向けステップ配信。発売まで全4本。',
    triggerType: 'friend_add',
    isActive: true,
  });
  console.log(`   ✅ 作成完了: ${scenario.name} (id: ${scenario.id})`);

  // 4. ステップを作成
  console.log('\n4️⃣  ステップを作成中...');

  const steps = [
    {
      label: 'Step 0: 即時 — ウェイトリスト登録完了',
      stepOrder: 0,
      delayMinutes: 0,
      messageType: 'flex',
      messageContent: step0Flex,
    },
    {
      label: 'Step 1: 2日後 — ブランドの想い',
      stepOrder: 1,
      delayMinutes: 2880, // 2日
      messageType: 'text',
      messageContent: step1Text,
    },
    {
      label: 'Step 2: 7日後 — ヒト型セラミド紹介',
      stepOrder: 2,
      delayMinutes: 7200, // 5日（Step1から）= 通算7日
      messageType: 'flex',
      messageContent: step2Flex,
    },
    {
      label: 'Step 3: 14日後 — 20%OFFクーポン事前告知',
      stepOrder: 3,
      delayMinutes: 10080, // 7日（Step2から）= 通算14日
      messageType: 'flex',
      messageContent: step3Flex,
    },
  ];

  for (const step of steps) {
    await api('POST', `/api/scenarios/${scenario.id}/steps`, {
      stepOrder: step.stepOrder,
      delayMinutes: step.delayMinutes,
      messageType: step.messageType,
      messageContent: step.messageContent,
    });
    console.log(`   ✅ ${step.label}`);
  }

  // 5. 確認
  console.log('\n5️⃣  最終確認...');
  const created = await api<{ id: string; name: string; isActive: boolean; steps: unknown[] }>(
    'GET', `/api/scenarios/${scenario.id}`
  );
  console.log(`   シナリオ名: ${created.name}`);
  console.log(`   有効: ${created.isActive}`);
  console.log(`   ステップ数: ${created.steps.length}`);

  console.log('\n✨ セットアップ完了！');
  console.log('   友だち追加時にウェイトリストシナリオが自動発動されます。');
  console.log('   発売時は scripts/launch-switch.ts を実行してください。');
}

main().catch((err) => {
  console.error('❌ エラー:', err);
  process.exit(1);
});
