import type { Account } from './types.ts'

export const START_DATE = '2026-08-20'

export const ACCOUNTS: Account[] = [
  { id: 'cash', name: '現金', type: 'cash' },
  { id: 'bank-mizuho', name: 'みずほ', type: 'bank' },
  { id: 'bank-smbc', name: 'SMBC', type: 'bank' },
  { id: 'bank-mufg', name: '三菱UFJ', type: 'bank' },
  { id: 'bank-rakuten', name: '楽天銀行', type: 'bank' },
  { id: 'bank-jre', name: 'JRE', type: 'bank' },
  { id: 'emoney-suica', name: 'SUICA', type: 'emoney' },
  { id: 'emoney-paypay', name: 'PayPay', type: 'emoney' },
  { id: 'emoney-rakutenpay', name: '楽天Pay', type: 'emoney' },
  { id: 'card-life', name: 'ライフカード', type: 'card' },
  { id: 'card-rakuten', name: '楽天カード', type: 'card' },
  { id: 'card-view', name: 'ビューカード', type: 'card' },
]

export const OPENING_BALANCES: Record<string, number> = {
  cash: 50000,
  'bank-mizuho': 318193,
  'bank-mufg': 195027,
  'bank-smbc': 14111,
  'bank-rakuten': 52896,
  'bank-jre': 434536,
  'emoney-suica': 14687,
  'emoney-paypay': 88,
  'emoney-rakutenpay': 346,
  'card-life': 0,
  'card-rakuten': 0,
  'card-view': 0,
}

export const CASH = ACCOUNTS.filter((a) => a.type === 'cash')
export const BANKS = ACCOUNTS.filter((a) => a.type === 'bank')
export const EMONEY = ACCOUNTS.filter((a) => a.type === 'emoney')
export const CARDS = ACCOUNTS.filter((a) => a.type === 'card')
export const CASH_ACCOUNTS = ACCOUNTS.filter((a) => a.type !== 'card')

export const CHARGE_PRESETS = [
  {
    id: 'suica',
    label: 'SUICA',
    from: 'card-view',
    to: 'emoney-suica',
    category: '交通',
    memo: 'SUICAチャージ',
  },
  {
    id: 'paypay',
    label: 'PayPay',
    from: 'bank-smbc',
    to: 'emoney-paypay',
    category: '振替',
    memo: 'PayPayチャージ',
  },
  {
    id: 'rakutenpay',
    label: '楽天Pay',
    from: 'card-rakuten',
    to: 'emoney-rakutenpay',
    category: 'その他',
    memo: '楽天Payチャージ',
  },
] as const

const byId = new Map(ACCOUNTS.map((a) => [a.id, a]))

export function accountById(id: string): Account | undefined {
  return byId.get(id)
}

export function isCashAccount(id: string): boolean {
  const t = accountById(id)?.type
  return t === 'cash' || t === 'bank' || t === 'emoney'
}
