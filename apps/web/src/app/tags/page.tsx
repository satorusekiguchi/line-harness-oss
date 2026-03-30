'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Tag } from '@line-crm/shared'
import { api } from '@/lib/api'
import Header from '@/components/layout/header'
import TagBadge from '@/components/friends/tag-badge'

const PRESET_COLORS = [
  '#06C755', '#4CAF50', '#2196F3', '#3F51B5', '#9C27B0',
  '#E91E63', '#F44336', '#FF9800', '#FF5722', '#795548',
  '#607D8B', '#00BCD4', '#009688', '#CDDC39', '#FFC107',
  '#8BC34A', '#673AB7', '#03A9F4', '#F06292', '#A5D6A7',
]

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#06C755')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const loadTags = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.tags.list()
      if (res.success) setTags(res.data ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadTags() }, [loadTags])

  const handleCreate = async () => {
    if (!newName.trim()) { setError('タグ名を入力してください'); return }
    setSaving(true)
    setError('')
    try {
      const res = await api.tags.create({ name: newName.trim(), color: newColor })
      if (!res.success) throw new Error(res.error ?? '作成失敗')
      setNewName('')
      setNewColor('#06C755')
      await loadTags()
    } catch (e) {
      setError(e instanceof Error ? e.message : '作成に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleteLoading(true)
    try {
      await api.tags.delete(id)
      setDeleteConfirm(null)
      await loadTags()
    } catch {
      setError('削除に失敗しました')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div>
      <Header
        title="タグ管理"
        description="友だちに付与するタグを作成・管理します"
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* ── 新規タグ作成 ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">新しいタグを作成</h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-xs font-medium text-gray-600 mb-1">タグ名 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleCreate() }}
              placeholder="例：EC購入済み"
              maxLength={30}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">カラー</label>
            <div className="flex items-center gap-2">
              {/* カスタムカラー入力 */}
              <div className="relative">
                <input
                  type="color"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  className="w-9 h-9 rounded-lg border border-gray-300 cursor-pointer p-0.5"
                  title="カスタムカラーを選択"
                />
              </div>
              {/* プリセットカラー */}
              <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${newColor === color ? 'border-gray-600 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {newName && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>プレビュー:</span>
                <TagBadge tag={{ id: 'preview', name: newName, color: newColor, createdAt: '' }} />
              </div>
            )}
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="px-4 py-2 min-h-[40px] text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#06C755' }}
            >
              {saving ? '作成中...' : '+ 作成'}
            </button>
          </div>
        </div>
      </div>

      {/* ── タグ一覧 ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-5 py-4 border-b border-gray-100 flex items-center gap-4 animate-pulse">
              <div className="w-16 h-6 rounded-full bg-gray-200" />
              <div className="h-3 bg-gray-100 rounded w-32" />
              <div className="ml-auto h-7 bg-gray-100 rounded w-16" />
            </div>
          ))}
        </div>
      ) : tags.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">🏷</div>
          <p className="text-gray-500">タグがありません</p>
          <p className="text-sm text-gray-400 mt-1">上のフォームからタグを作成してください</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">タグ一覧</span>
            <span className="text-xs text-gray-400">{tags.length} 件</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {tags.map(tag => (
              <li key={tag.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                <TagBadge tag={tag} />
                <span className="text-xs text-gray-400 font-mono">{tag.color}</span>
                <span className="ml-auto text-xs text-gray-400">
                  {new Date(tag.createdAt).toLocaleDateString('ja-JP')}
                </span>
                <button
                  onClick={() => setDeleteConfirm(tag.id)}
                  className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 rounded-lg font-medium transition-colors"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 削除確認ダイアログ ─────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-1">タグを削除しますか？</h3>
            <p className="text-sm text-gray-500 mb-1">
              タグ: <TagBadge tag={tags.find(t => t.id === deleteConfirm)!} />
            </p>
            <p className="text-sm text-gray-500 mb-6">
              友だちからも外れます。この操作は元に戻せません。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
              >キャンセル</button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg"
              >
                {deleteLoading ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
