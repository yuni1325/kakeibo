import { ACCOUNTS, isCashAccount } from '../accounts.ts'
import { defaultCategory } from '../categories.ts'
import type { ImportCandidate, TxKind } from '../types.ts'
import { headerLine, parseCsv, parseDateCell, parseYen } from './csv.ts'

export const BALANCE_AS_OF = '2026-08-17'

export const BALANCES_2026_08_17: Record<string, number> = {
  'bank-mizuho': 318193,
  'bank-mufg': 195027,
  'bank-smbc': 14111,
  'bank-rakuten': 52896,
  'bank-jre': 434536,
}

function nf(s: string): string {
  return s.normalize('NFKC').replace(/[\s　]/g, '').replace(/[ー－−]/g, '-')
}

export function guessCategory(kind: TxKind, memo: string): string {
  if (kind === 'transfer') return '振替'
  if (kind === 'in') {
    if (/給与|給料|賞与|手当|給付|児童/.test(memo)) return '給与'
    return 'その他'
  }
  if (/電気|ガス|水道/.test(memo)) return '光熱費'
  if (/家賃|ローン|固定資産|市税|保険料|損保/.test(memo)) return '住居'
  if (/オートチャージ|えきねっと|SUICA|Suica/.test(memo)) return '交通'
  if (/ATM|ＡＴＭ|カード出金|カ-ド出金|PAYPAY|ペイペイ|楽天キャッシュ|楽天Pay/.test(memo)) {
    return 'その他'
  }
  if (/ドコモ|モバイル|ＮＨＫ|NHK|通信/.test(memo)) return '通信'
  if (/駅/.test(memo)) return '交通'
  if (/NETFLIX|ＮＥＴＦＬＩＸ|映画|シネマ|NINTENDO|CURSOR|YOUTUBE|YouTube/.test(memo)) {
    return '娯楽'
  }
  if (
    /セブン|ファミ|ローソン|ロ－ソン|マミー|マミ-|マルエツ|マクド|ピザ|寿司|飲食|ヤキ|ランチ|マルシエ|ニューデイズ/.test(
      memo,
    )
  ) {
    return '食費'
  }
  if (/マツモト|ツルハ|カワチ|ダイソー|ダイソ-|Amazon|ＡＭＡＺＯＮ|ドラッグストア/.test(memo)) {
    return '日用品'
  }
  return defaultCategory('out')
}

export function detectAccountId(fileName: string, text: string): string | null {
  const n = nf(fileName)
  if (/みずほ|mizuho/i.test(n)) return 'bank-mizuho'
  if (/UFJ|三菱/i.test(n)) return 'bank-mufg'
  if (/SMBC/i.test(n)) return 'bank-smbc'
  if (/楽天銀行|rakuten-bank/i.test(n)) return 'bank-rakuten'
  if (/JRE/i.test(n)) return 'bank-jre'
  if (/ビュー|view-/i.test(n)) return 'card-view'
  if (/楽天カード|rakuten-card/i.test(n)) return 'card-rakuten'
  if (/ライフ|life-/i.test(n)) return 'card-life'

  const t = nf(text.slice(0, 800))
  if (/お引出金額/.test(t) && /お預入金額/.test(t)) return 'bank-mizuho'
  if (/支払い金額/.test(t) && /預かり金額/.test(t)) return 'bank-mufg'
  if (/お引出し/.test(t) && /お預入れ/.test(t)) return 'bank-smbc'
  if (/ビックカメラSuica|ご利用箇所/.test(t)) return 'card-view'
  if (/利用店名/.test(t)) return 'card-rakuten'
  if (/ライフカード/.test(t) || /明細No/.test(t)) return 'card-life'
  if (/入出金\(円\)/.test(t) || /入出金\(円\)/.test(text)) {
    if (/デンゲンカイハツ|カード出金/.test(t) || /給与/.test(text.slice(0, 400))) return 'bank-jre'
    return 'bank-rakuten'
  }
  return null
}

function counterpartFromMemo(accountId: string, memo: string): string | null {
  const n = nf(memo)
  const hit = (id: string) => (id === accountId ? null : id)
  if (/ライフカ/.test(n)) return hit('card-life')
  if (/ビ[ュユ][-]?カ|ビューカード|ﾋﾞﾕ/.test(n)) return hit('card-view')
  if (/ラクテンカ|楽天カード|楽天カ-ド/.test(n)) return hit('card-rakuten')
  return null
}

type RawRow = {
  date: string
  amount: number
  kind: 'in' | 'out'
  memo: string
}

