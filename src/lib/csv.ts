import { pad2 } from './format.ts'

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQuotes = false
  const s = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(cur)
      cur = ''
    } else if (c === '\n') {
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
    } else if (c !== '\r') cur += c
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim()))
}

export function decodeCsvBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes)
  }
  const utf8 = new TextDecoder('utf-8').decode(bytes)
  if (!utf8.includes('\uFFFD') && /日付|年月日|利用|支払|引出|預入|取引|残高|明細/.test(utf8)) {
    return utf8
  }
  try {
    return new TextDecoder('shift-jis').decode(bytes)
  } catch {
    return utf8
  }
}

export function parseYen(raw: string | undefined): number | null {
  if (raw == null) return null
  const t = raw.replace(/[,¥￥円\s]/g, '').trim()
  if (!t || t === '-' || t === '―') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n === 0) return null
  return Math.round(n)
}

export function parseDateCell(raw: string): string | null {
  const t = raw.trim()
  let m = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(t)
  if (m) return `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(t)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

export function headerLine(rows: string[][], pred: (joined: string) => boolean): number {
  return rows.findIndex((r) => pred(r.join(',')))
}
