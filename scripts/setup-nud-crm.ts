/**
 * nú:d LINE CRM セットアップスクリプト
 *
 * 設計書に基づき、Phase 1〜4 の全シナリオと Flex メッセージテンプレートを作成する。
 *
 * 実行方法:
 *   WORKER_URL=https://your-worker.workers.dev \
 *   API_KEY=YOUR_KEY \
 *   SKIN_DIAGNOSIS_URL=https://your-worker.workers.dev/api/liff/skin-diagnosis \
 *   BRAND_SITE_URL=https://example.com \
 *   LINE_ACCOUNT_ID=your-account-id \
 *   npx tsx scripts/setup-nud-crm.ts
 */

const WORKER_URL = process.env.WORKER_URL ?? 'http://localhost:8787';
const API_KEY = process.env.API_KEY ?? '';
const SKIN_DIAGNOSIS_URL = process.env.SKIN_DIAGNOSIS_URL ?? 'https://example.com/skin-diagnosis';
const BRAND_SITE_URL = process.env.BRAND_SITE_URL ?? 'https://example.com';
const LINE_ACCOUNT_ID = process.env.LINE_ACCOUNT_ID ?? '';

if (!API_KEY) {
  console.error('❌ API_KEY が設定されていません');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${WORKER_URL}${path}${LINE_ACCOUNT_ID ? (path.includes('?') ? '&' : '?') + 'lineAccountId=' + LINE_ACCOUNT_ID : ''}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as T;
}

// ── Flex メッセージビルダー ────────────────────────────────────────────────────

/** ブランドカラー定数 */
const COLORS = {
  bg: '#FAFAF9',
  text: '#1C1917',
  subtext: '#78716C',
  accent: '#1C1917',
  gold: '#B45309',
  border: '#E7E5E4',
  white: '#FFFFFF',
};

/** ウェルカムメッセージ Bubble 1: ご挨拶 */
function flexWelcomeBubble1(): object {
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.bg,
      paddingAll: '24px',
      contents: [
        { type: 'text', text: '{{name}} さまへ', size: 'sm', color: COLORS.subtext, margin: 'none' },
        { type: 'separator', margin: 'md', color: COLORS.border },
        { type: 'text', text: '素の肌を、信じる。', size: 'xl', weight: 'bold', color: COLORS.text, margin: 'lg', wrap: true },
        {
          type: 'text',
          text: 'スキンケアブランド nú:d（ヌード）です。\n\nウェイトリストへのご登録、ありがとうございます。',
          size: 'sm',
          color: COLORS.subtext,
          margin: 'lg',
          wrap: true,
          lineSpacing: '6px',
        },
        { type: 'separator', margin: 'xl', color: COLORS.border },
        {
          type: 'text',
          text: '本当に肌に必要なものは、何かを「足す」ことではなく「土台」を整えること。\n\n私たちは、そんな想いからたった1本の美容液「FutureBase Serum」を作りました。',
          size: 'sm',
          color: COLORS.text,
          margin: 'xl',
          wrap: true,
          lineSpacing: '8px',
        },
      ],
    },
  };
}

/** ウェルカムメッセージ Bubble 2: 配信内容の予告 */
function flexWelcomeBubble2(): object {
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.bg,
      paddingAll: '24px',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: COLORS.text,
          cornerRadius: '4px',
          paddingAll: '6px',
          width: 'fit-content',
          contents: [{ type: 'text', text: 'LINE 限定', size: 'xs', color: COLORS.white, weight: 'bold' }],
        },
        { type: 'text', text: 'このLINEでお届けする\n特別な情報', size: 'lg', weight: 'bold', color: COLORS.text, margin: 'lg', wrap: true, lineSpacing: '4px' },
        { type: 'separator', margin: 'lg', color: COLORS.border },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          spacing: 'md',
          contents: [
            {
              type: 'box', layout: 'horizontal', spacing: 'md', alignItems: 'flex-start',
              contents: [
                { type: 'text', text: '01', size: 'xs', weight: 'bold', color: COLORS.gold, flex: 0, margin: 'none' },
                { type: 'text', text: 'LINE 限定「先行予約」のご案内', size: 'sm', color: COLORS.text, flex: 1, wrap: true },
              ],
            },
            {
              type: 'box', layout: 'horizontal', spacing: 'md', alignItems: 'flex-start',
              contents: [
                { type: 'text', text: '02', size: 'xs', weight: 'bold', color: COLORS.gold, flex: 0, margin: 'none' },
                { type: 'text', text: '和栗の皮から生まれたセラミドの開発秘話', size: 'sm', color: COLORS.text, flex: 1, wrap: true },
              ],
            },
            {
              type: 'box', layout: 'horizontal', spacing: 'md', alignItems: 'flex-start',
              contents: [
                { type: 'text', text: '03', size: 'xs', weight: 'bold', color: COLORS.gold, flex: 0, margin: 'none' },
                { type: 'text', text: '肌の土台を整えるスキンケアの知識', size: 'sm', color: COLORS.text, flex: 1, wrap: true },
              ],
            },
          ],
        },
        { type: 'separator', margin: 'xl', color: COLORS.border },
        { type: 'text', text: '発売まで、少しだけお付き合いください。', size: 'sm', color: COLORS.subtext, margin: 'lg', wrap: true },
      ],
    },
  };
}

