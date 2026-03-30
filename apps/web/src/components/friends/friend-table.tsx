'use client'

import { useState, useRef, useEffect } from 'react'
import type { Tag } from '@line-crm/shared'
import type { FriendWithTags } from '@/lib/api'
import { api } from '@/lib/api'
import TagBadge from './tag-badge'

interface FriendTableProps {
  friends: FriendWithTags[]
  allTags: Tag[]
  onRefresh: () => void
}

export default function FriendTable({ friends, allTags, onRefresh }: FriendTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // インライン タグ追加（行ホバー時のクイックボタン）
  const [quickTagFriendId, setQuickTagFriendId] = useState<string | null>(null)
  const [quickTagValue, setQuickTagValue] = useState('')
  const quickTagRef = useRef<HTMLDivElement>(null)

  // 一括タグ付与
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkTagId, setBulkTagId] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkSuccess, setBulkSuccess] = useState('')

  const allSelected = friends.length > 0 && selectedIds.size === friends.length
  const someSelected = selectedIds.size > 0 && !allSelected

  // クイックタグドロップダウンを外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (quickTagRef.current && !quickTagRef.current.contains(e.target as Node)) {
        setQuickTagFriendId(null)
        setQuickTagValue('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
    setQuickTagFriendId(null)
    setQuickTagValue('')
    setError('')
  }

  const handleAddTag = async (friendId: string, tagId: string) => {
    if (!tagId) return
    setLoading(true)
    setError('')
    try {
      await api.friends.addTag(friendId, tagId)
      setQuickTagFriendId(null)
      setQuickTagValue('')
      onRefresh()
    } catch {
      setError('タグの追加に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveTag = async (friendId: string, tagId: string) => {
    setLoading(true)
    setError('')
    try {
      await api.friends.removeTag(friendId, tagId)
      onRefresh()
    } catch {
      setError('タグの削除に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(friends.map(f => f.id)))
    }
  }

  const handleBulkTag = async () => {
    if (!bulkTagId || selectedIds.size === 0) return
    setBulkLoading(true)
    setBulkSuccess('')
    setError('')
    try {
      await Promise.allSettled(
        [...selectedIds].map(id => api.friends.addTag(id, bulkTagId))
      )
      setBulkSuccess(`${selectedIds.size} 件にタグを付与しました`)
      setSelectedIds(new Set())
      setBulkTagId('')
      onRefresh()
    } catch {
      setError('一括タグ付与に失敗しました')
    } finally {
      setBulkLoading(false)
    }
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  if (friends.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <p className="text-gray-500">友だちが見つかりません</p>
      </div>
    )
  }

  return (
    <div>
      {/* ── 一括操作バー ──────────────────────────────────────────────── */}
      {someSelected || allSelected ? (
        <div className="mb-3 flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-indigo-700">{selectedIds.size} 件を選択中</span>
          <div className="flex items-center gap-2 flex-1">
            <select
              className="text-sm border border-indigo-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={bulkTagId}
              onChange={e => setBulkTagId(e.target.value)}
            >
              <option value="">タグを選択して一括付与...</option>
              {allTags.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={handleBulkTag}
              disabled={!bulkTagId || bulkLoading}
              className="px-4 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {bulkLoading ? '付与中...' : '一括タグ付与'}
            </button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-indigo-500 hover:text-indigo-700"
          >選択解除</button>
        </div>
      ) : bulkSuccess ? (
        <div className="mb-3 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
          <span>✅ {bulkSuccess}</span>
          <button onClick={() => setBulkSuccess('')} className="ml-auto text-xs text-green-500">閉じる</button>
        </div>
      ) : null}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {error && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-100 text-red-700 text-sm">
            {error}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected }}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-indigo-600 cursor-pointer"
                    title="全選択/解除"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  アイコン / 表示名
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  タグ
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  登録日
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {friends.map((friend) => {
                const isExpanded = expandedId === friend.id
                const isSelected = selectedIds.has(friend.id)
                const availableTags = allTags.filter(
                  (t) => !friend.tags.some((ft) => ft.id === t.id)
                )

                return (
                  <>
                    <tr
                      key={friend.id}
                      className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(friend.id)}
                          className="rounded border-gray-300 text-indigo-600 cursor-pointer"
                        />
                      </td>

                      {/* Avatar + Name */}
                      <td className="px-4 py-3 cursor-pointer" onClick={() => toggleExpand(friend.id)}>
                        <div className="flex items-center gap-3">
                          {friend.pictureUrl ? (
                            <img
                              src={friend.pictureUrl}
                              alt={friend.displayName}
                              className="w-9 h-9 rounded-full object-cover bg-gray-100"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-medium">
                              {friend.displayName?.charAt(0) ?? '?'}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{friend.displayName}</p>
                            {friend.statusMessage && (
                              <p className="text-xs text-gray-400 truncate max-w-[160px]">{friend.statusMessage}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Following status */}
                      <td className="px-4 py-3 cursor-pointer" onClick={() => toggleExpand(friend.id)}>
                        {friend.isFollowing ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            フォロー中
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            ブロック/退会
                          </span>
                        )}
                      </td>

                      {/* Tags + Quick-add */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1" ref={quickTagFriendId === friend.id ? quickTagRef : undefined}>
                          {(friend as unknown as { refCode?: string }).refCode && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {(friend as unknown as { refCode: string }).refCode}
                            </span>
                          )}
                          {friend.tags.map((tag) => (
                            <TagBadge key={tag.id} tag={tag} />
                          ))}

                          {/* クイックタグ追加ボタン */}
                          {availableTags.length > 0 && (
                            <div className="relative" onClick={e => e.stopPropagation()}>
                              {quickTagFriendId === friend.id ? (
                                <div className="flex items-center gap-1">
                                  <select
                                    autoFocus
                                    className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                    value={quickTagValue}
                                    onChange={e => setQuickTagValue(e.target.value)}
                                  >
                                    <option value="">選択...</option>
                                    {availableTags.map(t => (
                                      <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => handleAddTag(friend.id, quickTagValue)}
                                    disabled={!quickTagValue || loading}
                                    className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md transition-colors"
                                  >追加</button>
                                  <button
                                    onClick={() => { setQuickTagFriendId(null); setQuickTagValue('') }}
                                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md"
                                  >✕</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setQuickTagFriendId(friend.id); setQuickTagValue('') }}
                                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors font-medium"
                                  title="タグを追加"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                  </svg>
                                  タグ
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Registered date */}
                      <td className="px-4 py-3 text-sm text-gray-500 cursor-pointer" onClick={() => toggleExpand(friend.id)}>
                        {formatDate(friend.createdAt)}
                      </td>

                      {/* Expand indicator */}
                      <td className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleExpand(friend.id)}>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform inline-block ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr key={`${friend.id}-detail`} className="bg-gray-50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">LINE ユーザーID</p>
                              <p className="text-xs text-gray-600 font-mono">{friend.lineUserId}</p>
                            </div>

                            {/* Tag management — detailed view with remove */}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-2">タグ管理</p>
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {friend.tags.length === 0 ? (
                                  <span className="text-xs text-gray-400">タグなし</span>
                                ) : friend.tags.map((tag) => (
                                  <TagBadge
                                    key={tag.id}
                                    tag={tag}
                                    onRemove={() => handleRemoveTag(friend.id, tag.id)}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
