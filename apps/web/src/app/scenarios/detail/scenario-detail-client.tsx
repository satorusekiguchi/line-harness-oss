'use client'

import React, { useState, useEffect, useCallback } from 'react'

import Link from 'next/link'
import type { Scenario, ScenarioStep, ScenarioTriggerType, MessageType } from '@line-crm/shared'
import { api } from '@/lib/api'
import Header from '@/components/layout/header'

type ScenarioWithSteps = Scenario & { steps: ScenarioStep[] }

const triggerOptions: { value: ScenarioTriggerType; label: string }[] = [
  { value: 'friend_add', label: '友だち追加時' },
  { value: 'tag_added', label: 'タグ付与時' },
  { value: 'manual', label: '手動' },
]

const messageTypeOptions: { value: MessageType; label: string }[] = [
  { value: 'text', label: 'テキスト' },
  { value: 'image', label: '画像' },
  { value: 'flex', label: 'Flex' },
]

function formatDelay(minutes: number): string {
  if (minutes === 0) return '即時'
  if (minutes < 60) return `${minutes}分後`
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m === 0 ? `${h}時間後` : `${h}時間${m}分後`
  }
  const d = Math.floor(minutes / 1440)
  const remaining = minutes % 1440
  if (remaining === 0) return `${d}日後`
  const h = Math.floor(remaining / 60)
  return h > 0 ? `${d}日${h}時間後` : `${d}日${remaining}分後`
}

interface StepFormState {
  stepOrder: number
  delayMinutes: number
  messageType: MessageType
  messageContent: string
}

const emptyStepForm: StepFormState = {
  stepOrder: 1,
  delayMinutes: 0,
  messageType: 'text',
  messageContent: '',
}

// ──────────────────────────────────────────────────────────
// Flex Message Visual Renderer
// ──────────────────────────────────────────────────────────

type FlexNode = Record<string, unknown>

const FLEX_TEXT_SIZE: Record<string, string> = {
  xxs: '10px', xs: '11px', sm: '12px', md: '14px',
  lg: '16px', xl: '18px', xxl: '20px', '3xl': '24px', '4xl': '30px', '5xl': '36px',
}
const FLEX_TEXT_WEIGHT: Record<string, string> = { regular: '400', bold: '700' }
const FLEX_TEXT_ALIGN: Record<string, string> = { start: 'left', center: 'center', end: 'right' }

