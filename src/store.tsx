import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Ledger, Transaction } from './types.ts'
import { loadLedger, saveLedger } from './storage.ts'

type Draft = Omit<Transaction, 'id' | 'createdAt'>

type Store = {
  ledger: Ledger
  addTx: (draft: Draft) => void
  addMany: (drafts: Draft[]) => void
  updateTx: (id: string, patch: Partial<Transaction>) => void
  deleteTx: (id: string) => void
  setOpening: (accountId: string, amount: number) => void
  replaceLedger: (next: Ledger) => void
}

const StoreContext = createContext<Store | null>(null)

function persist(next: Ledger): Ledger {
  saveLedger(next)
  return next
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ledger, setLedger] = useState<Ledger>(() => loadLedger())

  const value = useMemo<Store>(
    () => ({
      ledger,
      addTx(draft) {
        const tx: Transaction = {
          ...draft,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        }
        setLedger((prev) => persist({ ...prev, transactions: [...prev.transactions, tx] }))
      },
      addMany(drafts) {
        const now = Date.now()
        const txs = drafts.map((d, i) => ({
          ...d,
          id: crypto.randomUUID(),
          createdAt: now + i,
        }))
        setLedger((prev) => persist({ ...prev, transactions: [...prev.transactions, ...txs] }))
      },
      updateTx(id, patch) {
        setLedger((prev) =>
          persist({
            ...prev,
            transactions: prev.transactions.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx)),
          }),
        )
      },
      deleteTx(id) {
        setLedger((prev) =>
          persist({ ...prev, transactions: prev.transactions.filter((tx) => tx.id !== id) }),
        )
      },
      setOpening(accountId, amount) {
        setLedger((prev) =>
          persist({
            ...prev,
            openingBalances: { ...prev.openingBalances, [accountId]: Math.round(amount) },
          }),
        )
      },
      replaceLedger(next) {
        setLedger(persist(next))
      },
    }),
    [ledger],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('StoreProvider missing')
  return ctx
}
