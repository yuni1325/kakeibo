export const EXPENSE_CATEGORIES = [
  '食費',
  '日用品',
  '交通',
  '住居',
  '光熱費',
  '通信',
  '娯楽',
  'その他',
  '仕事食費',
  '仕事飲み会',
  '仕事会議費',
  '仕事日用品',
  '仕事交通旅費',
  '仕事その他',
] as const

export const INCOME_CATEGORIES = ['給与', 'その他'] as const

export function defaultCategory(kind: 'in' | 'out' | 'transfer'): string {
  if (kind === 'in') return '給与'
  if (kind === 'transfer') return '振替'
  return '食費'
}