/** ウェルカムメッセージ Bubble 3: 肌診断 CTA */
function flexWelcomeBubble3(skinDiagnosisUrl: string): object {
  return {
    type: 'bubble',
    hero: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.text,
      paddingAll: '28px',
      contents: [
        { type: 'text', text: 'あなたの肌タイプを\n教えてください', size: 'lg', weight: 'bold', color: COLORS.white, wrap: true, lineSpacing: '4px' },
        { type: 'text', text: '約30秒で完了', size: 'xs', color: 'rgba(255,255,255,0.6)', margin: 'sm' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: '診断結果をもとに、あなたの肌に合った情報をお届けします。', size: 'sm', color: COLORS.subtext, wrap: true, lineSpacing: '6px' },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      contents: [
        {
          type: 'button',
          action: { type: 'uri', label: '肌タイプ診断をはじめる', uri: skinDiagnosisUrl },
          style: 'primary',
          color: COLORS.text,
          height: 'md',
          cornerRadius: '40px',
        },
      ],
    },
  };
}

/** ウェルカムメッセージ（3バブル Carousel） */
function flexWelcomeCarousel(skinDiagnosisUrl: string): object {
  return {
    type: 'carousel',
    contents: [
      flexWelcomeBubble1(),
      flexWelcomeBubble2(),
      flexWelcomeBubble3(skinDiagnosisUrl),
    ],
  };
}

/** Step 2: 課題喚起 */
function flexStep2(): object {
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.bg,
      paddingAll: '24px',
      contents: [
        { type: 'text', text: 'Day 3', size: 'xs', color: COLORS.subtext, weight: 'bold', letterSpacing: '0.1em' },
        { type: 'text', text: 'あなたのスキンケア、足し算になっていませんか？', size: 'lg', weight: 'bold', color: COLORS.text, margin: 'md', wrap: true, lineSpacing: '4px' },
        { type: 'separator', margin: 'lg', color: COLORS.border },
        {
          type: 'text',
          text: '化粧水、美容液、乳液、クリーム、パック……。\n\nいつの間にか増えていくスキンケアアイテム。でも、肌の調子はなかなか安定しない。\n\nそんな経験はありませんか？',
          size: 'sm',
          color: COLORS.text,
          margin: 'lg',
          wrap: true,
          lineSpacing: '8px',
        },
        { type: 'separator', margin: 'xl', color: COLORS.border },
        {
          type: 'text',
          text: '現代のスキンケアは「足す」ことに注力してきました。しかし、過剰なケアは肌への負担にもなり得ます。',
          size: 'sm',
          color: COLORS.subtext,
          margin: 'xl',
          wrap: true,
          lineSpacing: '6px',
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'xl',
          backgroundColor: '#FEF3C7',
          cornerRadius: '8px',
          paddingAll: '14px',
          contents: [
            { type: 'text', text: '次回は、すべてのスキンケアの「原点」についてお話しします。', size: 'sm', color: COLORS.gold, wrap: true, weight: 'bold', lineSpacing: '4px' },
          ],
        },
      ],
    },
  };
}

