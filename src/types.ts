export type AccountType = 'bank' | 'emoney' | 'card'

export type TxKind = 'in' | 'out' | 'transfer'

export type TxSource = 'manual' | 'csv' | 'ocr'

export type Account = {
  id: string
  name: string
  type: AccountType
}

export type Transaction = {
  id: string
  date: string
  amount: number
  kind: TxKind
  accountId: string
  toAccountId?: string
  category: string
  memo: string
  source: TxSource
  createdAt: number
}

export type Ledger = {
  version: 1
  openingBalances: Record<string, number>
  transactions: Transaction[]
}

export type ImportCandidate = {
  key: string
  date: string
  amount: number
  kind: TxKind
  accountId: string
  toAccountId?: string
  category: string
  memo: string
  selected: boolean
  fileName: string
}
