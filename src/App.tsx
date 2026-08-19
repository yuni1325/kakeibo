import { useMemo, useRef, useState } from 'react'
import { accountById, CARDS, START_DATE } from './accounts.ts'
import AccountsPanel from './components/AccountsPanel.tsx'
import CalendarMonth from './components/CalendarMonth.tsx'
import Composer, { type ComposerDraft, type InputMode } from './components/Composer.tsx'
import {
  executionCalendar,
  isCardChargeTx,
  isCardPayment,
  monthByCategory,
  monthCardPayments,
  monthCardSpend,
  monthExecution,
  monthStartCash,
} from './lib/balances.ts'
import { parseLedger } from './storage.ts'
import { todayKey, yen } from './lib/format.ts'
import { useStore } from './store.tsx'
import type { Transaction } from './types.ts'

type Tab = 'cash' | 'card' | 'accounts'

const LAST_ACCOUNT = 'kakeibo.lastAccount'

function lastAccountId(): string {
  return localStorage.getItem(LAST_ACCOUNT) || 'bank-mizuho'
}

function dayMap(
  txs: Transaction[],
  asCardId?: string,
): Map<string, { inn: number; out: number; transfer: number }> {
  const map = new Map<string, { inn: number; out: number; transfer: number }>()
  for (const tx of txs) {
    const cur = map.get(tx.date) ?? { inn: 0, out: 0, transfer: 0 }
    if (tx.kind === 'in') cur.inn += tx.amount
    else if (tx.kind === 'out') cur.out += tx.amount
    else if (asCardId && tx.accountId === asCardId) cur.out += tx.amount
    else cur.transfer += tx.amount
    map.set(tx.date, cur)
  }
  return map
}

