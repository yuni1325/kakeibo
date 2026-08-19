import { useEffect, useState } from 'react'
import {
  ACCOUNTS,
  BANKS,
  CARDS,
  CASH_ACCOUNTS,
  CHARGE_PRESETS,
} from '../accounts.ts'
import { defaultCategory, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../categories.ts'
import { todayKey } from '../lib/format.ts'
import type { Transaction, TxKind } from '../types.ts'

export type InputMode = 'out' | 'in' | 'card' | 'pay' | 'charge'

export type ComposerDraft = {
  date: string
  amount: string
  kind: TxKind
  accountId: string
  toAccountId: string
  category: string
  memo: string
}

const MODE_LABEL: Record<InputMode, string> = {
  out: '出金',
  in: '入金',
  card: 'カード利用',
  pay: 'カード支払',
  charge: 'チャージ',
}

function detectMode(tx: Transaction): InputMode {
  if (tx.kind === 'in') return 'in'
  if (tx.kind === 'out') {
    return CARDS.some((c) => c.id === tx.accountId) ? 'card' : 'out'
  }
  if (CHARGE_PRESETS.some((p) => p.from === tx.accountId && p.to === tx.toAccountId)) return 'charge'
  if (BANKS.some((b) => b.id === tx.accountId) && CARDS.some((c) => c.id === tx.toAccountId)) {
    return 'pay'
  }
  return 'out'
}

function empty(date: string, accountId: string, mode: InputMode): ComposerDraft {
  if (mode === 'card') {
    const card = CARDS.some((c) => c.id === accountId) ? accountId : CARDS[0].id
    return {
      date,
      amount: '',
      kind: 'out',
      accountId: card,
      toAccountId: CASH_ACCOUNTS[0].id,
      category: defaultCategory('out'),
      memo: '',
    }
  }
  if (mode === 'pay') {
    return {
      date,
      amount: '',
      kind: 'transfer',
      accountId: BANKS[0].id,
      toAccountId: CARDS[0].id,
      category: '振替',
      memo: 'カード引き落とし',
    }
  }
  if (mode === 'charge') {
    const p = CHARGE_PRESETS[0]
    return {
      date,
      amount: '',
      kind: 'transfer',
      accountId: p.from,
      toAccountId: p.to,
      category: p.category,
      memo: p.memo,
    }
  }
  const cash = CASH_ACCOUNTS.some((a) => a.id === accountId) ? accountId : CASH_ACCOUNTS[0].id
  return {
    date,
    amount: '',
    kind: mode,
    accountId: cash,
    toAccountId: CASH_ACCOUNTS.find((a) => a.id !== cash)?.id ?? cash,
    category: defaultCategory(mode),
    memo: '',
  }
}

type Props = {
  initial?: Transaction | null
  defaultDate: string
  defaultAccountId: string
  defaultMode?: InputMode
  onClose: () => void
  onSave: (draft: ComposerDraft, id?: string) => void
  onDelete?: (id: string) => void
}

export default function Composer({
  initial,
  defaultDate,
  defaultAccountId,
  defaultMode = 'out',
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [mode, setMode] = useState<InputMode>(() => (initial ? detectMode(initial) : defaultMode))
  const [d, setD] = useState<ComposerDraft>(() =>
    initial
      ? {
          date: initial.date,
          amount: String(initial.amount),
          kind: initial.kind,
          accountId: initial.accountId,
          toAccountId: initial.toAccountId ?? empty(initial.date, initial.accountId, 'pay').toAccountId,
          category: initial.category,
          memo: initial.memo,
        }
      : empty(defaultDate || todayKey(), defaultAccountId, defaultMode),
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function applyMode(next: InputMode) {
    setMode(next)
    setD((prev) => ({ ...empty(prev.date, prev.accountId, next), amount: prev.amount, date: prev.date }))
  }

  const chargePreset =
    CHARGE_PRESETS.find((p) => p.from === d.accountId && p.to === d.toAccountId) ?? CHARGE_PRESETS[0]

  const cats = d.kind === 'in' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const accountOptions =
    mode === 'card' ? CARDS : mode === 'pay' ? BANKS : mode === 'charge' ? ACCOUNTS : CASH_ACCOUNTS

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (!d.amount || Number(d.amount) <= 0) return
          if ((mode === 'pay' || mode === 'charge') && d.accountId === d.toAccountId) return
          onSave(d, initial?.id)
        }}
      >
        <h2>{initial ? '記録を編集' : '記録'}</h2>
        <div className="pills">
          {(['out', 'in', 'card', 'pay', 'charge'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`pill${mode === k ? ' on' : ''}`}
              onClick={() => applyMode(k)}
            >
              {MODE_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="field">
            金額
            <input
              className="amount-input"
              inputMode="numeric"
              value={d.amount}
              onChange={(e) => setD({ ...d, amount: e.target.value.replace(/[^\d]/g, '') })}
              placeholder="0"
              autoFocus
            />
          </label>

          {mode === 'charge' ? (
            <label className="field">
              チャージ先
              <select
                value={chargePreset.id}
                onChange={(e) => {
                  const p = CHARGE_PRESETS.find((x) => x.id === e.target.value)
                  if (!p) return
                  setD({
                    ...d,
                    kind: 'transfer',
                    accountId: p.from,
                    toAccountId: p.to,
                    category: p.category,
                    memo: p.memo,
                  })
                }}
              >
                {CHARGE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}（{ACCOUNTS.find((a) => a.id === p.from)?.name}）
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field">
              {mode === 'pay' ? '引き落とし口座' : mode === 'card' ? 'カード' : '口座'}
              <select
                value={d.accountId}
                onChange={(e) => setD({ ...d, accountId: e.target.value })}
              >
                {accountOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {mode === 'pay' ? (
            <label className="field">
              支払うカード
              <select
                value={d.toAccountId}
                onChange={(e) => setD({ ...d, toAccountId: e.target.value, kind: 'transfer' })}
              >
                {CARDS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {mode === 'out' || mode === 'in' || mode === 'card' ? (
            <label className="field">
              分類
              <select
                value={d.category}
                onChange={(e) => setD({ ...d, category: e.target.value })}
              >
                {cats.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="field">
            メモ
            <input value={d.memo} onChange={(e) => setD({ ...d, memo: e.target.value })} />
          </label>
          <label className="field">
            日付
            <input
              type="date"
              min="2026-08-20"
              value={d.date}
              onChange={(e) => setD({ ...d, date: e.target.value })}
            />
          </label>
        </div>
        <div className="sheet-actions">
          {initial && onDelete ? (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                if (confirm('この記録を削除しますか？')) onDelete(initial.id)
              }}
            >
              削除
            </button>
          ) : (
            <button type="button" className="btn ghost" onClick={onClose}>
              閉じる
            </button>
          )}
          <button type="submit" className="btn primary">
            保存
          </button>
        </div>
      </form>
    </div>
  )
}
