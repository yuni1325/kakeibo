import { BANKS, CARDS, CASH, EMONEY, START_DATE } from '../accounts.ts'
import { accountBalance, cashTotal } from '../lib/balances.ts'
import { yen } from '../lib/format.ts'
import type { Ledger } from '../types.ts'

type Props = {
  ledger: Ledger
  onOpening: (accountId: string, amount: number) => void
}

function Group({
  title,
  ids,
  ledger,
  onOpening,
  card,
}: {
  title: string
  ids: { id: string; name: string }[]
  ledger: Ledger
  onOpening: (accountId: string, amount: number) => void
  card?: boolean
}) {
  return (
    <section className="account-block">
      <h3>{title}</h3>
      {ids.map((a) => {
        const opening = ledger.openingBalances[a.id] ?? 0
        const bal = accountBalance(a.id, opening, ledger.transactions)
        const unpaid = -bal
        const openingShown = card ? Math.max(0, -opening) : opening
        return (
          <div key={a.id} className="account-row">
            <div>
              <div>{a.name}</div>
              <label className="opening">
                {card ? '開始未払い' : `開始残高（${START_DATE.slice(5).replace('-', '/')}）`}
                <input
                  key={`${a.id}-${openingShown}`}
                  inputMode="numeric"
                  defaultValue={String(openingShown)}
                  onBlur={(e) => {
                    const n = Number(e.target.value.replace(/[^\d-]/g, ''))
                    if (!Number.isFinite(n)) return
                    onOpening(a.id, card ? -Math.abs(n) : n)
                  }}
                />
              </label>
            </div>
            {card ? (
              <b className={unpaid > 0 ? 'tx-amt out' : undefined}>
                {unpaid > 0 ? `未払い ¥${yen(unpaid)}` : '¥0'}
              </b>
            ) : (
              <b>¥{yen(bal)}</b>
            )}
          </div>
        )
      })}
    </section>
  )
}

export default function AccountsPanel({ ledger, onOpening }: Props) {
  const cash = cashTotal(ledger)
  return (
    <div>
      <div className="stats">
        <div className="stat">
          <b>¥{yen(cash)}</b>
          <span>口座残高合計（現金＋銀行＋電子マネー）</span>
        </div>
      </div>
      <p className="muted">
        開始日は 2026年8月20日。カード利用では残高は変わりません。SUICAチャージはビューカード利用、PayPayチャージはSMBCから振替、楽天Payチャージは楽天カード利用です。
      </p>
      <Group title="現金" ids={CASH} ledger={ledger} onOpening={onOpening} />
      <Group title="銀行口座" ids={BANKS} ledger={ledger} onOpening={onOpening} />
      <Group title="電子マネー" ids={EMONEY} ledger={ledger} onOpening={onOpening} />
      <Group title="クレジットカード（未払い）" ids={CARDS} ledger={ledger} onOpening={onOpening} card />
    </div>
  )
}