/** Step 3: 解決策提示（保湿・セラミド）*/
function flexStep3(brandSiteUrl: string): object {
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.bg,
      paddingAll: '24px',
      contents: [
        { type: 'text', text: 'Day 7', size: 'xs', color: COLORS.subtext, weight: 'bold', letterSpacing: '0.1em' },
        { type: 'text', text: 'すべてのスキンケアの原点は、深い保湿にある。', size: 'lg', weight: 'bold', color: COLORS.text, margin: 'md', wrap: true, lineSpacing: '4px' },
        { type: 'separator', margin: 'lg', color: COLORS.border },
        {
          type: 'text',
          text: 'どんなに優れた成分も、肌が潤っていなければ届かない。\n\n肌のうるおいを守る鍵を握るのが「セラミド」。セラミドは肌の角質層に存在し、水分を抱え込んで乾燥から守るバリア機能の中心的な役割を果たしています。',
          size: 'sm',
          color: COLORS.text,
          margin: 'lg',
          wrap: true,
          lineSpacing: '8px',
        },
        {
          type: 'text',
          text: 'しかし、加齢や紫外線、摩擦によって、セラミドは日々減少していきます。',
          size: 'sm',
          color: COLORS.subtext,
          margin: 'lg',
          wrap: true,
          lineSpacing: '6px',
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'xl',
          backgroundColor: COLORS.text,
          cornerRadius: '8px',
          paddingAll: '14px',
          contents: [
            { type: 'text', text: 'nú:d が着目したのは、人の肌にあるセラミドと全く同じ構造を持つ「ヒト型セラミド」。しかも、その原料は意外なところに──', size: 'sm', color: COLORS.white, wrap: true, lineSpacing: '6px' },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      contents: [
        {
          type: 'button',
          action: { type: 'uri', label: '植物ヒト型セラミドの秘密を見る', uri: `${brandSiteUrl}/ingredients` },
          style: 'primary',
          color: COLORS.text,
          height: 'md',
          cornerRadius: '40px',
        },
      ],
    },
  };
}

/** Step 4: 共感（サステナビリティ）*/
function flexStep4(): object {
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.bg,
      paddingAll: '24px',
      contents: [
        { type: 'text', text: 'Day 14', size: 'xs', color: COLORS.subtext, weight: 'bold', letterSpacing: '0.1em' },
        { type: 'text', text: '捨てられるものから、美しさを。', size: 'xl', weight: 'bold', color: COLORS.text, margin: 'md', wrap: true, lineSpacing: '4px' },
        { type: 'separator', margin: 'lg', color: COLORS.border },
        {
          type: 'text',
          text: '日本では毎年、約1,000トン以上の栗の皮が廃棄されています。',
          size: 'sm',
          color: COLORS.text,
          margin: 'lg',
          wrap: true,
          lineSpacing: '6px',
        },
        {
          type: 'text',
          text: '私たちは、この「廃棄物」に着目しました。研究の結果、和栗の皮にはヒトの肌と同じ構造を持つセラミドが豊富に含まれていることが判明。これをアップサイクルし、高機能な美容成分として再生させることに成功しました。',
          size: 'sm',
          color: COLORS.text,
          margin: 'lg',
          wrap: true,
          lineSpacing: '8px',
        },
        { type: 'separator', margin: 'xl', color: COLORS.border },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'xl',
          spacing: 'md',
          contents: [
            { type: 'box', layout: 'vertical', cornerRadius: '8px', backgroundColor: '#F0FDF4', paddingAll: '12px', flex: 1, contents: [{ type: 'text', text: '肌に\nやさしい', size: 'xs', color: '#166534', wrap: true, align: 'center', weight: 'bold' }] },
            { type: 'box', layout: 'vertical', cornerRadius: '8px', backgroundColor: '#F0FDF4', paddingAll: '12px', flex: 1, contents: [{ type: 'text', text: '環境に\nやさしい', size: 'xs', color: '#166534', wrap: true, align: 'center', weight: 'bold' }] },
            { type: 'box', layout: 'vertical', cornerRadius: '8px', backgroundColor: '#F0FDF4', paddingAll: '12px', flex: 1, contents: [{ type: 'text', text: '地域に\nやさしい', size: 'xs', color: '#166534', wrap: true, align: 'center', weight: 'bold' }] },
          ],
        },
      ],
    },
  };
}

/** Step 5: ティザー（発売14日前）*/
function flexStep5(): object {
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.text,
      paddingAll: '32px',
      contents: [
        { type: 'text', text: '近日、お届けしたいものがあります。', size: 'lg', weight: 'bold', color: COLORS.white, wrap: true, lineSpacing: '4px' },
        { type: 'separator', margin: 'xl', color: 'rgba(255,255,255,0.2)' },
        { type: 'text', text: '素の肌を、信じる。\nその答えが、もうすぐ届きます。', size: 'sm', color: 'rgba(255,255,255,0.7)', margin: 'xl', wrap: true, lineSpacing: '8px' },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'xxl',
          backgroundColor: 'rgba(255,255,255,0.08)',
          cornerRadius: '12px',
          paddingAll: '20px',
          contents: [
            { type: 'text', text: '詳しくは、来週お伝えします。', size: 'sm', color: 'rgba(255,255,255,0.5)', align: 'center' },
          ],
        },
      ],
    },
  };
}