function TxRows({
  rows,
  onOpen,
}: {
  rows: Transaction[]
  onOpen: (tx: Transaction) => void
}) {
  if (rows.length === 0) {
    return <p className="empty">この日の記録はありません</p>
  }
  return (
    <ul className="tx-list">
      {rows.map((tx) => {
        const from = accountById(tx.accountId)?.name ?? tx.accountId
        const to = tx.toAccountId ? accountById(tx.toAccountId)?.name : null
        const label =
          tx.kind === 'transfer'
            ? `${from} → ${to}`
            : `${from} · ${tx.category}${tx.memo ? ` · ${tx.memo}` : ''}`
        const amtClass = tx.kind === 'in' ? 'in' : tx.kind === 'out' ? 'out' : ''
        const amtText =
          tx.kind === 'in'
            ? `+${yen(tx.amount)}`
            : tx.kind === 'out'
              ? `-${yen(tx.amount)}`
              : isCardPayment(tx)
                ? `支払 ${yen(tx.amount)}`
                : `チャージ ${yen(tx.amount)}`
        return (
          <li key={tx.id}>
            <button type="button" className="tx-row" onClick={() => onOpen(tx)}>
              <span>
                <div>
                  {tx.kind === 'transfer'
                    ? tx.memo || (isCardPayment(tx) ? 'カード支払' : 'チャージ')
                    : tx.memo || tx.category}
                </div>
                <div className="tx-meta">{label}</div>
              </span>
              <span className={`tx-amt ${amtClass}`}>{amtText}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Shell() {
  const now = new Date()
  const { ledger, addTx, updateTx, deleteTx, setOpening, replaceLedger } = useStore()
  const [tab, setTab] = useState<Tab>('cash')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selected, setSelected] = useState(todayKey())
  const [cardId, setCardId] = useState(CARDS[0].id)
  const [composer, setComposer] = useState<Transaction | null | 'new'>(null)
  const [composerMode, setComposerMode] = useState<InputMode>('out')
  const fileRef = useRef<HTMLInputElement>(null)

  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  const cardTxs = useMemo(
    () =>
      ledger.transactions.filter((tx) => isCardChargeTx(tx, cardId) && tx.date.startsWith(prefix)),
    [ledger.transactions, cardId, prefix],
  )

  const execTotals = useMemo(
    () => executionCalendar(ledger, year, month),
    [ledger, year, month],
  )
  const cardTotals = useMemo(() => dayMap(cardTxs, cardId), [cardTxs, cardId])
  const totals = tab === 'card' ? cardTotals : execTotals

  const startBal = useMemo(
    () => monthStartCash(ledger, year, month),
    [ledger, year, month],
  )
  const execSum = useMemo(
    () => monthExecution(ledger.transactions, year, month),
    [ledger.transactions, year, month],
  )
  const remainBal =
    execTotals.get(
      `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`,
    )?.remain ?? startBal
  const byCat = useMemo(
    () => monthByCategory(ledger.transactions, year, month),
    [ledger.transactions, year, month],
  )
  const cardSpend = useMemo(
    () => monthCardSpend(ledger.transactions, cardId, year, month),
    [ledger.transactions, cardId, year, month],
  )
  const cardPays = useMemo(
    () => monthCardPayments(ledger.transactions, year, month),
    [ledger.transactions, year, month],
  )
  const dayRows = (
    tab === 'card' ? cardTxs.filter((tx) => tx.date === selected) : ledger.transactions.filter((tx) => tx.date === selected)
  )
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    setYear(y)
    setMonth(m)
    const day = Math.min(Number(selected.slice(8)), new Date(y, m, 0).getDate())
    setSelected(`${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }

  function saveDraft(d: ComposerDraft, id?: string) {
    const amount = Number(d.amount)
    if (!Number.isFinite(amount) || amount <= 0) return
    if (d.kind === 'transfer' && d.accountId === d.toAccountId) return
    localStorage.setItem(LAST_ACCOUNT, d.accountId)
    const body = {
      date: d.date < START_DATE ? START_DATE : d.date,
      amount,
      kind: d.kind,
      accountId: d.accountId,
      toAccountId: d.kind === 'transfer' ? d.toAccountId : undefined,
      category: d.kind === 'transfer' && d.category === '振替' ? '振替' : d.category,
      memo: d.memo.trim(),
      source: 'manual' as const,
    }
    if (id) updateTx(id, body)
    else addTx(body)
    setSelected(body.date)
    const parts = body.date.split('-')
    if (parts.length === 3) {
      setYear(Number(parts[0]))
      setMonth(Number(parts[1]))
    }
    setComposer(null)
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(ledger, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `kakeibo-${todayKey()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function importJson(file: File) {
    const text = await file.text()
    const parsed = parseLedger(JSON.parse(text))
    if (!parsed) {
      alert('読み込めないファイルです')
      return
    }
    if (!confirm('現在のデータを置き換えますか？')) return
    replaceLedger(parsed)
  }

  const selectedLabel = `${Number(selected.slice(5, 7))}月${Number(selected.slice(8))}日`
  const today = todayKey()
  const dayRemain = execTotals.get(selected)?.remain

  return (
    <div>
      <header className="app-head">
        <h1>家計簿</h1>
        <div className="head-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setComposerMode(tab === 'card' ? 'card' : 'out')
              setComposer('new')
            }}
          >
            記録
          </button>
        </div>
      </header>

      <div className="tabs">
        <button type="button" className={`pill${tab === 'cash' ? ' on' : ''}`} onClick={() => setTab('cash')}>
          家計
        </button>
        <button type="button" className={`pill${tab === 'card' ? ' on' : ''}`} onClick={() => setTab('card')}>
          カード
        </button>
        <button
          type="button"
          className={`pill${tab === 'accounts' ? ' on' : ''}`}
          onClick={() => setTab('accounts')}
        >
          口座
        </button>
      </div>

      {tab !== 'accounts' ? (
        <>
          <div className="month-nav">
            <button type="button" className="btn ghost" onClick={() => shiftMonth(-1)}>
              前月
            </button>
            <h2>
              {year}年{month}月
            </h2>
            <button type="button" className="btn ghost" onClick={() => shiftMonth(1)}>
              翌月
            </button>
          </div>

          {tab === 'card' ? (
            <div className="pills" style={{ marginBottom: 12 }}>
              {CARDS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`pill${cardId === c.id ? ' on' : ''}`}
                  onClick={() => setCardId(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}

          {tab === 'cash' ? (
            <>
              <p className="note">
                8/20開始。カード利用はカレンダーに出ますが残高は減りません。残高は口座出入金・チャージ・カード支払いで変わります。
              </p>
              <div className="stats">
                <div className="stat">
                  <b>¥{yen(startBal)}</b>
                  <span>予算（開始時の口座残高）</span>
                </div>
                <div className="stat out">
                  <b>¥{yen(execSum.out)}</b>
                  <span>執行（利用）</span>
                </div>
                <div className="stat">
                  <b>¥{yen(remainBal)}</b>
                  <span>残（口座残高）</span>
                </div>
              </div>
              {byCat.length > 0 ? (
                <>
                  <div className="section-title">
                    <h3>何に執行したか</h3>
                  </div>
                  <ul className="cat-list">
                    {byCat.map((row) => (
                      <li key={row.category}>
                        <span>{row.category}</span>
                        <span>¥{yen(row.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          ) : (
            <>
              <p className="note">利用は利用日、口座残高の減少はカード支払（引き落とし）の日です。</p>
              <div className="stats">
                <div className="stat out">
                  <b>¥{yen(cardSpend)}</b>
                  <span>今月の利用</span>
                </div>
                <div className="stat">
                  <b>{cardTxs.filter((t) => t.kind === 'out' || t.accountId === cardId).length}</b>
                  <span>件数</span>
                </div>
                <div className="stat">
                  <b>{accountById(cardId)?.name}</b>
                  <span>表示中</span>
                </div>
              </div>
              {cardPays.filter((tx) => tx.toAccountId === cardId).length > 0 ? (
                <ul className="cat-list">
                  {cardPays
                    .filter((tx) => tx.toAccountId === cardId)
                    .map((tx) => (
                      <li key={tx.id}>
                        <span>
                          支払 {accountById(tx.accountId)?.name} {tx.date.slice(5).replace('-', '/')}
                        </span>
                        <span>¥{yen(tx.amount)}</span>
                      </li>
                    ))}
                </ul>
              ) : null}
            </>
          )}

          <CalendarMonth
            year={year}
            month={month}
            selected={selected}
            today={today}
            totals={totals}
            showRemain={tab === 'cash'}
            transferLabel="支払"
            minDate={START_DATE}
            onSelect={setSelected}
          />

          <div className="section-title">
            <h3>
              {selectedLabel}
              {tab === 'card' ? ` · ${accountById(cardId)?.name}` : 'の記録'}
            </h3>
            <span className="muted">
              {dayRows.length}件
              {tab === 'cash' && dayRemain != null ? ` · 残 ¥${yen(dayRemain)}` : ''}
            </span>
          </div>
          <TxRows rows={dayRows} onOpen={setComposer} />
        </>
      ) : (
        <>
          <AccountsPanel ledger={ledger} onOpening={setOpening} />
          <div className="head-actions" style={{ marginTop: 20 }}>
            <button type="button" className="btn" onClick={exportJson}>
              バックアップ
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              復元
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void importJson(f)
              }}
            />
          </div>
        </>
      )}

      {composer !== null ? (
        <Composer
          initial={composer === 'new' ? null : composer}
          defaultDate={selected < START_DATE ? START_DATE : selected}
          defaultAccountId={tab === 'card' ? cardId : lastAccountId()}
          defaultMode={composer === 'new' ? composerMode : undefined}
          onClose={() => setComposer(null)}
          onSave={saveDraft}
          onDelete={(id) => {
            deleteTx(id)
            setComposer(null)
          }}
        />
      ) : null}
    </div>
  )
}

export default function App() {
  return <Shell />
}