function renderFlexComponent(node: FlexNode, key: number): React.ReactNode {
  const type = node.type as string

  if (type === 'box') {
    const layout = (node.layout as string) || 'vertical'
    const isHorizontal = layout === 'horizontal' || layout === 'baseline'
    const contents = (node.contents as FlexNode[]) || []
    const spacing = node.spacing as string
    const gap = spacing === 'none' ? '0px' : spacing === 'xs' ? '4px' : spacing === 'sm' ? '6px' : spacing === 'md' ? '8px' : spacing === 'lg' ? '12px' : spacing === 'xl' ? '16px' : '8px'
    const bg = node.backgroundColor as string | undefined
    const padMap: Record<string, string> = { none: '0', xs: '2px', sm: '4px', md: '8px', lg: '12px', xl: '16px' }
    const paddingStr = node.paddingAll ? padMap[node.paddingAll as string] ?? '8px' : undefined
    return (
      <div
        key={key}
        style={{
          display: isHorizontal ? 'flex' : 'block',
          flexDirection: isHorizontal ? 'row' : undefined,
          gap: isHorizontal ? gap : undefined,
          alignItems: isHorizontal ? (layout === 'baseline' ? 'baseline' : 'center') : undefined,
          backgroundColor: bg,
          padding: paddingStr,
          borderRadius: node.cornerRadius ? '8px' : undefined,
        }}
      >
        {contents.map((c, i) => (
          <div
            key={i}
            style={{ flex: isHorizontal ? (c.flex as number ?? 1) : undefined, marginBottom: !isHorizontal && i < contents.length - 1 ? gap : undefined }}
          >
            {renderFlexComponent(c, i)}
          </div>
        ))}
      </div>
    )
  }

  if (type === 'text') {
    const sizeKey = (node.size as string) || 'md'
    const color = (node.color as string) || '#333333'
    const weight = FLEX_TEXT_WEIGHT[(node.weight as string) || 'regular'] || '400'
    const align = FLEX_TEXT_ALIGN[(node.align as string) || 'start'] || 'left'
    const wrap = node.wrap !== false
    const text = (node.text as string) || ''
    return (
      <p
        key={key}
        style={{
          fontSize: FLEX_TEXT_SIZE[sizeKey] || '14px',
          color,
          fontWeight: weight,
          textAlign: align as React.CSSProperties['textAlign'],
          whiteSpace: wrap ? 'pre-wrap' : 'nowrap',
          overflow: wrap ? undefined : 'hidden',
          textOverflow: wrap ? undefined : 'ellipsis',
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {text}
      </p>
    )
  }

  if (type === 'image') {
    const url = (node.url as string) || ''
    const size = (node.size as string) || 'md'
    const widthMap: Record<string, string> = { xxs: '40px', xs: '60px', sm: '80px', md: '100px', lg: '140px', xl: '180px', xxl: '200px', full: '100%' }
    const w = node.aspectRatio ? '100%' : (widthMap[size] || '100px')
    return (
      <img
        key={key}
        src={url}
        alt=""
        style={{ width: w, height: 'auto', display: 'block', borderRadius: '4px', maxWidth: '100%' }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }

  if (type === 'button') {
    const action = (node.action as FlexNode) || {}
    const label = (action.label as string) || ''
    const style = (node.style as string) || 'link'
    const color = (node.color as string) || '#06C755'
    const isLink = style === 'link'
    const isPrimary = style === 'primary'
    return (
      <div
        key={key}
        style={{
          padding: isLink ? '4px 0' : '10px 16px',
          textAlign: 'center',
          backgroundColor: isPrimary ? color : isLink ? 'transparent' : '#f0f0f0',
          borderRadius: isLink ? undefined : '6px',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '14px', color: isPrimary ? '#fff' : color, fontWeight: '500' }}>
          {label}
        </span>
      </div>
    )
  }

  if (type === 'separator') {
    return <hr key={key} style={{ border: 'none', borderTop: '1px solid #e8e8e8', margin: '4px 0' }} />
  }

  if (type === 'spacer') {
    const sizeMap: Record<string, string> = { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', xxl: '32px' }
    return <div key={key} style={{ height: sizeMap[(node.size as string) || 'md'] || '12px' }} />
  }

  if (type === 'video') {
    return (
      <div key={key} style={{ padding: '8px', background: '#f0f0f0', borderRadius: '4px', textAlign: 'center', fontSize: '12px', color: '#888' }}>
        🎬 動画
      </div>
    )
  }

  return null
}

function renderFlexBubble(bubble: FlexNode, idx: number) {
  const header = bubble.header as FlexNode | undefined
  const hero = bubble.hero as FlexNode | undefined
  const body = bubble.body as FlexNode | undefined
  const footer = bubble.footer as FlexNode | undefined
  const styles = (bubble.styles as FlexNode) || {}
  const bodyStyle = (styles.body as FlexNode) || {}
  const footerStyle = (styles.footer as FlexNode) || {}

  return (
    <div
      key={idx}
      style={{
        background: '#fff',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        minWidth: '200px',
        maxWidth: '280px',
        border: '1px solid #e8e8e8',
        flexShrink: 0,
      }}
    >
      {header && (
        <div style={{ padding: '12px 16px 8px', background: (styles.header as FlexNode)?.backgroundColor as string || '#fff' }}>
          {renderFlexComponent(header, 0)}
        </div>
      )}
      {hero && (
        <div style={{ overflow: 'hidden' }}>
          {renderFlexComponent(hero, 0)}
        </div>
      )}
      {body && (
        <div style={{ padding: '12px 16px', background: bodyStyle.backgroundColor as string || '#fff' }}>
          {renderFlexComponent(body, 0)}
        </div>
      )}
      {footer && (
        <div style={{
          padding: '8px 16px 12px',
          background: footerStyle.backgroundColor as string || '#f8f8f8',
          borderTop: '1px solid #f0f0f0',
        }}>
          {renderFlexComponent(footer, 0)}
        </div>
      )}
    </div>
  )
}

function FlexPreview({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)

  try {
    const parsed = JSON.parse(content) as FlexNode

    // Normalize: handle both raw bubble/carousel and wrapped flex message
    const contentsNode: FlexNode =
      parsed.type === 'flex' && parsed.contents
        ? (parsed.contents as FlexNode)
        : parsed

    const isBubble = contentsNode.type === 'bubble'
    const isCarousel = contentsNode.type === 'carousel'
    const bubbles: FlexNode[] = isBubble
      ? [contentsNode]
      : isCarousel
        ? ((contentsNode.contents as FlexNode[]) || [])
        : [contentsNode]

    const altText = parsed.altText as string | undefined

    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Flex Message</span>
          {isCarousel && (
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              カルーセル {bubbles.length}枚
            </span>
          )}
          {altText && <span className="text-xs text-gray-400 truncate max-w-[200px]">{altText}</span>}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto text-xs text-green-600 hover:text-green-700 px-2 py-0.5 rounded hover:bg-green-50 transition-colors"
          >
            {expanded ? '▲ 閉じる' : '▼ プレビュー表示'}
          </button>
        </div>

        {expanded && (
          <div
            style={{
              background: '#86C166',
              padding: '16px',
              borderRadius: '8px',
              overflowX: 'auto',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              {/* LINE avatar */}
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', background: '#06C755',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: '16px',
              }}>
                💬
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: isCarousel ? 'nowrap' : undefined }}>
                {bubbles.map((bubble, i) => renderFlexBubble(bubble, i))}
              </div>
            </div>
          </div>
        )}

        {!expanded && (
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500 italic">
            ▼ プレビュー表示をクリックして内容を確認
          </div>
        )}
      </div>
    )
  } catch {
    return (
      <div>
        <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Flex Message</span>
        <p className="text-xs text-red-500 mt-1">JSON パースエラー</p>
      </div>
    )
  }
}

function ImagePreview({ content }: { content: string }) {
  try {
    const parsed = JSON.parse(content)
    const url = parsed.previewImageUrl || parsed.originalContentUrl
    return (
      <div>
        <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded mb-2 inline-block">画像</span>
        {url ? (
          <img src={url} alt="preview" className="max-w-[200px] rounded-lg border border-gray-200 mt-1" />
        ) : (
          <p className="text-xs text-gray-400">プレビューなし</p>
        )}
      </div>
    )
  } catch {
    return <p className="text-xs text-red-500">画像 JSON パースエラー</p>
  }
}

export default function ScenarioDetailClient({ scenarioId }: { scenarioId: string }) {
  const id = scenarioId

  const [scenario, setScenario] = useState<ScenarioWithSteps | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', triggerType: 'friend_add' as ScenarioTriggerType, isActive: true })
  const [saving, setSaving] = useState(false)

  const [showStepForm, setShowStepForm] = useState(false)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [stepForm, setStepForm] = useState<StepFormState>(emptyStepForm)
  const [stepSaving, setStepSaving] = useState(false)
  const [stepError, setStepError] = useState('')

  const loadScenario = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.scenarios.get(id)
      if (res.success) {
        setScenario(res.data)
        setEditForm({
          name: res.data.name,
          description: res.data.description ?? '',
          triggerType: res.data.triggerType,
          isActive: res.data.isActive,
        })
      } else {
        setError(res.error)
      }
    } catch {
      setError('シナリオの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadScenario()
  }, [loadScenario])

  const handleSaveScenario = async () => {
    if (!editForm.name.trim()) return
    setSaving(true)
    try {
      const res = await api.scenarios.update(id, {
        name: editForm.name,
        description: editForm.description || null,
        triggerType: editForm.triggerType,
        isActive: editForm.isActive,
      })
      if (res.success) {
        setEditing(false)
        loadScenario()
      } else {
        setError(res.error)
      }
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const openAddStep = () => {
    const nextOrder = scenario ? (scenario.steps.length > 0 ? Math.max(...scenario.steps.map(s => s.stepOrder)) + 1 : 1) : 1
    setStepForm({ ...emptyStepForm, stepOrder: nextOrder })
    setEditingStepId(null)
    setShowStepForm(true)
    setStepError('')
  }

  const openEditStep = (step: ScenarioStep) => {
    setStepForm({
      stepOrder: step.stepOrder,
      delayMinutes: step.delayMinutes,
      messageType: step.messageType,
      messageContent: step.messageContent,
    })
    setEditingStepId(step.id)
    setShowStepForm(true)
    setStepError('')
  }

  const handleSaveStep = async () => {
    if (!stepForm.messageContent.trim()) {
      setStepError('メッセージ内容を入力してください')
      return
    }
    setStepSaving(true)
    setStepError('')
    try {
      if (editingStepId) {
        const res = await api.scenarios.updateStep(id, editingStepId, {
          stepOrder: stepForm.stepOrder,
          delayMinutes: stepForm.delayMinutes,
          messageType: stepForm.messageType,
          messageContent: stepForm.messageContent,
        })
        if (!res.success) {
          setStepError(res.error)
          return
        }
      } else {
        const res = await api.scenarios.addStep(id, {
          stepOrder: stepForm.stepOrder,
          delayMinutes: stepForm.delayMinutes,
          messageType: stepForm.messageType,
          messageContent: stepForm.messageContent,
        })
        if (!res.success) {
          setStepError(res.error)
          return
        }
      }
      setShowStepForm(false)
      setEditingStepId(null)
      loadScenario()
    } catch {
      setStepError('ステップの保存に失敗しました')
    } finally {
      setStepSaving(false)
    }
  }

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('このステップを削除してもよいですか？')) return
    try {
      await api.scenarios.deleteStep(id, stepId)
      loadScenario()
    } catch {
      setError('ステップの削除に失敗しました')
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="シナリオ詳細" />
        <div className="bg-white rounded-lg border border-gray-200 p-8 animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
    )
  }

  if (!scenario) {
    return (
      <div>
        <Header title="シナリオ詳細" />
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">{error || 'シナリオが見つかりません'}</p>
          <Link href="/scenarios" className="text-sm text-green-600 hover:text-green-700 mt-4 inline-block">
            ← シナリオ一覧に戻る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header
        title="シナリオ詳細"
        action={
          <Link
            href="/scenarios"
            className="px-4 py-2 min-h-[44px] text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors inline-flex items-center"
          >
            ← シナリオ一覧
          </Link>
        }
      />

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Scenario Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        {editing ? (
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">シナリオ名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">説明</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                rows={2}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">トリガー</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                value={editForm.triggerType}
                onChange={(e) => setEditForm({ ...editForm, triggerType: e.target.value as ScenarioTriggerType })}
              >
                {triggerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editIsActive"
                checked={editForm.isActive}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <label htmlFor="editIsActive" className="text-sm text-gray-600">有効</label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveScenario}
                disabled={saving}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#06C755' }}
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setEditForm({
                    name: scenario.name,
                    description: scenario.description ?? '',
                    triggerType: scenario.triggerType,
                    isActive: scenario.isActive,
                  })
                }}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-4 mb-3">
              <h2 className="text-lg font-semibold text-gray-900">{scenario.name}</h2>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    scenario.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {scenario.isActive ? '有効' : '無効'}
                </span>
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs font-medium text-green-600 hover:text-green-700 px-3 py-1.5 rounded-md hover:bg-green-50 transition-colors"
                >
                  編集
                </button>
              </div>
            </div>
            {scenario.description && (
              <p className="text-sm text-gray-500 mb-3">{scenario.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>トリガー: {triggerOptions.find(o => o.value === scenario.triggerType)?.label ?? scenario.triggerType}</span>
              <span>ステップ数: {scenario.steps.length}</span>
              <span>作成日: {new Date(scenario.createdAt).toLocaleDateString('ja-JP')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">ステップ一覧</h3>
          <button
            onClick={openAddStep}
            className="px-3 py-1.5 min-h-[44px] text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#06C755' }}
          >
            + ステップ追加
          </button>
        </div>

        {/* Step form */}
        {showStepForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              {editingStepId ? 'ステップを編集' : '新しいステップを追加'}
            </h4>
            <div className="space-y-3 max-w-lg">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ステップ順序</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={stepForm.stepOrder}
                    onChange={(e) => setStepForm({ ...stepForm, stepOrder: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">遅延 (分)</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={stepForm.delayMinutes}
                    onChange={(e) => setStepForm({ ...stepForm, delayMinutes: Number(e.target.value) })}
                  />
                  <p className="text-xs text-gray-400 mt-0.5">{formatDelay(stepForm.delayMinutes)}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">メッセージタイプ</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  value={stepForm.messageType}
                  onChange={(e) => setStepForm({ ...stepForm, messageType: e.target.value as MessageType })}
                >
                  {messageTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">メッセージ内容 <span className="text-red-500">*</span></label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  rows={4}
                  placeholder="メッセージ内容を入力..."
                  value={stepForm.messageContent}
                  onChange={(e) => setStepForm({ ...stepForm, messageContent: e.target.value })}
                />
              </div>

              {stepError && <p className="text-xs text-red-600">{stepError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={handleSaveStep}
                  disabled={stepSaving}
                  className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: '#06C755' }}
                >
                  {stepSaving ? '保存中...' : editingStepId ? '更新' : '追加'}
                </button>
                <button
                  onClick={() => { setShowStepForm(false); setEditingStepId(null); setStepError('') }}
                  className="px-4 py-2 min-h-[44px] text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Steps list */}
        {scenario.steps.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            ステップがありません。「+ ステップ追加」から追加してください。
          </div>
        ) : (
          <div className="space-y-3">
            {scenario.steps
              .sort((a, b) => a.stepOrder - b.stepOrder)
              .map((step) => (
                <div
                  key={step.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white shrink-0"
                          style={{ backgroundColor: '#06C755' }}
                        >
                          {step.stepOrder}
                        </span>
                        <span className="text-xs text-gray-500">{formatDelay(step.delayMinutes)}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          step.messageType === 'text' ? 'bg-blue-50 text-blue-600' :
                          step.messageType === 'image' ? 'bg-purple-50 text-purple-600' :
                          'bg-orange-50 text-orange-600'
                        }`}>
                          {messageTypeOptions.find(o => o.value === step.messageType)?.label ?? step.messageType}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2">
                        {step.messageType === 'text' ? (
                          <p className="whitespace-pre-wrap break-words">{step.messageContent}</p>
                        ) : step.messageType === 'flex' ? (
                          <FlexPreview content={step.messageContent} />
                        ) : step.messageType === 'image' ? (
                          <ImagePreview content={step.messageContent} />
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{step.messageContent}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditStep(step)}
                        className="text-xs text-green-600 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50 transition-colors min-h-[44px] flex items-center"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDeleteStep(step.id)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors min-h-[44px] flex items-center"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
