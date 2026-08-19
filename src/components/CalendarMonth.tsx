import { compactYen, daysInMonth, firstWeekdayMonday, yen } from '../lib/format.ts'
import type { DayTotals } from '../lib/balances.ts'

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']

export type { DayTotals }

type Props = {
  year: number
  month: number
  selected: string
  today: string
  totals: Map<string, DayTotals>
  showRemain?: boolean
  transferLabel?: string
  minDate?: string
  onSelect: (date: string) => void
}

export default function CalendarMonth({
  year,
  month,
  selected,
  today,
  totals,
  showRemain = false,
  transferLabel = '振替',
  minDate,
  onSelect,
}: Props) {
  const first = firstWeekdayMonday(year, month)
  const n = daysInMonth(year, month)
  const cells: Array<number | null> = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: n }, (_, i) => i + 1),
  ]

  return (
    <div className="cal">
      {WEEKDAYS.map((w) => (
        <div key={w} className="cal-wd">
          {w}
        </div>
      ))}
      {cells.map((day, i) => {
        if (day == null) {
          return <button key={`e-${i}`} type="button" className="cal-cell" disabled />
        }
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const t = totals.get(date)
        const disabled = Boolean(minDate && date < minDate)
        const cls = [
          'cal-cell',
          date === today ? 'is-today' : '',
          date === selected ? 'is-sel' : '',
          disabled ? 'is-disabled' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <button key={date} type="button" className={cls} disabled={disabled} onClick={() => onSelect(date)}>
            <span className="cal-day">{day}</span>
            {t?.inn ? <span className="cal-in">+{yen(t.inn)}</span> : null}
            {t?.out ? <span className="cal-out">-{yen(t.out)}</span> : null}
            {t && !t.inn && !t.out && t.transfer ? (
              <span className="cal-tr">{transferLabel}</span>
            ) : null}
            {showRemain && t?.remain != null ? (
              <span className="cal-remain">{compactYen(t.remain)}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
