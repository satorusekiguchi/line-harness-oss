'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { ConversionPoint } from '@line-crm/shared'
import Header from '@/components/layout/header'

interface ConversionReportItem {
  conversionPointId: string
  conversionPointName: string
  eventType: string
  totalCount: number
  totalValue: number
}

const FUNNEL_STAGES = [
  { types: ['friend_add'],                label: '認知', color: '#6366f1', emoji: '👥' },
  { types: ['waitlist_signup'],           label: '獲得', color: '#8b5cf6', emoji: '📋' },
  { types: ['message_click'],             label: '関心', color: '#a78bfa', emoji: '🔗' },
  { types: ['form_submit'],               label: '関心',  color: '#a78bfa', emoji: '📝' },
  { types: ['ec_visit', 'product_view'],  label: '検討', color: '#06b6d4', emoji: '🔍' },
  { types: ['add_to_cart'],               label: '意向', color: '#f59e0b', emoji: '🛒' },
  { types: ['checkout_start'],            label: '意向', color: '#f97316', emoji: '💳' },
  { types: ['purchase', 'coupon_used'],   label: '購入', color: '#10b981', emoji: '✅' },
]

const EVENT_TYPE_LABELS: Record<string, string> = {
  friend_add:      'LINE友だち追加',
  waitlist_signup: 'ウェイトリスト登録',
  message_click:   'LINEリンククリック',
  form_submit:     'フォーム・アンケート回答',
  ec_visit:        'ECサイト訪問',
  product_view:    '商品ページ閲覧',
  add_to_cart:     'カート追加',
  checkout_start:  'チェックアウト開始',
  purchase:        '購入完了',
  coupon_used:     'クーポン使用',
}

const WORKER_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://line-crm-worker.mumumuinc.workers.dev'

