// «Kontrola směny» (s266, Фаза 3 плана «Směna»): порт виджета дашборда панели Strapi в модуль. Расчёт
// тот же — `shift-selfcheck.runSelfCheck` на сервере (`GET /engine/admin/smena/:date/check`), здесь
// только показ: нет кассы/часов/услуг, клиенты в календаре без записи, запись без брони (опечатка),
// услуга ≠ календарь, платежи с неверной суммой (Δ Kč). Только чтение. Перечитывается кнопкой
// обновления страницы и после сохранения кассы/часов (`reloadKey`) — своей кнопки нет.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { badgeNegCls, badgeWarnCls, cardPadCls, cardTitleCls, hintCls, mutedCls } from '../../../ui/kit'
import { fetchSmenaCheck, fmtKc, type SmenaCheck } from '../fetch/smena'

const sectionTitleCls = 'text-[12.5px] font-extrabold text-ink-body mt-3 mb-1'

/** « (+120 Kč)» / « (−80 Kč)»; 0 и нет — пусто. */
const fmtDelta = (n: number | null): string => (n == null || n === 0 ? '' : ` (${n > 0 ? '+' : ''}${fmtKc(n)})`)

/** Сводка проблем по видам — как баннер виджета панели. */
const checkSummary = (c: SmenaCheck): string[] => {
  const out: string[] = []
  if (c.missing.services) out.push('Provedené služby: chybí')
  if (c.missing.cash) out.push('Pokladna: chybí')
  if (c.missing.workTime) out.push('Pracovní doba: chybí')
  if (c.calendarOnly.length) out.push(`Nezapsaní klienti: ${c.calendarOnly.length}`)
  if (c.strapiOnly.length) out.push(`Záznam navíc / překlep: ${c.strapiOnly.length}`)
  if (c.serviceMismatch.length) out.push(`Služba ≠ kalendář: ${c.serviceMismatch.length}`)
  if (c.flagged.length) out.push(`Špatně zadané platby: ${c.flagged.length}`)
  return out
}

export function KontrolaCard({ date, reloadKey }: { date: string; reloadKey: number }) {
  const [data, setData] = useState<SmenaCheck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)

  useEffect(() => {
    const my = ++seq.current
    setLoading(true)
    fetchSmenaCheck(date)
      .then((res) => {
        if (my !== seq.current) return
        setData(res)
        setError(null)
      })
      .catch((e) => {
        if (my !== seq.current) return
        setError((e as Error).message)
        setData(null)
      })
      .finally(() => {
        if (my === seq.current) setLoading(false)
      })
  }, [date, reloadKey])

  // ответ другого дня не показываем, пока грузится новый
  const shown = data && data.date === date ? data : null
  const summary = shown ? checkSummary(shown) : []

  return (
    <section className={cardPadCls} data-card="kontrola" data-testid="smena-kontrola">
      <h2 className={`${cardTitleCls} mb-2`}>Kontrola směny</h2>
      {!shown ? (
        error ? (
          <div className="text-[13px] font-semibold text-neg" data-check-error>
            Kontrolu se nepodařilo načíst: {error}
          </div>
        ) : (
          <div className={mutedCls}>{loading ? 'Kontroluji směnu…' : '—'}</div>
        )
      ) : shown.ok ? (
        <div className="text-[14px] font-extrabold text-pos" data-check-ok>
          ✓ Vše v pořádku — směna sedí
        </div>
      ) : (
        <div data-check-problems={shown.problemCount}>
          <div className="text-[14px] font-extrabold text-neg">Najděte a opravte ({shown.problemCount}):</div>
          <ul className="m-0 mt-1 pl-4 text-[13px] font-semibold text-neg">
            {summary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>

          {shown.calendarOnly.length > 0 && (
            <div data-check="calendarOnly">
              <div className={sectionTitleCls}>Nezapsaní klienti ({shown.calendarOnly.length})</div>
              <div className={hintCls}>
                Jsou v kalendáři, ale návštěva není uzavřená —{' '}
                <Link to={`/calendar?date=${date}`} className="font-bold text-brand-dark">
                  uzavřete v kalendáři
                </Link>
                .
              </div>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {shown.calendarOnly.map((n, i) => (
                  <span key={`${n}-${i}`} className={badgeNegCls}>
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}

          {shown.strapiOnly.length > 0 && (
            <div data-check="strapiOnly">
              <div className={sectionTitleCls}>Záznam navíc / překlep ({shown.strapiOnly.length})</div>
              <div className={hintCls}>V záznamech je, v kalendáři ne — překlep jména nebo záznam navíc.</div>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {shown.strapiOnly.map((n, i) => (
                  <span key={`${n}-${i}`} className={badgeWarnCls}>
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}

          {shown.serviceMismatch.length > 0 && (
            <div data-check="serviceMismatch">
              <div className={sectionTitleCls}>Služba ≠ kalendář ({shown.serviceMismatch.length})</div>
              {shown.serviceMismatch.map((m, i) => (
                <div key={`${m.client}-${i}`} className="text-[13px]">
                  <b className="text-ink">{m.client}</b> <span className="text-ink-muted">— záznam: {m.strapi} / kalendář: {m.calendar}</span>
                </div>
              ))}
            </div>
          )}

          {shown.flagged.length > 0 && (
            <div data-check="flagged">
              <div className={sectionTitleCls}>Špatně zadané platby ({shown.flagged.length})</div>
              <div className={hintCls}>Částky neodpovídají ceníku a procentu mistra.</div>
              {shown.flagged.map((f, i) => {
                const ztrata = f.flags.some((x) => x.label.includes('Ztráta'))
                const delta = ztrata ? f.salonDelta : (f.staffDelta ?? f.salonDelta)
                return (
                  <div key={`${f.client}-${i}`} className="text-[13px]">
                    <b className="text-ink">{f.client}</b>{' '}
                    <span className="text-ink-muted">
                      — {f.master}: {f.flags.map((x) => `${x.emoji} ${x.label}`).join(', ')}
                      {fmtDelta(delta)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      {shown && !shown.calendarAvailable && <div className={`${mutedCls} mt-2`}>Kontrola kalendáře nedostupná.</div>}
    </section>
  )
}