function rowsMizuho(rows: string[][]): RawRow[] {
  const i = headerLine(rows, (s) => s.includes('明細通番') && s.includes('お引出金額'))
  if (i < 0) return []
  const out: RawRow[] = []
  for (const r of rows.slice(i + 1)) {
    const date = parseDateCell(r[1] ?? '')
    if (!date) continue
    const withdraw = parseYen(r[2])
    const deposit = parseYen(r[3])
    const memo = (r[5] ?? '').trim()
    if (withdraw) out.push({ date, amount: Math.abs(withdraw), kind: 'out', memo })
    if (deposit) out.push({ date, amount: Math.abs(deposit), kind: 'in', memo })
  }
  return out
}

function rowsUfj(rows: string[][]): RawRow[] {
  const i = headerLine(rows, (s) => s.includes('支払い金額') && s.includes('預かり金額'))
  if (i < 0) return []
  const out: RawRow[] = []
  for (const r of rows.slice(i + 1)) {
    const date = parseDateCell(r[0] ?? '')
    if (!date) continue
    const pay = parseYen(r[3])
    const recv = parseYen(r[4])
    const memo = [r[1], r[2]].filter((x) => x?.trim()).join(' ').trim()
    if (pay) out.push({ date, amount: Math.abs(pay), kind: 'out', memo })
    if (recv) out.push({ date, amount: Math.abs(recv), kind: 'in', memo })
  }
  return out
}

function rowsSmbc(rows: string[][]): RawRow[] {
  const i = headerLine(rows, (s) => s.includes('お引出し') && s.includes('お預入れ'))
  if (i < 0) return []
  const out: RawRow[] = []
  for (const r of rows.slice(i + 1)) {
    const date = parseDateCell(r[0] ?? '')
    if (!date) continue
    const withdraw = parseYen(r[1])
    const deposit = parseYen(r[2])
    const memo = (r[3] ?? '').trim()
    if (withdraw) out.push({ date, amount: Math.abs(withdraw), kind: 'out', memo })
    if (deposit) out.push({ date, amount: Math.abs(deposit), kind: 'in', memo })
  }
  return out
}

function rowsSigned(rows: string[][]): RawRow[] {
  const i = headerLine(rows, (s) => s.includes('入出金') && s.includes('取引日'))
  if (i < 0) return []
  const out: RawRow[] = []
  for (const r of rows.slice(i + 1)) {
    const date = parseDateCell(r[0] ?? '')
    if (!date) continue
    const signed = parseYen(r[1])
    if (!signed) continue
    const memo = (r[3] ?? '').trim()
    out.push({
      date,
      amount: Math.abs(signed),
      kind: signed < 0 ? 'out' : 'in',
      memo,
    })
  }
  return out
}

function rowsView(rows: string[][]): RawRow[] {
  const i = headerLine(rows, (s) => s.includes('ご利用年月日') && s.includes('ご利用箇所'))
  if (i < 0) return []
  const out: RawRow[] = []
  for (const r of rows.slice(i + 1)) {
    if ((r[0] ?? '').includes('払戻日')) break
    const date = parseDateCell(r[0] ?? '')
    if (!date) continue
    const billed = parseYen(r[4]) ?? parseYen(r[2])
    if (!billed) continue
    const memo = (r[1] ?? '').trim()
    out.push({
      date,
      amount: Math.abs(billed),
      kind: billed < 0 ? 'in' : 'out',
      memo,
    })
  }
  return out
}

function rowsRakutenCard(rows: string[][]): RawRow[] {
  const i = headerLine(rows, (s) => s.includes('利用日') && s.includes('利用金額'))
  if (i < 0) return []
  const out: RawRow[] = []
  for (const r of rows.slice(i + 1)) {
    const date = parseDateCell(r[0] ?? '')
    if (!date) continue
    if ((r[1] ?? '').includes('現地利用額')) continue
    const amount = parseYen(r[4]) ?? parseYen(r[6])
    if (!amount) continue
    const memo = (r[1] ?? '').trim()
    out.push({ date, amount: Math.abs(amount), kind: amount < 0 ? 'in' : 'out', memo })
  }
  return out
}

function rowsLife(rows: string[][]): RawRow[] {
  const i = headerLine(rows, (s) => s.includes('利用日') && s.includes('利用先'))
  if (i < 0) return []
  const out: RawRow[] = []
  for (const r of rows.slice(i + 1)) {
    if ((r[0] ?? '').includes('回数指定払')) break
    const date = parseDateCell(r[3] ?? '')
    if (!date) continue
    const amount = parseYen(r[5])
    if (!amount) continue
    const memo = (r[4] ?? '').trim()
    out.push({ date, amount: Math.abs(amount), kind: 'out', memo })
  }
  return out
}

