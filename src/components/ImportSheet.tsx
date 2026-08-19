import { useState } from 'react'
import { accountById, ACCOUNTS } from '../accounts.ts'
import { decodeCsvBuffer } from '../lib/csv.ts'
import { yen } from '../lib/format.ts'
import { prepareImport } from '../lib/parseStatement.ts'
import type { ImportCandidate, Transaction } from '../types.ts'

type Draft = Omit<Transaction, 'id' | 'createdAt'>

type Props = {
  existing: Transaction[]
  onClose: () => void
  onImport: (drafts: Draft[]) => void
}

function isDup(row: ImportCandidate, existing: Transaction[]): boolean {
  return existing.some(
    (tx) =>
      tx.date === row.date &&
      tx.amount === row.amount &&
      tx.accountId === row.accountId &&
      tx.kind === row.kind &&
      tx.memo === row.memo,
  )
}

export default function ImportSheet({ existing, onClose, onImport }: Props) {
  const [status, setStatus] = useState('銀行・カードのCSVを選んでください（複数可）')
  const [unknown, setUnknown] = useState<string[]>([])
  const [rows, setRows] = useState<ImportCandidate[]>([])

  async function onFiles(list: FileList | null) {
    if (!list?.length) return
    const files: { name: string; text: string }[] = []
    for (const file of Array.from(list)) {
      const text = decodeCsvBuffer(await file.arrayBuffer())
      files.push({ name: file.name, text })
    }
    const prepared = prepareImport(files)
    const next = prepared.rows.map((row) => ({
      ...row,
      selected: row.selected && !isDup(row, existing),
    }))
    setRows(next)
    setUnknown(prepared.unknown)
    const n = next.length
    const skipped = next.filter((r) => !r.selected).length
    setStatus(
      n
        ? `${n}件を検出${skipped ? `（既存と重複 ${skipped}件はオフ）` : ''}`
        : '明細行が見つかりませんでした',
    )
  }

  function patch(key: string, next: Partial<ImportCandidate>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...next } : r)))
  }

  const selected = rows.filter((r) => r.selected)

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>CSV明細を読み込む</h2>
        <div className="form-grid">
          <label className="btn file-btn primary">
            CSVファイルを選ぶ
            <input
              type="file"
              accept=".csv,text/csv"
              multiple
              onChange={(e) => {
                void onFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
          <span className="muted">{status}</span>
          {unknown.length > 0 ? (
            <p className="muted">判別できなかったファイル: {unknown.join('、')}</p>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <table className="review-table">
            <thead>
              <tr>
                <th>取込</th>
                <th>口座</th>
                <th>日付</th>
                <th>金額</th>
                <th>メモ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={(e) => patch(row.key, { selected: e.target.checked })}
                    />
                  </td>
                  <td>
                    <select
                      value={row.accountId}
                      onChange={(e) => patch(row.key, { accountId: e.target.value })}
                    >
                      {ACCOUNTS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => patch(row.key, { date: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.amount}
                      onChange={(e) => patch(row.key, { amount: Number(e.target.value) || 0 })}
                    />
                    <div className="muted">
                      {row.kind === 'in'
                        ? '入金'
                        : row.kind === 'out'
                          ? '出金'
                          : `振替 → ${accountById(row.toAccountId ?? '')?.name ?? ''}`}
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.memo}
                      onChange={(e) => patch(row.key, { memo: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        <div className="sheet-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            閉じる
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={selected.length === 0}
            onClick={() => {
              onImport(
                selected.map((row) => ({
                  date: row.date,
                  amount: row.amount,
                  kind: row.kind,
                  accountId: row.accountId,
                  toAccountId: row.kind === 'transfer' ? row.toAccountId : undefined,
                  category: row.category,
                  memo: row.memo,
                  source: 'csv',
                })),
              )
            }}
          >
            {selected.length ? `${selected.length}件を取り込む` : '取り込む'}
            {selected.length
              ? `（¥${yen(selected.reduce((s, r) => s + r.amount, 0))}）`
              : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
