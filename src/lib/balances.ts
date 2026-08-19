import { CASH_ACCOUNTS, START_DATE, accountById, isCashAccount } from '../accounts.ts'
import { EXPENSE_CATEGORIES } from '../categories.ts'
import { daysInMonth, lastDateOfPrevMonth, toDateKey } from './format.ts'
import type { Ledger, Transaction } from '../types.ts'

export function accountBalance(
  accountId: string,
  opening: number,
  txs: Transaction[],
): number {
  let n = opening
  for (const tx of txs) {
    if (tx.kind === 'in' && tx.accountId === accountId) n += tx.amount
    else if (tx.kind === 'out' && tx.accountId === accountId) n -= tx.amount
    else if (tx.kind === 'transfer') {
      if (tx.accountId === accountId) n -= tx.amount
      if (tx.toAccountId === accountId) n += tx.amount
    }
  }
  return n
}

export function cashDelta(tx: Transaction): number {
  let n = 0
  if (tx.kind === 'in' && isCashAccount(tx.accountId)) n += tx.amount
  if (tx.kind === 'out' && isCashAccount(tx.accountId)) n -= tx.amount
  if (tx.kind === 'transfer') {
    if (isCashAccount(tx.accountId)) n -= tx.amount
    if (isCashAccount(tx.toAccountId ?? '')) n += tx.amount
  }
  return n
}

/** カレンダー上の執行。カード利用とカードからのチャージを含む。口座間振替・カード支払いは含まない。 */
export function isExecutionTx(tx: Transaction): boolean {
  if (tx.kind === 'in' || tx.kind === 'out') return true
  if (
    tx.kind === 'transfer' &&
    accountById(tx.accountId)?.type === 'card' &&
    accountById(tx.toAccountId ?? '')?.type === 'emoney'
  ) {
    return true
  }
  return false
}

export function isCardPayment(tx: Transaction): boolean {
  return tx.kind === 'transfer' && accountById(tx.toAccountId ?? '')?.type === 'card'
}

export function isCardChargeTx(tx: Transaction, cardId: string): boolean {
  if (tx.accountId === cardId && (tx.kind === 'out' || tx.kind === 'in')) return true
  if (tx.kind === 'transfer' && tx.accountId === cardId) return true
  if (tx.kind === 'transfer' && tx.toAccountId === cardId) return true
  return false
}

export function txsThrough(txs: Transaction[], date: string): Transaction[] {
  return txs.filter((tx) => tx.date <= date)
}

export function cashTotal(ledger: Ledger, throughDate?: string): number {
  const txs = throughDate ? txsThrough(ledger.transactions, throughDate) : ledger.transactions
  return CASH_ACCOUNTS.reduce(
    (sum, a) => sum + accountBalance(a.id, ledger.openingBalances[a.id] ?? 0, txs),
    0,
  )
}

export function openingCash(ledger: Ledger): number {
  return CASH_ACCOUNTS.reduce((sum, a) => sum + (ledger.openingBalances[a.id] ?? 0), 0)
}

export function monthStartCash(ledger: Ledger, y: number, m: number): number {
  const startMonth = START_DATE.slice(0, 7)
  const thisMonth = `${y}-${String(m).padStart(2, '0')}`
  if (thisMonth <= startMonth) return openingCash(ledger)
  return cashTotal(ledger, lastDateOfPrevMonth(y, m))
}

export function monthExecution(txs: Transaction[], y: number, m: number) {
  const prefix = `${y}-${String(m).padStart(2, '0')}-`
  let inn = 0
  let out = 0
  for (const tx of txs) {
    if (!tx.date.startsWith(prefix) || tx.date < START_DATE || !isExecutionTx(tx)) continue
    if (tx.kind === 'in') inn += tx.amount
    else out += tx.amount
  }
  return { inn, out, net: inn - out }
}

export function monthByCategory(
  txs: Transaction[],
  y: number,
  m: number,
): { category: string; amount: number }[] {
  const prefix = `${y}-${String(m).padStart(2, '0')}-`
  const map = new Map<string, number>()
  for (const tx of txs) {
    if (!tx.date.startsWith(prefix) || tx.date < START_DATE || !isExecutionTx(tx)) continue
    if (tx.kind === 'in') continue
    map.set(tx.category === '振替' ? 'その他' : tx.category, (map.get(tx.category === '振替' ? 'その他' : tx.category) ?? 0) + tx.amount)
  }
  const known = EXPENSE_CATEGORIES.filter((c) => (map.get(c) ?? 0) > 0).map((c) => ({
    category: c,
    amount: map.get(c) ?? 0,
  }))
  const extra = [...map.entries()]
    .filter(([c]) => !(EXPENSE_CATEGORIES as readonly string[]).includes(c))
    .map(([category, amount]) => ({ category, amount }))
  return [...known, ...extra].sort((a, b) => b.amount - a.amount)
}

export function monthCardSpend(txs: Transaction[], cardId: string, y: number, m: number) {
  const prefix = `${y}-${String(m).padStart(2, '0')}-`
  let out = 0
  for (const tx of txs) {
    if (!tx.date.startsWith(prefix) || tx.date < START_DATE) continue
    if (tx.accountId === cardId && tx.kind === 'out') out += tx.amount
    if (tx.kind === 'transfer' && tx.accountId === cardId) out += tx.amount
  }
  return out
}

export function monthCardPayments(txs: Transaction[], y: number, m: number): Transaction[] {
  const prefix = `${y}-${String(m).padStart(2, '0')}-`
  return txs
    .filter((tx) => tx.date.startsWith(prefix) && tx.date >= START_DATE && isCardPayment(tx))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
}

export type DayTotals = {
  inn: number
  out: number
  transfer: number
  remain?: number
}

export function executionCalendar(
  ledger: Ledger,
  y: number,
  m: number,
): Map<string, DayTotals> {
  const prefix = `${y}-${String(m).padStart(2, '0')}-`
  const exec = new Map<string, { inn: number; out: number }>()
  const cash = new Map<string, number>()
  const paid = new Map<string, number>()
  for (const tx of ledger.transactions) {
    if (!tx.date.startsWith(prefix) || tx.date < START_DATE) continue
    if (isExecutionTx(tx)) {
      const cur = exec.get(tx.date) ?? { inn: 0, out: 0 }
      if (tx.kind === 'in') cur.inn += tx.amount
      else cur.out += tx.amount
      exec.set(tx.date, cur)
    }
    const delta = cashDelta(tx)
    if (delta !== 0) cash.set(tx.date, (cash.get(tx.date) ?? 0) + delta)
    if (isCardPayment(tx)) paid.set(tx.date, (paid.get(tx.date) ?? 0) + tx.amount)
  }
  const map = new Map<string, DayTotals>()
  let remain = monthStartCash(ledger, y, m)
  const n = daysInMonth(y, m)
  for (let d = 1; d <= n; d++) {
    const date = toDateKey(y, m, d)
    const t = exec.get(date) ?? { inn: 0, out: 0 }
    if (date >= START_DATE) remain += cash.get(date) ?? 0
    map.set(date, {
      inn: t.inn,
      out: t.out,
      transfer: paid.get(date) ?? 0,
      remain: date >= START_DATE ? remain : undefined,
    })
  }
  return map
}