export default function ConversionsPage() {
  const [points, setPoints] = useState<ConversionPoint[]>([])
  const [report, setReport] = useState<ConversionReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'funnel' | 'points' | 'code'>('funnel')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', eventType: '', value: '' })
  const [codeTarget, setCodeTarget] = useState<string>('product_view')

  const load = async () => {
    setLoading(true)
    try {
      const [pointsRes, reportRes] = await Promise.allSettled([
        api.conversions.points(),
        api.conversions.report(),
      ])
      if (pointsRes.status === 'fulfilled' && pointsRes.value.success) setPoints(pointsRes.value.data)
      if (reportRes.status === 'fulfilled' && reportRes.value.success) setReport(reportRes.value.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.eventType) return
    try {
      await api.conversions.createPoint({
        name: form.name,
        eventType: form.eventType,
        value: form.value ? Number(form.value) : null,
      })
      setForm({ name: '', eventType: '', value: '' })
      setShowCreate(false)
      load()
    } catch {}
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このCVポイントを削除しますか？')) return
    await api.conversions.deletePoint(id)
    load()
  }

  // ── funnel helpers ──────────────────────────────────────────────────────
  const getCount = (types: string[]) =>
    report
      .filter((r) => types.includes(r.eventType))
      .reduce((s, r) => s + r.totalCount, 0)

  const getRevenue = (types: string[]) =>
    report
      .filter((r) => types.includes(r.eventType))
      .reduce((s, r) => s + r.totalValue, 0)

  const topCount = getCount(FUNNEL_STAGES[0].types) || 1
  const funnelData = FUNNEL_STAGES.map((s) => ({
    ...s,
    count: getCount(s.types),
    revenue: getRevenue(s.types),
    pct: Math.round((getCount(s.types) / topCount) * 100),
  }))

  const totalRevenue = report.filter(r => ['purchase','coupon_used'].includes(r.eventType)).reduce((s,r) => s + r.totalValue, 0)

  // ── code snippets ───────────────────────────────────────────────────────
  const pixelSnippet = (eventType: string) =>
`<!-- LINE CRM CV計測ピクセル: ${EVENT_TYPE_LABELS[eventType] ?? eventType} -->
<!-- LINEのUUIDをlocalStorageまたはURLパラメータから取得して埋め込む -->
<script>
(function() {
  var uid = localStorage.getItem('line_uid') || new URLSearchParams(location.search).get('uid');
  if (!uid) return;
  var img = new Image();
  img.src = '${WORKER_URL}/track?cp=${eventType}&uid=' + encodeURIComponent(uid);
})();
</script>`

  const purchaseSnippet = `<!-- LINE CRM 購入完了CV — 注文完了ページに設置 -->
<script>
(function() {
  var uid = localStorage.getItem('line_uid');
  if (!uid) return;

  // ★ 注文データを実際の値に置き換えてください
  fetch('${WORKER_URL}/api/track/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uid: uid,
      orderId: '{{ order.id }}',          // テンプレート変数
      amount: {{ order.total_price }},     // 注文金額
      couponCode: '{{ discount_code }}',  // クーポンコード（任意）
    })
  });
})();
</script>`

  const liffSnippet = `<!-- LINEのUUIDをECサイトで保持するためのLIFF初期化スクリプト -->
<!-- head タグ内に一度だけ設置 -->
<script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
<script>
liff.init({ liffId: '【LIFF ID】' }).then(function() {
  if (liff.isLoggedIn()) {
    liff.getProfile().then(function(profile) {
      // LINE UUID をlocalStorageに保存
      localStorage.setItem('line_uid', profile.userId);
      console.log('[LINE CRM] UUID saved:', profile.userId);
    });
  }
});
</script>

<!-- または、LIFFを使わない場合は /auth/line のコールバックでUUIDをCookieに保存 -->
<!-- /auth/callback でフロントエンドに渡す実装が必要 -->`

  const activeTypes = Object.keys(EVENT_TYPE_LABELS)

  return (
    <div>
      <Header
        title="コンバージョン計測"
        description="ECファネル分析 & CVポイント管理"
        action={
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 min-h-[44px] rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: '#06C755' }}
          >
            {showCreate ? 'キャンセル' : '+ CVポイント作成'}
          </button>
        }
      />

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CV名</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="購入完了" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">イベントタイプ</label>
              <select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required>
                <option value="">選択...</option>
                {activeTypes.map((t) => (
                  <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
                ))}
                <option value="custom">カスタム</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">固定金額 (任意)</label>
              <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="空欄=実際の金額を使用" />
            </div>
          </div>
          <button type="submit" className="mt-4 px-4 py-2 min-h-[44px] rounded-lg text-white text-sm font-medium" style={{ backgroundColor: '#06C755' }}>
            作成
          </button>
        </form>
      )}

      {/* タブ */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {(['funnel', 'points', 'code'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'funnel' ? '📊 ファネル' : t === 'points' ? '⚙️ CVポイント一覧' : '🔧 ECサイト連携コード'}
          </button>
        ))}
      </div>

      {/* ── ファネルタブ ── */}
      {tab === 'funnel' && (
        <div>
          {/* KPI サマリー */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">LINE友だち</p>
              <p className="text-2xl font-bold text-gray-900">{getCount(['friend_add']).toLocaleString()}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">ウェイトリスト</p>
              <p className="text-2xl font-bold text-purple-600">{getCount(['waitlist_signup']).toLocaleString()}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">購入件数</p>
              <p className="text-2xl font-bold text-green-600">{getCount(['purchase']).toLocaleString()}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">売上合計</p>
              <p className="text-2xl font-bold text-green-600">
                {totalRevenue > 0 ? `¥${totalRevenue.toLocaleString()}` : '—'}
              </p>
            </div>
          </div>

          {/* ファネル */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-6">購買ファネル（LINE友だち → 購入）</h2>
            <div className="space-y-3">
              {funnelData.map((stage, i) => (
                <div key={i}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-lg w-6">{stage.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          {stage.types.map(t => EVENT_TYPE_LABELS[t] ?? t).join(' / ')}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{stage.label}</span>
                          <span className="text-sm font-bold text-gray-900">{stage.count.toLocaleString()} 件</span>
                          <span className="text-xs text-gray-400 w-12 text-right">{stage.pct}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-2 rounded-full transition-all duration-700"
                          style={{ width: `${Math.max(stage.pct, stage.count > 0 ? 2 : 0)}%`, backgroundColor: stage.color }}
                        />
                      </div>
                    </div>
                  </div>
                  {i < funnelData.length - 1 && stage.count > 0 && funnelData[i + 1].count > 0 && (
                    <div className="ml-9 text-xs text-gray-400 mb-2">
                      ↳ 次ステップ移行率: {Math.round((funnelData[i + 1].count / Math.max(stage.count, 1)) * 100)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {loading && (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">読み込み中...</div>
          )}
          {!loading && report.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <p className="text-amber-700 font-medium mb-2">まだCVデータがありません</p>
              <p className="text-amber-600 text-sm">「ECサイト連携コード」タブのコードをECサイトに設置するとデータが蓄積されます。</p>
            </div>
          )}
        </div>
      )}

      {/* ── CVポイント一覧タブ ── */}
      {tab === 'points' && (
        <div>
          {loading ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">読み込み中...</div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CV名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">イベントタイプ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">固定金額</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">計測数</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">自動計測</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {points.map((point) => {
                    const rep = report.find((r) => r.conversionPointId === point.id)
                    const isAuto = ['friend_add', 'form_submit', 'message_click'].includes(point.eventType)
                    return (
                      <tr key={point.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{point.name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-mono">{point.eventType}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {point.value !== null ? `¥${point.value.toLocaleString()}` : '実際の金額'}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">{(rep?.totalCount ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          {isAuto
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">自動</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">JSタグ</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDelete(point.id)} className="text-red-400 hover:text-red-600 text-sm">削除</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ECサイト連携コードタブ ── */}
      {tab === 'code' && (
        <div className="space-y-6">
          {/* STEP 1: UUID保持 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">1</span>
              <h3 className="font-semibold text-gray-900">LINE UUID をECサイトで保持する</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4 ml-8">友だち追加後、ECサイトにLINE UUIDを引き継ぐためのコードです。ECサイトの全ページの &lt;head&gt; に一度だけ設置してください。</p>
            <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{liffSnippet}</pre>
          </div>

          {/* STEP 2: ページ計測 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">2</span>
              <h3 className="font-semibold text-gray-900">ページ閲覧・行動のCV計測ピクセル</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4 ml-8">計測したいページ・タイミングに応じてコードを選択してください。</p>
            <div className="flex gap-2 flex-wrap mb-4 ml-8">
              {['ec_visit','product_view','add_to_cart','checkout_start'].map((t) => (
                <button key={t} onClick={() => setCodeTarget(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${codeTarget === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}>
                  {EVENT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{pixelSnippet(codeTarget)}</pre>
          </div>

          {/* STEP 3: 購入完了 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">3</span>
              <h3 className="font-semibold text-gray-900">購入完了CV（最重要）</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4 ml-8">注文完了ページに設置します。実際の注文金額・クーポンコードが自動的に記録されます。</p>
            <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{purchaseSnippet}</pre>
          </div>

          {/* APIエンドポイント一覧 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4">📡 利用可能なAPIエンドポイント</h3>
            <div className="space-y-3">
              {[
                { method: 'GET', path: '/track', desc: 'ピクセルトラッキング（&lt;img&gt; タグ埋め込み）', params: '?cp=EVENT_TYPE&uid=LINE_UUID' },
                { method: 'POST', path: '/api/track/ec', desc: 'JSON形式のCV送信（fetch() から呼び出し）', params: '{ eventType, uid, value? }' },
                { method: 'POST', path: '/api/track/purchase', desc: '購入完了Webhook（Shopify等から呼び出し）', params: '{ uid, orderId, amount, couponCode? }' },
              ].map((ep) => (
                <div key={ep.path} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold shrink-0 ${ep.method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{ep.method}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-gray-900">{WORKER_URL}{ep.path}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{ep.desc}</p>
                    <p className="text-xs font-mono text-gray-400 mt-0.5" dangerouslySetInnerHTML={{ __html: ep.params }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