/** Step 6: 詳細公開（発売7日前）*/
function flexStep6(brandSiteUrl: string): object {
  return {
    type: 'bubble',
    hero: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.text,
      paddingAll: '28px',
      contents: [
        { type: 'text', text: 'FutureBase Serum', size: 'xl', weight: 'bold', color: COLORS.white },
        { type: 'text', text: 'nú:d の答え、すべてをお見せします。', size: 'sm', color: 'rgba(255,255,255,0.6)', margin: 'sm', wrap: true },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      backgroundColor: COLORS.bg,
      contents: [
        {
          type: 'box', layout: 'baseline', spacing: 'sm',
          contents: [
            { type: 'text', text: '¥4,980', size: 'xxl', weight: 'bold', color: COLORS.text, flex: 0 },
            { type: 'text', text: '税込 / 30ml', size: 'xs', color: COLORS.subtext, margin: 'sm' },
          ],
        },
        { type: 'separator', margin: 'lg', color: COLORS.border },
        { type: 'text', text: '水のように広がり、オイルのように守る。\n化粧水の後、たった1〜2プッシュ。', size: 'sm', color: COLORS.text, margin: 'lg', wrap: true, lineSpacing: '8px' },
        {
          type: 'box', layout: 'vertical', margin: 'lg', spacing: 'sm',
          contents: [
            { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [{ type: 'text', text: '•', color: COLORS.gold, flex: 0 }, { type: 'text', text: '植物ヒト型セラミド（セラミドAP）', size: 'sm', color: COLORS.text, wrap: true }] },
            { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [{ type: 'text', text: '•', color: COLORS.gold, flex: 0 }, { type: 'text', text: 'トリプルヒアルロン酸', size: 'sm', color: COLORS.text, wrap: true }] },
            { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [{ type: 'text', text: '•', color: COLORS.gold, flex: 0 }, { type: 'text', text: '有機米ぬかエキス', size: 'sm', color: COLORS.text, wrap: true }] },
          ],
        },
        { type: 'text', text: '敏感肌・乾燥肌・ゆらぎ肌、性別も年齢も関係なく、すべての方へ。', size: 'xs', color: COLORS.subtext, margin: 'lg', wrap: true },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      backgroundColor: COLORS.bg,
      contents: [
        {
          type: 'button',
          action: { type: 'uri', label: '使い方ガイドを見る', uri: `${brandSiteUrl}/how-to-use` },
          style: 'primary',
          color: COLORS.text,
          height: 'md',
          cornerRadius: '40px',
        },
      ],
    },
  };
}

/** Step 7: カウントダウン + 先行予約（発売3日前）*/
function flexStep7(brandSiteUrl: string): object {
  return {
    type: 'bubble',
    hero: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.text,
      paddingAll: '20px',
      contents: [
        { type: 'text', text: '{{name}} さまへ', size: 'sm', color: 'rgba(255,255,255,0.5)' },
        { type: 'text', text: 'あと3日。', size: 'xxl', weight: 'bold', color: COLORS.white, margin: 'sm' },
        { type: 'text', text: 'LINE 限定の先行予約を本日より開始します。', size: 'sm', color: 'rgba(255,255,255,0.7)', margin: 'sm', wrap: true },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      backgroundColor: COLORS.bg,
      contents: [
        { type: 'text', text: '＜先行予約特典＞', size: 'sm', weight: 'bold', color: COLORS.text },
        {
          type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm',
          contents: [
            {
              type: 'box', layout: 'horizontal', spacing: 'sm',
              contents: [
                { type: 'text', text: '✓', color: COLORS.gold, flex: 0, weight: 'bold' },
                { type: 'text', text: '初回限定 送料無料', size: 'sm', color: COLORS.text, wrap: true },
              ],
            },
            {
              type: 'box', layout: 'horizontal', spacing: 'sm',
              contents: [
                { type: 'text', text: '✓', color: COLORS.gold, flex: 0, weight: 'bold' },
                { type: 'text', text: 'nú:d オリジナルサンプルセット付き\n（※数量限定・なくなり次第終了）', size: 'sm', color: COLORS.text, wrap: true },
              ],
            },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'sm',
      backgroundColor: COLORS.bg,
      contents: [
        {
          type: 'button',
          action: { type: 'uri', label: '先行予約はこちら', uri: `${brandSiteUrl}/preorder` },
          style: 'primary',
          color: COLORS.text,
          height: 'md',
          cornerRadius: '40px',
        },
      ],
    },
  };
}

// ── Phase 4: 購入後フォローアップ Flex ──────────────────────────────────────

/** 購入直後: お礼 */
function flexPurchaseThankYou(): object {
  return {
    type: 'bubble',
    hero: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.text,
      paddingAll: '28px',
      contents: [
        { type: 'text', text: 'ご注文ありがとうございます', size: 'lg', weight: 'bold', color: COLORS.white, wrap: true },
        { type: 'text', text: '{{name}} さまの素の肌づくりが始まります。', size: 'sm', color: 'rgba(255,255,255,0.6)', margin: 'sm', wrap: true },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: 'ご注文を確認しました。商品は順次発送いたします。', size: 'sm', color: COLORS.text, wrap: true, lineSpacing: '6px' },
        { type: 'separator', margin: 'lg', color: COLORS.border },
        { type: 'text', text: '届いたらすぐに正しい使い方をチェックできるよう、使い方ガイドをご用意しています。', size: 'sm', color: COLORS.subtext, margin: 'lg', wrap: true, lineSpacing: '6px' },
      ],
    },
  };
}

/** 購入3日後: 使い方ガイド */
function flexHowToUse(brandSiteUrl: string): object {
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.bg,
      paddingAll: '24px',
      contents: [
        { type: 'text', text: '正しい使い方で\n効果を最大に。', size: 'lg', weight: 'bold', color: COLORS.text, wrap: true, lineSpacing: '4px' },
        { type: 'separator', margin: 'lg', color: COLORS.border },
        { type: 'text', text: 'FutureBase Serum の使い方', size: 'sm', weight: 'bold', color: COLORS.text, margin: 'lg' },
        {
          type: 'box', layout: 'vertical', margin: 'md', spacing: 'md',
          contents: [
            { type: 'box', layout: 'horizontal', spacing: 'md', contents: [{ type: 'text', text: 'STEP 1', size: 'xs', color: COLORS.gold, flex: 0, weight: 'bold' }, { type: 'text', text: '洗顔', size: 'sm', color: COLORS.text }] },
            { type: 'box', layout: 'horizontal', spacing: 'md', contents: [{ type: 'text', text: 'STEP 2', size: 'xs', color: COLORS.gold, flex: 0, weight: 'bold' }, { type: 'text', text: '化粧水', size: 'sm', color: COLORS.text }] },
            { type: 'box', layout: 'horizontal', spacing: 'md', contents: [{ type: 'text', text: 'STEP 3', size: 'xs', color: COLORS.gold, flex: 0, weight: 'bold' }, { type: 'text', text: 'FutureBase Serum（1〜2プッシュ）', size: 'sm', color: COLORS.text, wrap: true }] },
            { type: 'box', layout: 'horizontal', spacing: 'md', contents: [{ type: 'text', text: 'STEP 4', size: 'xs', color: COLORS.gold, flex: 0, weight: 'bold' }, { type: 'text', text: '乳液（必要に応じて）', size: 'sm', color: COLORS.text, wrap: true }] },
          ],
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'xl',
          backgroundColor: '#FEF3C7',
          cornerRadius: '8px',
          paddingAll: '14px',
          contents: [
            { type: 'text', text: '💡 ポイント', size: 'xs', color: COLORS.gold, weight: 'bold' },
            { type: 'text', text: '手のひらで軽く温めてから、顔全体にハンドプレスで押し込むように使用するとより効果的です。', size: 'sm', color: COLORS.gold, wrap: true, margin: 'sm', lineSpacing: '6px' },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      contents: [
        {
          type: 'button',
          action: { type: 'uri', label: '詳しい使い方ガイドを見る', uri: `${brandSiteUrl}/how-to-use` },
          style: 'primary',
          color: COLORS.text,
          height: 'md',
          cornerRadius: '40px',
        },
      ],
    },
  };
}

/** 購入7日後: FAQ */
function flexFaq(brandSiteUrl: string): object {
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.bg,
      paddingAll: '24px',
      contents: [
        { type: 'text', text: 'よくあるご質問', size: 'lg', weight: 'bold', color: COLORS.text },
        { type: 'separator', margin: 'lg', color: COLORS.border },
        ...[
          { q: '1本でどのくらい持ちますか？', a: '1日2回のご使用で、約1〜1.5ヶ月分です。' },
          { q: '他の製品と併用できますか？', a: '化粧水の後、乳液の前のご使用を推奨しています。他の美容液との併用も問題ありません。' },
          { q: '敏感肌でも使えますか？', a: '無香料・無着色・低刺激処方です。ただし、初めてご使用の際はパッチテストをお勧めします。' },
        ].flatMap(({ q, a }) => [
          { type: 'box', layout: 'vertical', margin: 'lg', contents: [
            { type: 'text', text: `Q. ${q}`, size: 'sm', weight: 'bold', color: COLORS.text, wrap: true },
            { type: 'text', text: `A. ${a}`, size: 'sm', color: COLORS.subtext, margin: 'sm', wrap: true, lineSpacing: '4px' },
          ]},
          { type: 'separator', margin: 'md', color: COLORS.border },
        ] as object[]),
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      contents: [
        {
          type: 'button',
          action: { type: 'uri', label: 'FAQ をすべて見る', uri: `${brandSiteUrl}/faq` },
          style: 'secondary',
          color: COLORS.text,
          height: 'md',
          cornerRadius: '40px',
        },
      ],
    },
  };
}

/** 購入14日後: アンケート + クーポン */
function flexSurveyAndCoupon(brandSiteUrl: string): object {
  return {
    type: 'bubble',
    hero: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.text,
      paddingAll: '24px',
      contents: [
        { type: 'text', text: '使い始めて\n2週間が経ちました。', size: 'lg', weight: 'bold', color: COLORS.white, wrap: true, lineSpacing: '4px' },
        { type: 'text', text: '{{name}} さまの肌の変化を教えてください。', size: 'sm', color: 'rgba(255,255,255,0.6)', margin: 'sm', wrap: true },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      backgroundColor: COLORS.bg,
      contents: [
        { type: 'text', text: '簡単な使用感アンケート（5問・約1分）にご回答いただいた方に、次回購入で使える特典をプレゼントします。', size: 'sm', color: COLORS.text, wrap: true, lineSpacing: '6px' },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          backgroundColor: '#FEF3C7',
          cornerRadius: '8px',
          paddingAll: '14px',
          contents: [
            { type: 'text', text: '🎁 回答者特典', size: 'xs', color: COLORS.gold, weight: 'bold' },
            { type: 'text', text: '次回購入 10% OFF クーポン', size: 'md', color: COLORS.gold, weight: 'bold', margin: 'sm' },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          action: { type: 'uri', label: 'アンケートに答える', uri: `${brandSiteUrl}/survey` },
          style: 'primary',
          color: COLORS.text,
          height: 'md',
          cornerRadius: '40px',
        },
      ],
    },
  };
}

/** 購入25日後: 継続の重要性 */
function flexContinuationMessage(): object {
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.bg,
      paddingAll: '24px',
      contents: [
        { type: 'text', text: 'もうすぐ1本目が\n終わる頃ですね。', size: 'lg', weight: 'bold', color: COLORS.text, wrap: true, lineSpacing: '4px' },
        { type: 'separator', margin: 'lg', color: COLORS.border },
        {
          type: 'text',
          text: '肌のターンオーバー（新陳代謝）の周期は約28日といわれています。\n\n1本使い切る頃にちょうど肌の生まれ変わりが1サイクル完了するタイミング。',
          size: 'sm',
          color: COLORS.text,
          margin: 'lg',
          wrap: true,
          lineSpacing: '8px',
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'xl',
          backgroundColor: COLORS.text,
          cornerRadius: '8px',
          paddingAll: '16px',
          contents: [
            { type: 'text', text: '2本目からが、本当の土台づくりです。', size: 'sm', color: COLORS.white, weight: 'bold', wrap: true },
            { type: 'text', text: 'ここでやめてしまうのはもったいない。セラミドによるうるおいの土台は、継続することで安定していきます。', size: 'xs', color: 'rgba(255,255,255,0.7)', margin: 'sm', wrap: true, lineSpacing: '6px' },
          ],
        },
      ],
    },
  };
}

