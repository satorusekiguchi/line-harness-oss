'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAccount } from '@/contexts/account-context'
import Header from '@/components/layout/header'
import CcPromptButton from '@/components/cc-prompt-button'

type AutomationEventType = "friend_add" | "tag_change" | "score_threshold" | "cv_fire" | "message_received" | "calendar_booked"

interface AutomationAction {
  type: "add_tag" | "remove_tag" | "start_scenario" | "send_message" | "send_webhook" | "switch_rich_menu" | "remove_rich_menu"
  params: Record<string, unknown>
}

interface RichMenuEntry {
  richMenuId: string
  name: string
  config?: { name?: string; target_segment?: string } | null
}

interface Automation {
  id: string
  name: string
  description: string | null
  eventType: AutomationEventType
  conditions: Record<string, unknown>
  actions: AutomationAction[]
  isActive: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

const eventTypeOptions: { value: AutomationEventType; label: string }[] = [
  { value: 'friend_add', label: '友だち追加' },
  { value: 'tag_change', label: 'タグ変更' },
  { value: 'score_threshold', label: 'スコア閾値' },
  { value: 'cv_fire', label: 'CV発火' },
  { value: 'message_received', label: 'メッセージ受信' },
  { value: 'calendar_booked', label: 'カレンダー予約' },
]

const eventTypeLabelMap: Record<AutomationEventType, string> = {
  friend_add: '友だち追加',
  tag_change: 'タグ変更',
  score_threshold: 'スコア閾値',
  cv_fire: 'CV発火',
  message_received: 'メッセージ受信',
  calendar_booked: 'カレンダー予約',
}

const eventTypeBadgeColor: Record<AutomationEventType, string> = {
  friend_add: 'bg-green-100 text-green-700',
  tag_change: 'bg-blue-100 text-blue-700',
  score_threshold: 'bg-yellow-100 text-yellow-700',
  cv_fire: 'bg-red-100 text-red-700',
  message_received: 'bg-purple-100 text-purple-700',
  calendar_booked: 'bg-indigo-100 text-indigo-700',
}

interface CreateFormState {
  name: string
  description: string
  eventType: AutomationEventType
  actionsJson: string
  conditionsJson: string
  priority: number
}

const SEGMENT_LABELS: Record<string, string> = {
  teaser: 'ティザー期',
  non_purchaser: '未購入者',
  purchaser: '購入者',
  subscriber: '定期購入者',
}

const initialForm: CreateFormState = {
  name: '',
  description: '',
  eventType: 'friend_add',
  actionsJson: '[\n  {\n    "type": "add_tag",\n    "params": {}\n  }\n]',
  conditionsJson: '{}',
  priority: 0,
}

/** switch_rich_menu アクション用プリセット */
const RICH_MENU_ACTION_PRESETS = [
  {
    label: '友だち追加時 → ティザー期メニューに切替',
    eventType: 'friend_add' as AutomationEventType,
    actions: [{ type: 'switch_rich_menu', params: { richMenuId: '' } }],
    conditions: {},
    description: '友だち追加イベント発生時にティザー期のリッチメニューを設定します',
  },
  {
    label: '購入タグ付与時 → 購入者メニューに切替',
    eventType: 'tag_change' as AutomationEventType,
    actions: [{ type: 'switch_rich_menu', params: { richMenuId: '' } }],
    conditions: { tagName: '購入済み', action: 'add' },
    description: '購入済みタグが付与されたユーザーのリッチメニューを購入者用に切替します',
  },
  {
    label: '定期購入タグ付与時 → 定期会員メニューに切替',
    eventType: 'tag_change' as AutomationEventType,
    actions: [{ type: 'switch_rich_menu', params: { richMenuId: '' } }],
    conditions: { tagName: '定期購入', action: 'add' },
    description: '定期購入タグが付与されたユーザーのリッチメニューを定期会員用に切替します',
  },
]

const ccPrompts = [
  {
    title: 'オートメーションルール作成',
    prompt: `新しいオートメーションルールを作成するサポートをしてください。
1. 利用可能なイベントタイプ（友だち追加、タグ変更、スコア閾値等）の説明
2. アクション設定のJSON形式テンプレートを提供
3. 条件設定と優先度の推奨値を提案
手順を示してください。`,
  },
  {
    title: 'オートメーション効果分析',
    prompt: `現在のオートメーションルールの効果を分析してください。
1. 各ルールの発火回数と成功率を確認
2. イベントタイプ別の自動化カバレッジを評価
3. 効果の低いルールの改善提案と新規ルールの推奨
結果をレポートしてください。`,
  },
]

export default function AutomationsPage() {
  const { selectedAccountId } = useAccount()
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateFormState>({ ...initialForm })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [richMenus, setRichMenus] = useState<RichMenuEntry[]>([])
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number | null>(null)

  const loadAutomations = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.automations.list({ accountId: selectedAccountId || undefined })
      if (res.success) {
        setAutomations(res.data)
      } else {
        setError(res.error)
      }
    } catch {
      setError('オートメーションの読み込みに失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }, [selectedAccountId])

  useEffect(() => {
    loadAutomations()
  }, [loadAutomations])

  // リッチメニュー一覧を取得（switch_rich_menu アクションのセレクト用）
  useEffect(() => {
    const fetchMenus = async () => {
      try {
        const res = await api.richMenus.list({ accountId: selectedAccountId || undefined })
        if (res.success) setRichMenus(res.data as RichMenuEntry[])
      } catch { /* ignore */ }
    }
    fetchMenus()
  }, [selectedAccountId])

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setFormError('ルール名を入力してください')
      return
    }

    let parsedActions: AutomationAction[]
    let parsedConditions: Record<string, unknown>
    try {
      parsedActions = JSON.parse(form.actionsJson)
    } catch {
      setFormError('アクションのJSON形式が正しくありません')
      return
    }
    try {
      parsedConditions = JSON.parse(form.conditionsJson)
    } catch {
      setFormError('条件のJSON形式が正しくありません')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const res = await api.automations.create({
        name: form.name,
        description: form.description || null,
        eventType: form.eventType,
        actions: parsedActions,
        conditions: parsedConditions,
        priority: form.priority,
      })
      if (res.success) {
        setShowCreate(false)
        setForm({ ...initialForm })
        loadAutomations()
      } else {
        setFormError(res.error)
      }
    } catch {
      setFormError('作成に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await api.automations.update(id, { isActive: !current })
      loadAutomations()
    } catch {
      setError('ステータスの変更に失敗しました')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このオートメーションを削除してもよいですか？')) return
    try {
      await api.automations.delete(id)
      loadAutomations()
    } catch {
      setError('削除に失敗しました')
    }
  }

  return (
    <div>
      <Header
        title="オートメーション"
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#06C755' }}
          >
            + 新規ルール
          </button>
        }
      />

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">新規オートメーションを作成</h2>

          {/* リッチメニュー切替プリセット */}
          <div className="mb-5 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-3">🎯 リッチメニュー切替プリセット</p>
            <div className="space-y-2">
              {RICH_MENU_ACTION_PRESETS.map((preset, idx) => (
                <div key={idx} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedPresetIdx === idx ? 'border-blue-500 bg-white' : 'border-blue-200 bg-white/60 hover:bg-white'}`}
                  onClick={() => {
                    setSelectedPresetIdx(idx)
                    setForm({
                      ...form,
                      name: form.name || preset.label,
                      description: form.description || preset.description,
                      eventType: preset.eventType,
                      actionsJson: JSON.stringify(preset.actions, null, 2),
                      conditionsJson: JSON.stringify(preset.conditions, null, 2),
                    })
                  }}
                >
                  <p className="text-xs font-medium text-gray-800">{preset.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{preset.description}</p>
                </div>
              ))}
            </div>

            {/* リッチメニューが選択されている場合、セレクトを表示 */}
            {selectedPresetIdx !== null && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
                <label className="block text-xs font-medium text-blue-700 mb-2">
                  適用するリッチメニューを選択
                </label>
                {richMenus.length === 0 ? (
                  <p className="text-xs text-gray-400">リッチメニューがありません。先にリッチメニュー管理ページで作成してください。</p>
                ) : (
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onChange={(e) => {
                      const richMenuId = e.target.value
                      const actions = [{ type: 'switch_rich_menu', params: { richMenuId } }]
                      setForm({ ...form, actionsJson: JSON.stringify(actions, null, 2) })
                    }}
                  >
                    <option value="">-- リッチメニューを選択 --</option>
                    {richMenus.map((m) => (
                      <option key={m.richMenuId} value={m.richMenuId}>
                        {m.config?.name ?? m.name}
                        {m.config?.target_segment ? ` (${SEGMENT_LABELS[m.config.target_segment] ?? m.config.target_segment})` : ''}
                        {' '}— {m.richMenuId.slice(0, 20)}...
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ルール名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="例: 友だち追加時にウェルカムタグ付与"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">説明</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                rows={2}
                placeholder="ルールの説明 (省略可)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">イベントタイプ</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                value={form.eventType}
                onChange={(e) => setForm({ ...form, eventType: e.target.value as AutomationEventType })}
              >
                {eventTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                アクション (JSON)
                <span className="ml-2 font-normal text-gray-400">— switch_rich_menu の場合は上のセレクトで選択できます</span>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
                rows={6}
                placeholder='[{"type": "switch_rich_menu", "params": {"richMenuId": "..."}}]'
                value={form.actionsJson}
                onChange={(e) => setForm({ ...form, actionsJson: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">条件 (JSON)</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
                rows={3}
                placeholder='{"tagId": "...", "operator": "equals"}'
                value={form.conditionsJson}
                onChange={(e) => setForm({ ...form, conditionsJson: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">優先度</label>
              <input
                type="number"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value, 10) || 0 })}
              />
            </div>

            {formError && <p className="text-xs text-red-600">{formError}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#06C755' }}
              >
                {saving ? '作成中...' : '作成'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setFormError(''); setSelectedPresetIdx(null) }}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="flex gap-4">
                <div className="h-3 bg-gray-100 rounded w-24" />
                <div className="h-3 bg-gray-100 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : automations.length === 0 && !showCreate ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">オートメーションがありません。「新規ルール」から作成してください。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {automations.map((automation) => (
            <div
              key={automation.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              {/* Header row */}
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900 leading-tight">{automation.name}</h3>
                <button
                  onClick={() => handleToggleActive(automation.id, automation.isActive)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    automation.isActive ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                  title={automation.isActive ? '有効 - クリックで無効化' : '無効 - クリックで有効化'}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      automation.isActive ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Description */}
              {automation.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{automation.description}</p>
              )}

              {/* Event type badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${eventTypeBadgeColor[automation.eventType]}`}>
                  {eventTypeLabelMap[automation.eventType]}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  automation.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {automation.isActive ? '有効' : '無効'}
                </span>
              </div>

              {/* Meta info */}
              <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                <span>アクション: {automation.actions.length}件</span>
                <span>優先度: {automation.priority}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => handleDelete(automation.id)}
                  className="px-3 py-1 min-h-[44px] text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <CcPromptButton prompts={ccPrompts} />
    </div>
  )
}
