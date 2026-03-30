'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Tag, Scenario } from '@line-crm/shared'
import { api, type FormData, type FormField } from '@/lib/api'
import Header from '@/components/layout/header'

const WORKER_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://line-crm-worker.mumumuinc.workers.dev'

const FIELD_TYPES: { value: FormField['type']; label: string }[] = [
  { value: 'text', label: 'テキスト（1行）' },
  { value: 'textarea', label: 'テキスト（複数行）' },
  { value: 'email', label: 'メールアドレス' },
  { value: 'tel', label: '電話番号' },
  { value: 'number', label: '数値' },
  { value: 'select', label: 'プルダウン選択' },
  { value: 'radio', label: 'ラジオボタン' },
  { value: 'checkbox', label: 'チェックボックス' },
]

const EMPTY_FIELD: FormField = {
  name: '',
  label: '',
  type: 'text',
  required: false,
  placeholder: '',
  options: [],
}

function genName(label: string) {
  return label
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '')
    || `field_${Date.now()}`
}

export default function FormsPage() {
  const [forms, setForms] = useState<FormData[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<FormData | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Form editor state
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [fields, setFields] = useState<FormField[]>([])
  const [onSubmitTagId, setOnSubmitTagId] = useState<string>('')
  const [onSubmitScenarioId, setOnSubmitScenarioId] = useState<string>('')
  const [saveToMetadata, setSaveToMetadata] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [fRes, tRes, sRes] = await Promise.all([
        api.forms.list(),
        api.tags.list(),
        api.scenarios.list({}),
      ])
      if (fRes.success) setForms(fRes.data ?? [])
      if (tRes.success) setTags(tRes.data ?? [])
      if (sRes.success) setScenarios((sRes.data as Scenario[]) ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  function openCreate() {
    setEditTarget(null)
    setFormName('')
    setFormDesc('')
    setFields([])
    setOnSubmitTagId('')
    setOnSubmitScenarioId('')
    setSaveToMetadata(true)
    setIsActive(true)
    setError('')
    setShowModal(true)
  }

  function openEdit(f: FormData) {
    setEditTarget(f)
    setFormName(f.name)
    setFormDesc(f.description ?? '')
    setFields(f.fields ?? [])
    setOnSubmitTagId(f.onSubmitTagId ?? '')
    setOnSubmitScenarioId(f.onSubmitScenarioId ?? '')
    setSaveToMetadata(f.saveToMetadata)
    setIsActive(f.isActive)
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!formName.trim()) { setError('フォーム名を入力してください'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: formName.trim(),
        description: formDesc.trim() || null,
        fields,
        onSubmitTagId: onSubmitTagId || null,
        onSubmitScenarioId: onSubmitScenarioId || null,
        saveToMetadata,
        isActive,
      }
      const res = editTarget
        ? await api.forms.update(editTarget.id, payload)
        : await api.forms.create(payload)
      if (!res.success) throw new Error(res.error ?? '保存失敗')
      setShowModal(false)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.forms.delete(id)
      setDeleteConfirm(null)
      await loadData()
    } catch {
      // ignore
    }
  }

  async function handleToggle(f: FormData) {
    await api.forms.update(f.id, { isActive: !f.isActive })
    await loadData()
  }

  function copyUrl(formId: string, type: 'liff' | 'direct') {
    const url = type === 'liff'
      ? `${WORKER_URL}/api/forms/${formId}/submit`
      : `${WORKER_URL}/api/forms/${formId}/submit`
    void navigator.clipboard.writeText(url)
    setCopiedId(formId + type)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ── Field editor helpers ──────────────────────────────────────────────────────

  function addField() {
    setFields(prev => [...prev, { ...EMPTY_FIELD }])
  }

  function updateField(index: number, patch: Partial<FormField>) {
    setFields(prev => prev.map((f, i) => {
      if (i !== index) return f
      const updated = { ...f, ...patch }
      // Auto-generate name from label if name is still default
      if (patch.label && !prev[i].name) {
        updated.name = genName(patch.label)
      }
      return updated
    }))
  }

  function removeField(index: number) {
    setFields(prev => prev.filter((_, i) => i !== index))
  }

  function moveField(index: number, dir: -1 | 1) {
    setFields(prev => {
      const arr = [...prev]
      const to = index + dir
      if (to < 0 || to >= arr.length) return arr
      ;[arr[index], arr[to]] = [arr[to], arr[index]]
      return arr
    })
  }

  return (
    <div>
      <Header
        title="フォーム管理"
        description="LIFFで表示するアンケートや問い合わせフォームを作成・管理します"
        action={
          <button
            onClick={openCreate}
            className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#06C755' }}
          >
            + 新規フォーム
          </button>
        }
      />

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">読み込み中...</div>
      ) : forms.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <p>フォームがありません</p>
          <p className="text-sm mt-1">「+ 新規フォーム」から作成してください</p>
        </div>
      ) : (
        <div className="space-y-4">
          {forms.map(f => (
            <div
              key={f.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 truncate">{f.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {f.isActive ? '受付中' : '停止中'}
                    </span>
                    <span className="text-xs text-gray-400">{f.submitCount} 件の回答</span>
                  </div>
                  {f.description && (
                    <p className="text-sm text-gray-500 mt-1 truncate">{f.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span>フィールド数: {f.fields?.length ?? 0}</span>
                    {f.onSubmitTagId && (
                      <span>🏷 タグ付与: {tags.find(t => t.id === f.onSubmitTagId)?.name ?? f.onSubmitTagId}</span>
                    )}
                    {f.onSubmitScenarioId && (
                      <span>📋 シナリオ: {scenarios.find(s => s.id === f.onSubmitScenarioId)?.name ?? f.onSubmitScenarioId}</span>
                    )}
                  </div>
                  {/* URL表示 */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400 font-medium">Submit URL:</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700 break-all">
                      {WORKER_URL}/api/forms/{f.id}/submit
                    </code>
                    <button
                      onClick={() => copyUrl(f.id, 'direct')}
                      className="text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded transition-colors"
                    >
                      {copiedId === f.id + 'direct' ? '✓ コピー済み' : 'URLコピー'}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(f)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${f.isActive ? 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700' : 'bg-green-50 hover:bg-green-100 text-green-700'}`}
                  >
                    {f.isActive ? '停止' : '有効化'}
                  </button>
                  <button
                    onClick={() => openEdit(f)}
                    className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(f.id)}
                    className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How-to section */}
      <div className="mt-8 bg-blue-50 border border-blue-100 rounded-lg p-5">
        <h3 className="font-semibold text-blue-800 mb-3 text-sm">📖 フォームの使い方</h3>
        <ol className="space-y-1.5 text-sm text-blue-700 list-decimal list-inside">
          <li>「+ 新規フォーム」からフォームを作成する</li>
          <li>フィールド（氏名・メール・選択肢など）を追加する</li>
          <li>回答時に自動付与するタグやシナリオを設定する（任意）</li>
          <li>作成後に表示される <strong>Submit URL</strong> をLIFFから呼び出す</li>
        </ol>
        <div className="mt-3 bg-white rounded-lg p-3 text-xs font-mono text-gray-700 border border-blue-100">
          <div className="text-gray-400 mb-1">// LIFFからフォームを送信するサンプルコード</div>
          <div>await fetch(<span className="text-green-600">&quot;{WORKER_URL}/api/forms/&#123;formId&#125;/submit&quot;</span>, {'{'}</div>
          <div className="pl-4">method: <span className="text-green-600">&quot;POST&quot;</span>,</div>
          <div className="pl-4">headers: {'{'} <span className="text-green-600">&quot;Content-Type&quot;: &quot;application/json&quot;</span> {'}'},</div>
          <div className="pl-4">body: JSON.stringify({'{'} lineUserId: uid, data: {'{'} name: &quot;山田太郎&quot; {'}'} {'}'})</div>
          <div>{'}'});</div>
        </div>
      </div>

      {/* ── Delete confirm dialog ─────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">フォームを削除しますか？</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              この操作は元に戻せません。回答データも削除されます。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
              >キャンセル</button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >削除する</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit modal ───────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editTarget ? 'フォームを編集' : '新規フォーム作成'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
              >×</button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              {/* Basic info */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    フォーム名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="例：お問い合わせフォーム"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">説明（任意）</label>
                  <input
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="フォームの用途や説明"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Fields editor */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">フィールド</label>
                  <button
                    onClick={addField}
                    className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                  >+ フィールド追加</button>
                </div>

                {fields.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-400">
                    「フィールド追加」ボタンで質問項目を追加してください
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fields.map((field, idx) => (
                      <FieldEditor
                        key={idx}
                        field={field}
                        index={idx}
                        total={fields.length}
                        onChange={patch => updateField(idx, patch)}
                        onRemove={() => removeField(idx)}
                        onMove={dir => moveField(idx, dir)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Post-submit actions */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">回答後のアクション（任意）</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">タグを付与する</label>
                    <select
                      value={onSubmitTagId}
                      onChange={e => setOnSubmitTagId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">（付与しない）</option>
                      {tags.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">シナリオに登録する</label>
                    <select
                      value={onSubmitScenarioId}
                      onChange={e => setOnSubmitScenarioId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">（登録しない）</option>
                      {scenarios.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveToMetadata}
                    onChange={e => setSaveToMetadata(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                  回答データを友だちのメタデータに保存する
                </label>
                {editTarget && (
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={e => setIsActive(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600"
                    />
                    フォームを受付中にする
                  </label>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
              >キャンセル</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium rounded-lg transition-colors"
              >
                {saving ? '保存中...' : (editTarget ? '更新する' : '作成する')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── FieldEditor sub-component ─────────────────────────────────────────────────

function FieldEditor({
  field, index, total, onChange, onRemove, onMove,
}: {
  field: FormField
  index: number
  total: number
  onChange: (patch: Partial<FormField>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const needsOptions = field.type === 'select' || field.type === 'radio' || field.type === 'checkbox'

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-xl p-4 bg-white dark:bg-gray-700/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">フィールド {index + 1}</span>
        <div className="flex items-center gap-1">
          {index > 0 && (
            <button onClick={() => onMove(-1)} className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">↑</button>
          )}
          {index < total - 1 && (
            <button onClick={() => onMove(1)} className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">↓</button>
          )}
          <button onClick={onRemove} className="text-xs px-2 py-1 text-red-400 hover:text-red-600">✕</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">ラベル（表示名）<span className="text-red-500">*</span></label>
          <input
            value={field.label}
            onChange={e => onChange({ label: e.target.value, name: genName(e.target.value) })}
            placeholder="例：お名前"
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">フィールドタイプ</label>
          <select
            value={field.type}
            onChange={e => onChange({ type: e.target.value as FormField['type'] })}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {FIELD_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">フィールドID（自動）</label>
          <input
            value={field.name}
            onChange={e => onChange({ name: e.target.value })}
            placeholder="例：user_name"
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-mono focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">プレースホルダー（任意）</label>
          <input
            value={field.placeholder ?? ''}
            onChange={e => onChange({ placeholder: e.target.value })}
            placeholder="例：山田太郎"
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {needsOptions && (
        <div className="mt-3">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            選択肢（1行に1つ入力）
          </label>
          <textarea
            value={(field.options ?? []).join('\n')}
            onChange={e => onChange({ options: e.target.value.split('\n').filter(Boolean) })}
            placeholder={'選択肢A\n選択肢B\n選択肢C'}
            rows={3}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 font-mono"
          />
        </div>
      )}

      <div className="mt-3">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={e => onChange({ required: e.target.checked })}
            className="rounded border-gray-300 text-indigo-600"
          />
          必須項目
        </label>
      </div>
    </div>
  )
}
