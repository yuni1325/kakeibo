import { OPENING_BALANCES } from './accounts.ts'
import type { Ledger, Transaction } from './types.ts'

const KEY = 'kakeibo.ledger.v1'
const SEED_VER = 'kakeibo.seed.v7'

export function emptyLedger(): Ledger {
  return {
    version: 1,
    openingBalances: { ...OPENING_BALANCES },
    transactions: [],
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function parseTx(v: unknown): Transaction | null {
  if (!isRecord(v)) return null
  if (typeof v.id !== 'string') return null
  if (typeof v.date !== 'string') return null
  if (typeof v.amount !== 'number' || !Number.isFinite(v.amount)) return null
  if (v.kind !== 'in' && v.kind !== 'out' && v.kind !== 'transfer') return null
  if (typeof v.accountId !== 'string') return null
  if (typeof v.category !== 'string') return null
  if (typeof v.memo !== 'string') return null
  if (v.source !== 'manual' && v.source !== 'ocr' && v.source !== 'csv') return null
  if (typeof v.createdAt !== 'number') return null
  const toAccountId = typeof v.toAccountId === 'string' ? v.toAccountId : undefined
  return {
    id: v.id,
    date: v.date,
    amount: Math.round(Math.abs(v.amount)),
    kind: v.kind,
    accountId: v.accountId,
    toAccountId,
    category: v.category,
    memo: v.memo,
    source: v.source,
    createdAt: v.createdAt,
  }
}

export function parseLedger(raw: unknown): Ledger | null {
  if (!isRecord(raw) || raw.version !== 1) return null
  const openingBalances: Record<string, number> = { ...emptyLedger().openingBalances }
  if (isRecord(raw.openingBalances)) {
    for (const [id, n] of Object.entries(raw.openingBalances)) {
      if (typeof n === 'number' && Number.isFinite(n)) openingBalances[id] = Math.round(n)
    }
  }
  if (!Array.isArray(raw.transactions)) return null
  const transactions: Transaction[] = []
  for (const item of raw.transactions) {
    const tx = parseTx(item)
    if (tx) transactions.push(tx)
  }
  return { version: 1, openingBalances, transactions }
}

export function loadLedger(): Ledger {
  try {
    const applied = localStorage.getItem(SEED_VER)
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? parseLedger(JSON.parse(raw)) : null
    if (!applied) {
      const fresh = emptyLedger()
      saveLedger(fresh)
      localStorage.setItem(SEED_VER, '1')
      return fresh
    }
    return parsed ?? emptyLedger()
  } catch {
    return emptyLedger()
  }
}

export function saveLedger(ledger: Ledger): void {
  localStorage.setItem(KEY, JSON.stringify(ledger))
}