function parseRaw(accountId: string, text: string): RawRow[] {
  const rows = parseCsv(text)
  switch (accountId) {
    case 'bank-mizuho':
      return rowsMizuho(rows)
    case 'bank-mufg':
      return rowsUfj(rows)
    case 'bank-smbc':
      return rowsSmbc(rows)
    case 'bank-rakuten':
    case 'bank-jre':
      return rowsSigned(rows)
    case 'card-view':
      return rowsView(rows)
    case 'card-rakuten':
      return rowsRakutenCard(rows)
    case 'card-life':
      return rowsLife(rows)
    default:
      return rowsUfj(rows).length
        ? rowsUfj(rows)
        : rowsSmbc(rows).length
          ? rowsSmbc(rows)
          : rowsSigned(rows)
  }
}

function toCandidate(
  row: RawRow,
  accountId: string,
  fileName: string,
  index: number,
): ImportCandidate {
  const counterpart = counterpartFromMemo(accountId, row.memo)
  const kind: TxKind = row.kind === 'out' && counterpart ? 'transfer' : row.kind
  const toAccountId = kind === 'transfer' ? (counterpart ?? undefined) : undefined
  return {
    key: `${fileName}-${accountId}-${row.date}-${row.amount}-${index}`,
    date: row.date,
    amount: row.amount,
    kind,
    accountId,
    toAccountId,
    category: guessCategory(kind, row.memo),
    memo: row.memo.slice(0, 80),
    selected: true,
    fileName,
  }
}

function pairBankTransfers(rows: ImportCandidate[]): ImportCandidate[] {
  const used = new Set<string>()
  const extras: ImportCandidate[] = []
  const rest: ImportCandidate[] = []

  const outs = rows.filter(
    (r) => r.kind === 'out' && isCashAccount(r.accountId) && r.accountId.startsWith('bank-'),
  )
  const ins = rows.filter(
    (r) => r.kind === 'in' && isCashAccount(r.accountId) && r.accountId.startsWith('bank-'),
  )

  for (const o of outs) {
    if (used.has(o.key)) continue
    const match = ins.find(
      (i) =>
        !used.has(i.key) &&
        i.date === o.date &&
        i.amount === o.amount &&
        i.accountId !== o.accountId,
    )
    if (!match) continue
    used.add(o.key)
    used.add(match.key)
    extras.push({
      ...o,
      kind: 'transfer',
      toAccountId: match.accountId,
      category: '振替',
      memo: o.memo || `${match.memo}`.trim(),
    })
  }

  for (const r of rows) {
    if (used.has(r.key)) continue
    rest.push(r)
  }
  return [...rest, ...extras]
}

function dedupe(rows: ImportCandidate[]): ImportCandidate[] {
  const seen = new Set<string>()
  const out: ImportCandidate[] = []
  for (const r of rows) {
    const k = `${r.accountId}|${r.date}|${r.amount}|${r.kind}|${r.memo}|${r.toAccountId ?? ''}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(r)
  }
  return out
}

export function parseStatementFile(fileName: string, text: string): ImportCandidate[] {
  const accountId = detectAccountId(fileName, text)
  if (!accountId) return []
  return parseRaw(accountId, text).map((row, i) => toCandidate(row, accountId, fileName, i))
}

export function prepareImport(
  files: { name: string; text: string }[],
): { rows: ImportCandidate[]; unknown: string[] } {
  const unknown: string[] = []
  const all: ImportCandidate[] = []
  for (const f of files) {
    const parsed = parseStatementFile(f.name, f.text)
    if (parsed.length === 0) unknown.push(f.name)
    else all.push(...parsed)
  }
  return { rows: dedupe(pairBankTransfers(all)), unknown }
}

export function netForAccount(accountId: string, rows: ImportCandidate[]): number {
  let n = 0
  for (const r of rows) {
    if (r.kind === 'in' && r.accountId === accountId) n += r.amount
    else if (r.kind === 'out' && r.accountId === accountId) n -= r.amount
    else if (r.kind === 'transfer') {
      if (r.accountId === accountId) n -= r.amount
      if (r.toAccountId === accountId) n += r.amount
    }
  }
  return n
}

export function openingsFromTargets(
  rows: ImportCandidate[],
  targets: Record<string, number>,
): Record<string, number> {
  const opening = Object.fromEntries(ACCOUNTS.map((a) => [a.id, 0]))
  for (const [id, target] of Object.entries(targets)) {
    opening[id] = target - netForAccount(id, rows)
  }
  return opening
}
