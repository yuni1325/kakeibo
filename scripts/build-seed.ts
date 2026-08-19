import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { accountBalance } from '../src/lib/balances.ts'
import { ACCOUNTS } from '../src/accounts.ts'
import {
  BALANCES_2026_08_17,
  openingsFromTargets,
  prepareImport,
} from '../src/lib/parseStatement.ts'
import type { Ledger, Transaction } from '../src/types.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'tmp-csv')

const files = readdirSync(dir)
  .filter((n) => n.endsWith('.csv'))
  .map((name) => ({
    name,
    text: readFileSync(join(dir, name), 'utf8'),
  }))

const { rows, unknown } = prepareImport(files)
if (unknown.length) {
  console.error('unknown', unknown)
  process.exit(1)
}

const openingBalances = {
  ...Object.fromEntries(ACCOUNTS.map((a) => [a.id, 0])),
  ...openingsFromTargets(rows, BALANCES_2026_08_17),
}

const transactions: Transaction[] = rows
  .slice()
  .sort((a, b) => a.date.localeCompare(b.date) || a.memo.localeCompare(b.memo))
  .map((row, i) => ({
    id: `seed-${i}-${row.accountId}-${row.date}-${row.amount}`,
    date: row.date,
    amount: row.amount,
    kind: row.kind,
    accountId: row.accountId,
    toAccountId: row.kind === 'transfer' ? row.toAccountId : undefined,
    category: row.category,
    memo: row.memo,
    source: 'csv' as const,
    createdAt: Date.parse(`${row.date}T00:00:00+09:00`) + i,
  }))

const ledger: Ledger = { version: 1, openingBalances, transactions }
writeFileSync(join(root, 'src/seed.json'), `${JSON.stringify(ledger, null, 2)}\n`)

const byAcc = new Map<string, number>()
for (const t of transactions) {
  byAcc.set(t.accountId, (byAcc.get(t.accountId) ?? 0) + 1)
}
console.log('rows', transactions.length)
console.log('by account', Object.fromEntries(byAcc))
for (const [id, target] of Object.entries(BALANCES_2026_08_17)) {
  const bal = accountBalance(id, openingBalances[id] ?? 0, transactions)
  console.log(id, bal, 'target', target, bal === target ? 'OK' : 'NG')
}
