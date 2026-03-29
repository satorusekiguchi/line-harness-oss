'use client'

import { useState, useEffect, useRef } from 'react'
import { useAccount } from '@/contexts/account-context'
import { api } from '@/lib/api'

// ── 型定義 ────────────────────────────────────────────────────────────────────

interface RichMenuArea {
  bounds: { x: number; y: number; width: number; height: number }
  action: { type: string; uri?: string; text?: string; label?: string }
}

interface RichMenuObject {
  richMenuId: string
  name: string
  size: { width: number; height: number }
  chatBarText: string
  selected: boolean
  areas: RichMenuArea[]
  config?: {
    id: string
    name: string
    description?: string | null
    target_segment?: string | null
    is_default: number
  } | null
}

// ── LINE API に送るリッチメニュー定義のプリセット ─────────────────────────────

const PRESETS: Record<string, { label: string; menu: Omit<RichMenuObject, 'richMenuId' | 'config'> }> = {
  teaser: {
    label: 'ティザー期（発売前）',
    menu: {
      name: 'nud_teaser',
      size: { width: 2500, height: 843 },
      chatBarText: 'メニュー',
      selected: true,
      areas: [
        { bounds: { x: 0, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: 'https://example.com/about', label: 'nú:dについて' } },
        { bounds: { x: 833, y: 0, width: 834, height: 843 }, action: { type: 'uri', uri: 'https://example.com/ingredients', label: '成分のひみつ' } },
        { bounds: { x: 1667, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: 'https://example.com/skin-scan', label: 'AI肌診断' } },
      ],
    },
  },
  non_purchaser: {
    label: '未購入者向け',
    menu: {
      name: 'nud_non_purchaser',
      size: { width: 2500, height: 843 },
      chatBarText: 'メニュー',
      selected: true,
      areas: [
        { bounds: { x: 0, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: 'https://example.com/product', label: '商品を詳しく見る' } },
        { bounds: { x: 833, y: 0, width: 834, height: 843 }, action: { type: 'uri', uri: 'https://example.com/campaign', label: '初回限定特典' } },
        { bounds: { x: 1667, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: 'https://example.com/skin-scan', label: 'AI肌診断' } },
      ],
    },
  },
  purchaser: {
    label: '購入者向け',
    menu: {
      name: 'nud_purchaser',
      size: { width: 2500, height: 843 },
      chatBarText: 'メニュー',
      selected: true,
      areas: [
        { bounds: { x: 0, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: 'https://example.com/mypage', label: 'マイページ' } },
        { bounds: { x: 833, y: 0, width: 834, height: 843 }, action: { type: 'uri', uri: 'https://example.com/how-to-use', label: '使い方ガイド' } },
        { bounds: { x: 1667, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: 'https://example.com/buy', label: 'もう1本注文する' } },
      ],
    },
  },
  subscriber: {
    label: '定期購入者向け',
    menu: {
      name: 'nud_subscriber',
      size: { width: 2500, height: 843 },
      chatBarText: 'メニュー',
      selected: true,
      areas: [
        { bounds: { x: 0, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: 'https://example.com/mypage', label: 'マイページ' } },
        { bounds: { x: 833, y: 0, width: 834, height: 843 }, action: { type: 'uri', uri: 'https://example.com/delivery', label: 'お届け日の変更' } },
        { bounds: { x: 1667, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: 'https://example.com/referral', label: '友だち紹介' } },
      ],
    },
  },
}

const SEGMENT_LABELS: Record<string, string> = {
  teaser: 'ティザー期',
  non_purchaser: '未購入者',
  purchaser: '購入者',
  subscriber: '定期購入者',
}

// ── コンポーネント ─────────────────────────────────────────────────────────────

