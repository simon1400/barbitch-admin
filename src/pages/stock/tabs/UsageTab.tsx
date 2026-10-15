// «Spotřeba» (s261, Фаза 3 плана STOCK_NEXT_SESSION_PROMPT.md §5.5): за месяц — сколько пришло
// и сколько израсходовано, по категориям и позициям. Расход сервер считает из пересчётов (между
// двумя пересчётами израсходовано «было − насчитали», приходы учтены), поэтому после последней
// инвентуры он ещё не известен — у позиции видно, сколько дней месяца покрыто. Руководству —
// оценка в Kč по цене упаковки и сколько заплачено по приходам заказов; администратору сервер
// денег не отдаёт.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { errMsg } from '../../../lib/errMsg'
import { kc } from '../../../utils/money'
import { cardCls, cardTitleCls, hintCls, iconBtnCls, tileCls, tileLabelCls, tileSubCls, tileValueCls } from '../../../ui/kit'
import { fetchStockReport, type StockReport, type UsageRow } from '../fetch/stock'
import { smallCls } from '../stockText'

/** «říjen 2026» */
const monthLabel = (m: string): string => {
  const [y, mo] = m.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const dny = (n: number): string => {
  const r = Math.round(n)
  return `${r} ${r === 1 ? 'den' : r >= 2 && r <= 4 ? 'dny' : 'dní'}`
}

function Row({ r, days, showPrices }: { r: UsageRow; days: number; showPrices: boolean }) {
  // расход известен не за весь месяц — сказать, за сколько дней
  const partial = r.coveredDays > 0 && r.coveredDays < days - 0.5
  return (
    <div className="flex items-start gap-3 py-2 border-t border-line-soft first:border-t-0" data-usage-item={r.name}>
      <span className="min-w-0 flex-1">
        <Link to={`/stock/i/${encodeURIComponent(r.documentId)}`} className="block text-[13.5px] font-bold text-ink break-words hover:underline">
          {r.name}
          {!r.active && <span className={smallCls}> · archiv</span>}
        </Link>
        <span className={smallCls}>
          {r.location}
          {r.coveredDays === 0 ? ' · spotřeba zatím neznámá (málo přepočtů)' : partial ? ` · spotřeba za ${dny(r.coveredDays)} z ${dny(days)}` : ''}
        </span>
      </span>
      <span className="shrink-0 text-right text-[12.5px] font-semibold text-ink-body leading-snug">
        <span className="block" data-usage-in>
          Přišlo <b className="text-ink">{r.inText}</b>
          {showPrices && r.inValue ? <span className={smallCls}> · {kc(r.inValue)}</span> : null}
        </span>
        <span className="block" data-usage-used>
          Spotřeba <b className="text-ink">{r.usedText}</b>
          {showPrices && r.usedValue ? <span className={smallCls}> · {kc(r.usedValue)}</span> : null}
        </span>
      </span>
    </div>
  )
}

export default function UsageTab({ reloadKey }: { reloadKey: number }) {
  const [month, setMonth] = useState<string | undefined>(undefined)
  const [data, setData] = useState<StockReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fetchStockReport(month)
      .then((r) => alive && setData(r))
      .catch((e) => alive && setError(errMsg(e, 'Nepodařilo se načíst')))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [month, reloadKey])

  if (error) return <div className="text-[12.5px] font-semibold text-neg" data-error>{error}</div>
  if (!data) return <div className={hintCls}>Načítám…</div>

  const showPrices = data.meta.showPrices
  const t = data.totals
  return (
    <div className="flex flex-col gap-3.5" data-usage={data.month}>
      <div className="flex items-center gap-2">
        <button type="button" className={iconBtnCls} disabled={!data.prev || loading} onClick={() => data.prev && setMonth(data.prev)} aria-label="Předchozí měsíc" data-month-prev>
          ‹
        </button>
        <h2 className={`${cardTitleCls} min-w-[130px] text-center first-letter:uppercase`} data-month>
          {monthLabel(data.month)}
        </h2>
        <button type="button" className={iconBtnCls} disabled={!data.next || loading} onClick={() => data.next && setMonth(data.next)} aria-label="Další měsíc" data-month-next>
          ›
        </button>
        {data.current && <span className={smallCls}>zatím {dny(data.days)}</span>}
      </div>

      {showPrices && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" data-usage-money>
          <div className={tileCls}>
            <div className={tileLabelCls}>Nakoupeno (odhad)</div>
            <div className={tileValueCls}>{kc(t.inValue ?? 0)}</div>
            <div className={tileSubCls}>přišlo × cena balení</div>
          </div>
          <div className={tileCls}>
            <div className={tileLabelCls}>Spotřebováno (odhad)</div>
            <div className={tileValueCls}>{kc(t.usedValue ?? 0)}</div>
            <div className={tileSubCls}>spotřeba × cena balení</div>
          </div>
          <div className={tileCls} data-usage-paid>
            <div className={tileLabelCls}>Zaplaceno za objednávky</div>
            <div className={tileValueCls}>{kc(t.paid ?? 0)}</div>
            <div className={tileSubCls}>
              {t.receipts ? `příjmů ${t.receipts}${t.noSum ? `, bez částky ${t.noSum}` : ''}` : 'žádný příjem objednávky'}
            </div>
          </div>
        </div>
      )}
      {showPrices && !!t.unpriced && (
        <div className={hintCls} data-unpriced>
          U {t.unpriced} {t.unpriced === 1 ? 'položky' : 'položek'} chybí cena balení — v odhadu nejsou (doplníte v „Nastavení“).
        </div>
      )}

      {!data.items.length ? (
        <div className={`${cardCls} px-5 py-4 ${hintCls}`} data-usage-empty>
          Za tento měsíc zatím nic.
        </div>
      ) : (
        data.categories.map((c) => (
          <section key={c.key} className={`${cardCls} px-4 py-3`} data-usage-category={c.key}>
            <div className="flex items-baseline gap-2 mb-1">
              <h3 className={`${cardTitleCls} flex-1`}>{c.label}</h3>
              {showPrices && (c.inValue || c.usedValue) ? (
                <span className={smallCls}>
                  přišlo {kc(c.inValue ?? 0)} · spotřeba {kc(c.usedValue ?? 0)}
                </span>
              ) : null}
            </div>
            {data.items
              .filter((r) => r.category === c.key)
              .map((r) => (
                <Row key={r.documentId} r={r} days={data.days} showPrices={showPrices} />
              ))}
          </section>
        ))
      )}

      <div className={hintCls}>
        Spotřeba se počítá z přepočtů: mezi dvěma „Spočítat“ je spotřeba to, co bylo (i s tím, co přišlo), minus co se napočítalo.
        Po posledním přepočtu ještě známá není — proto pravidelná inventura.
        {showPrices && ' Částky v Kč jsou odhad podle poslední ceny balení; skutečně zaplacené je v „Zaplaceno za objednávky“.'}
      </div>
    </div>
  )
}