/** 購入30日後: リピート購入案内 */
function flexRepeatPurchase(brandSiteUrl: string): object {
  return {
    type: 'bubble',
    hero: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: COLORS.text,
      paddingAll: '24px',
      contents: [
        { type: 'text', text: '{{name}} さま', size: 'sm', color: 'rgba(255,255,255,0.5)' },
        { type: 'text', text: 'FutureBase Serum を\nお使いいただいて約1ヶ月。', size: 'lg', weight: 'bold', color: COLORS.white, margin: 'sm', wrap: true, lineSpacing: '4px' },
        { type: 'text', text: '肌の調子はいかがですか？', size: 'sm', color: 'rgba(255,255,255,0.7)', margin: 'sm' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      backgroundColor: COLORS.bg,
      contents: [
        { type: 'text', text: '継続してお使いいただくことで、セラミドによるうるおいの土台がより安定していきます。', size: 'sm', color: COLORS.text, wrap: true, lineSpacing: '6px' },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'sm',
      backgroundColor: COLORS.bg,
      contents: [
        {
          type: 'button',
          action: { type: 'uri', label: '2本目のご注文はこちら', uri: `${brandSiteUrl}/buy` },
          style: 'primary',
          color: COLORS.text,
          height: 'md',
          cornerRadius: '40px',
        },
        {
          type: 'button',
          action: { type: 'uri', label: 'お得な定期コースの詳細', uri: `${brandSiteUrl}/subscription` },
          style: 'secondary',
          color: COLORS.text,
          height: 'sm',
          cornerRadius: '40px',
          margin: 'sm',
        },
      ],
    },
  };
}

// ── メイン処理 ──────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 nú:d CRM セットアップ開始\n');

  // 1. テンプレートを登録
  console.log('📄 Flex メッセージテンプレートを登録中...');

  const templateDefs = [
    { name: '[Phase1] ウェルカムメッセージ', category: 'nud_phase1', flex: flexWelcomeCarousel(SKIN_DIAGNOSIS_URL) },
    { name: '[Phase2-1] 課題喚起（Day3）', category: 'nud_phase2', flex: flexStep2() },
    { name: '[Phase2-2] 解決策・セラミド（Day7）', category: 'nud_phase2', flex: flexStep3(BRAND_SITE_URL) },
    { name: '[Phase2-3] 共感・サステナ（Day14）', category: 'nud_phase2', flex: flexStep4() },
    { name: '[Phase3-1] ティザー（発売14日前）', category: 'nud_phase3', flex: flexStep5() },
    { name: '[Phase3-2] 詳細公開（発売7日前）', category: 'nud_phase3', flex: flexStep6(BRAND_SITE_URL) },
    { name: '[Phase3-3] カウントダウン先行予約（発売3日前）', category: 'nud_phase3', flex: flexStep7(BRAND_SITE_URL) },
    { name: '[Phase4-1] 購入お礼（購入直後）', category: 'nud_phase4', flex: flexPurchaseThankYou() },
    { name: '[Phase4-2] 使い方ガイド（購入3日後）', category: 'nud_phase4', flex: flexHowToUse(BRAND_SITE_URL) },
    { name: '[Phase4-3] FAQ（購入7日後）', category: 'nud_phase4', flex: flexFaq(BRAND_SITE_URL) },
    { name: '[Phase4-4] アンケート+クーポン（購入14日後）', category: 'nud_phase4', flex: flexSurveyAndCoupon(BRAND_SITE_URL) },
    { name: '[Phase4-5] 継続の重要性（購入25日後）', category: 'nud_phase4', flex: flexContinuationMessage() },
    { name: '[Phase4-6] リピート購入案内（購入30日後）', category: 'nud_phase4', flex: flexRepeatPurchase(BRAND_SITE_URL) },
  ];

  const createdTemplates: Record<string, string> = {};
  for (const tmpl of templateDefs) {
    try {
      const res = await api<{ success: boolean; data: { id: string } }>('POST', '/api/templates', {
        name: tmpl.name,
        category: tmpl.category,
        messageType: 'flex',
        messageContent: JSON.stringify(tmpl.flex),
      });
      createdTemplates[tmpl.name] = res.data.id;
      console.log(`  ✅ ${tmpl.name}`);
    } catch (e) {
      console.error(`  ❌ ${tmpl.name}:`, e);
    }
  }

  // 2. ウェイトリストシナリオ（friend_add トリガー）を作成
  console.log('\n📋 ウェイトリストシナリオを作成中...');

  let scenarioId: string | null = null;
  try {
    const res = await api<{ success: boolean; data: { id: string } }>('POST', '/api/scenarios', {
      name: 'nú:d ウェイトリスト〜発売シナリオ',
      description: '友だち追加から発売日までのナーチャリング自動配信（Phase 1-3）',
      triggerType: 'friend_add',
      isActive: false,
      lineAccountId: LINE_ACCOUNT_ID || undefined,
    });
    scenarioId = res.data.id;
    console.log(`  ✅ シナリオ作成: ${scenarioId}`);
  } catch (e) {
    console.error('  ❌ シナリオ作成失敗:', e);
  }

  if (scenarioId) {
    const steps = [
      { order: 1, delay: 0, name: 'ウェルカム', flex: flexWelcomeCarousel(SKIN_DIAGNOSIS_URL) },
      { order: 2, delay: 3 * 24 * 60, name: '課題喚起（3日後）', flex: flexStep2() },
      { order: 3, delay: 7 * 24 * 60, name: '解決策（7日後）', flex: flexStep3(BRAND_SITE_URL) },
      { order: 4, delay: 14 * 24 * 60, name: '共感（14日後）', flex: flexStep4() },
    ];

    for (const step of steps) {
      try {
        await api('POST', `/api/scenarios/${scenarioId}/steps`, {
          stepOrder: step.order,
          delayMinutes: step.delay,
          messageType: 'flex',
          messageContent: JSON.stringify(step.flex),
        });
        console.log(`  ✅ Step ${step.order}: ${step.name}`);
      } catch (e) {
        console.error(`  ❌ Step ${step.order} 作成失敗:`, e);
      }
    }
  }

  // 3. 購入後フォローアップシナリオ（manual トリガー）を作成
  console.log('\n📋 購入後フォローアップシナリオを作成中...');

  let postPurchaseId: string | null = null;
  try {
    const res = await api<{ success: boolean; data: { id: string } }>('POST', '/api/scenarios', {
      name: 'nú:d 購入後フォローアップ（Phase 4）',
      description: '購入後14日間の手厚いフォロー + 25〜30日後のリピート促進',
      triggerType: 'manual',
      isActive: false,
      lineAccountId: LINE_ACCOUNT_ID || undefined,
    });
    postPurchaseId = res.data.id;
    console.log(`  ✅ シナリオ作成: ${postPurchaseId}`);
  } catch (e) {
    console.error('  ❌ シナリオ作成失敗:', e);
  }

  if (postPurchaseId) {
    const purchaseSteps = [
      { order: 1, delay: 0, name: '購入お礼（即時）', flex: flexPurchaseThankYou() },
      { order: 2, delay: 3 * 24 * 60, name: '使い方ガイド（3日後）', flex: flexHowToUse(BRAND_SITE_URL) },
      { order: 3, delay: 7 * 24 * 60, name: 'FAQ（7日後）', flex: flexFaq(BRAND_SITE_URL) },
      { order: 4, delay: 14 * 24 * 60, name: 'アンケート+クーポン（14日後）', flex: flexSurveyAndCoupon(BRAND_SITE_URL) },
      { order: 5, delay: 25 * 24 * 60, name: '継続の重要性（25日後）', flex: flexContinuationMessage() },
      { order: 6, delay: 30 * 24 * 60, name: 'リピート購入案内（30日後）', flex: flexRepeatPurchase(BRAND_SITE_URL) },
    ];

    for (const step of purchaseSteps) {
      try {
        await api('POST', `/api/scenarios/${postPurchaseId}/steps`, {
          stepOrder: step.order,
          delayMinutes: step.delay,
          messageType: 'flex',
          messageContent: JSON.stringify(step.flex),
        });
        console.log(`  ✅ Step ${step.order}: ${step.name}`);
      } catch (e) {
        console.error(`  ❌ Step ${step.order} 作成失敗:`, e);
      }
    }
  }

  console.log('\n✅ nú:d CRM セットアップ完了！\n');
  console.log('次のステップ:');
  console.log('  1. 管理画面 > シナリオ でシナリオを確認・有効化');
  console.log('  2. 管理画面 > リッチメニュー でリッチメニューを作成');
  console.log('  3. 管理画面 > オートメーション で switch_rich_menu を設定');
  console.log('  4. LINE Developers でウェルカムメッセージを無効化（シナリオで送信するため）');
  if (scenarioId) console.log(`\n  ウェイトリストシナリオ ID: ${scenarioId}`);
  if (postPurchaseId) console.log(`  購入後フォローシナリオ ID: ${postPurchaseId}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