export default function RichMenusPage() {
  const { selectedAccountId } = useAccount()
  const accountId = selectedAccountId ?? undefined

  const [menus, setMenus] = useState<RichMenuObject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>('teaser')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [targetRichMenuId, setTargetRichMenuId] = useState<string | null>(null)
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const fetchMenus = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.richMenus.list({ accountId })
      if (res.success) {
        setMenus(res.data as unknown as RichMenuObject[])
      } else {
        setError('リッチメニューの取得に失敗しました')
      }
    } catch {
      setError('リッチメニューの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMenus() }, [accountId])

  const handleCreate = async () => {
    setCreating(true)
    setActionStatus(null)
    try {
      const preset = PRESETS[selectedPreset]
      const res = await api.richMenus.create(preset.menu as unknown as Record<string, unknown>, { accountId })
      if (res.success && res.data?.richMenuId) {
        // セグメント情報をDBに保存
        await api.richMenus.updateConfig(
          res.data.richMenuId,
          { name: preset.menu.name, targetSegment: selectedPreset },
          { accountId },
        )
        setActionStatus('リッチメニューを作成しました。画像をアップロードしてください。')
        setShowCreateForm(false)
        await fetchMenus()
      }
    } catch {
      setActionStatus('作成に失敗しました')
    } finally {
      setCreating(false)
    }
  }

  const handleSetDefault = async (richMenuId: string) => {
    setActionStatus(null)
    try {
      await api.richMenus.setDefault(richMenuId, { accountId })
      setActionStatus('デフォルトリッチメニューを設定しました')
      await fetchMenus()
    } catch {
      setActionStatus('デフォルト設定に失敗しました')
    }
  }

  const handleDelete = async (richMenuId: string) => {
    if (!confirm('このリッチメニューを削除してもよいですか？')) return
    setActionStatus(null)
    try {
      await api.richMenus.delete(richMenuId, { accountId })
      setActionStatus('リッチメニューを削除しました')
      await fetchMenus()
    } catch {
      setActionStatus('削除に失敗しました')
    }
  }

  const handleImageSelect = (richMenuId: string) => {
    setTargetRichMenuId(richMenuId)
    imageInputRef.current?.click()
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !targetRichMenuId) return
    setImageFile(file)
    setActionStatus('画像をアップロード中...')

    try {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string
        const contentType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
        await api.richMenus.uploadImage(targetRichMenuId, base64, contentType, { accountId })
        setActionStatus('画像をアップロードしました')
        setImageFile(null)
        setTargetRichMenuId(null)
        if (imageInputRef.current) imageInputRef.current.value = ''
      }
      reader.readAsDataURL(file)
    } catch {
      setActionStatus('画像のアップロードに失敗しました')
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">リッチメニュー管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            顧客ステータスに応じたリッチメニューを設定します
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
          style={{ backgroundColor: '#06C755' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新規作成
        </button>
      </div>

      {/* アクションステータス */}
      {actionStatus && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          {actionStatus}
        </div>
      )}

      {/* プリセットから作成フォーム */}
      {showCreateForm && (
        <div className="mb-6 p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">プリセットから作成</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => setSelectedPreset(key)}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  selectedPreset === key
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-sm text-gray-900">{preset.label}</p>
                <p className="text-xs text-gray-500 mt-1">{preset.menu.areas.length}エリア構成</p>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#06C755' }}
            >
              {creating ? '作成中...' : 'リッチメニューを作成'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            >
              キャンセル
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            ※ 作成後、LINE Developersで発行したリッチメニューIDに画像をアップロードしてください
          </p>
        </div>
      )}

      {/* セグメント別の説明 */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        {Object.entries(SEGMENT_LABELS).map(([key, label]) => (
          <div key={key} className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{label}</p>
            <p className="text-xs text-blue-600 mt-1">
              {key === 'teaser' && '友だち追加直後〜発売前。ブランド理解・肌診断へ誘導'}
              {key === 'non_purchaser' && '未購入者。商品詳細・初回特典・AI肌診断へ誘導'}
              {key === 'purchaser' && '購入済み。マイページ・使い方ガイド・リピートへ誘導'}
              {key === 'subscriber' && '定期購入者。配送管理・友だち紹介へ誘導'}
            </p>
          </div>
        ))}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      {/* リッチメニュー一覧 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : menus.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <p className="text-gray-500 text-sm">リッチメニューがありません</p>
          <p className="text-gray-400 text-xs mt-1">「新規作成」から追加してください</p>
        </div>
      ) : (
        <div className="space-y-4">
          {menus.map((menu) => (
            <div key={menu.richMenuId} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-gray-900 truncate">{menu.config?.name ?? menu.name}</h3>
                    {menu.config?.is_default === 1 && (
                      <span className="px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                        デフォルト
                      </span>
                    )}
                    {menu.config?.target_segment && (
                      <span className="px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                        {SEGMENT_LABELS[menu.config.target_segment] ?? menu.config.target_segment}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 font-mono">{menu.richMenuId}</p>
                  {menu.config?.description && (
                    <p className="text-sm text-gray-600 mt-1">{menu.config.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>{menu.size.width} × {menu.size.height}px</span>
                    <span>{menu.areas.length}エリア</span>
                    <span>チャットバー: {menu.chatBarText}</span>
                  </div>

                  {/* エリア一覧 */}
                  <div className="mt-3 space-y-1">
                    {menu.areas.map((area, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="w-5 h-5 flex items-center justify-center bg-gray-100 rounded text-gray-500 font-mono shrink-0">{idx + 1}</span>
                        <span className="font-medium">{area.action.label ?? area.action.type}</span>
                        {area.action.uri && (
                          <span className="text-gray-400 truncate max-w-xs">{area.action.uri}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => handleImageSelect(menu.richMenuId)}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    画像UP
                  </button>
                  {menu.config?.is_default !== 1 && (
                    <button
                      onClick={() => handleSetDefault(menu.richMenuId)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      デフォルトに
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(menu.richMenuId)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 画像アップロード用の隠しInput */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* 使い方ガイド */}
      <div className="mt-8 p-5 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">リッチメニュー切替の設定方法</h3>
        <ol className="space-y-2 text-sm text-gray-600">
          <li className="flex gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold">1</span>
            各セグメント（ティザー期・未購入者・購入者・定期購入者）のリッチメニューを上記から作成し、画像をアップロード
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold">2</span>
            <span>「デフォルトに設定」でティザー期メニューを全ユーザーのデフォルトに設定</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold">3</span>
            <span>「オートメーション」ページで <code className="bg-gray-100 px-1 rounded">switch_rich_menu</code> アクションを設定し、タグ付与時に自動で切替</span>
          </li>
        </ol>
      </div>
    </div>
  )
}
