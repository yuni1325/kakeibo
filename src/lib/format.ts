export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function toDateKey(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

export function parseDateKey(key: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

export function todayKey(): string {
  const n = new Date()
  return toDateKey(n.getFullYear(), n.getMonth() + 1, n.getDate())
}

export function yen(n: number): string {
  return n.toLocaleString('ja-JP')
}

export function signedYen(n: number): string {
  if (n > 0) return `+${yen(n)}`
  if (n < 0) return `-${yen(-n)}`
  return '0'
}

export function compactYen(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 10000) {
    const man = abs / 10000
    const s = man >= 100 ? man.toFixed(0) : man.toFixed(1).replace(/\.0$/, '')
    return `${sign}${s}万`
  }
  return `${sign}${yen(abs)}`
}

export function lastDateOfPrevMonth(y: number, m: number): string {
  const d = new Date(y, m - 1, 0)
  return toDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

/** 月曜始まり: 0=月 ... 6=日 */
export function firstWeekdayMonday(y: number, m: number): number {
  const dow = new Date(y, m - 1, 1).getDay()
  return (dow + 6) % 7
}
