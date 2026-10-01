import { useCallback, useEffect, useRef, useState } from 'react'
import { fmtCsDate } from '../../../utils/date'
import { kc } from '../../../utils/money'
import { btnNeutralCls, btnPinkCls, hintCls, mutedCls, pillCls } from '../../../ui/kit'
import { StatSection } from '../components/StatSection'
import { fetchCashCheck, skipCashRow, unskipCashRow, type CashCheck as CashCheckData, type CashOutflow } from '../fetch/expenses'

const rowCls = 'flex items-center gap-3 flex-wrap py-2.5 border-t border-line-soft first:border-t-0'

/** «Внести затрату» из строки кассы — что подставить в форму. */
export interface CashPrefill {
  date: string
  sum: number
  name: string
}

// Сверка с кассой (s238, Фаза 3): расходы кассы (покупки из кассы при закрытии смены)
// без затраты той же суммы ±1 день. Каждую строку — либо внести затратой, либо
// пометить «это не затрата» (изъятие владельцем, размен). Пометку может снять любой
// из руководства. Отдельно — затраты с оплатой «из кассы», которых в кассе нет.
//
// Перечитывается, когда страница перечитала месяц (`ym` + `token`): внесли затрату
// из строки — она пропадает из списка.
export function CashCheck({
  ym,
  token,
  onCreateCost,
  onOpenCost,
}: {
  /** загруженный месяц ГГГГ-ММ; '' — ещё не загружен */
  ym: string
  token: number
  onCreateCost: (p: CashPrefill) => void
  onOpenCost: (documentId: string) => void
}) {
  const [data, setData] = useState<CashCheckData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showSkipped, setShowSkipped] = useState(false)
  const seq = useRef(0)

  const load = useCallback((key: string) => {
    const my = ++seq.current
    const [y, m] = key.split('-').map(Number)
    fetchCashCheck(m - 1, y)
      .then((res) => {
        if (my !== seq.current) return
        setData(res)
        setError(null)
      })
      .catch((e: Error) => {
        if (my !== seq.current) return
        setData(null)
        setError(e.message)
      })
  }, [])

  useEffect(() => {
    if (!ym) return
    load(ym)
  }, [ym, token, load])

  useEffect(() => {
    setShowSkipped(false)
  }, [ym])

  const act = async (id: string, fn: () => Promise<void>) => {
    setBusy(id)
    setError(null)
    try {
      await fn()
      load(ym)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const prefillOf = (f: CashOutflow): CashPrefill => ({
    date: f.date,
    sum: f.sum,
    name: (f.comment ?? '').slice(0, 120),
  })

  if (!ym) return null

  return (
    <StatSection title={'Сверка с кассой'} id={'cash-check'} count={data?.unmatched.length} defaultOpen={false}>
      {error && (
        <div role="alert" className="mb-3 text-[12.5px] font-semibold text-neg">
          {error}
        </div>
      )}
      {!data ? (
        !error && <div className={mutedCls}>Загрузка…</div>
      ) : data.cashDays === 0 ? (
        <div className={hintCls}>За этот месяц касса ещё не закрывалась — сверять не с чем.</div>
      ) : (
        <>
          <p className={`${hintCls} mt-0 mb-3`}>
            Расходы кассы при закрытии смены сверяются с затратами той же суммы (±1 день) с оплатой «Hotovost z
            kasy» или без оплаты. Сверено: {data.matched}.
          </p>

          {data.unmatched.length === 0 ? (
            <div className="text-[13px] font-semibold text-pos" data-testid="cash-all-matched">
              Все расходы кассы есть в затратах.
            </div>
          ) : (
            <div data-testid="cash-unmatched">
              <div className="text-[13px] font-extrabold text-ink mb-1">Из кассы ушло, а затраты нет</div>
              {data.unmatched.map((f) => (
                <div key={f.key} className={rowCls} data-cash={f.key}>
                  <span className="text-[13px] font-semibold text-ink-soft whitespace-nowrap w-[84px]">{fmtCsDate(f.date)}</span>
                  <span className="text-[14px] font-extrabold text-neg whitespace-nowrap">−{kc(f.sum)}</span>
                  <span className="text-[13.5px] font-semibold text-ink min-w-0 flex-1">
                    {f.comment ?? <span className={mutedCls}>без комментария</span>}
                  </span>
                  <span className="flex gap-2 flex-wrap">
                    <button type="button" className={btnPinkCls} disabled={busy !== null} onClick={() => onCreateCost(prefillOf(f))}>
                      Внести затрату
                    </button>
                    <button
                      type="button"
                      className={btnNeutralCls}
                      disabled={busy !== null}
                      onClick={() => act(f.key, () => skipCashRow(f.key))}
                    >
                      {busy === f.key ? 'Сохраняю…' : 'Это не затрата'}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {data.cashCostsWithoutRow.length > 0 && (
            <div className="mt-4" data-testid="cash-costs-without-row">
              <div className="text-[13px] font-extrabold text-ink mb-1">
                Затраты «из кассы», которых нет в кассе ({data.cashCostsWithoutRow.length})
              </div>
              <div className={`${hintCls} mb-1`}>
                Возможно, оплата выбрана не та или покупку забыли записать при закрытии смены.
              </div>
              {data.cashCostsWithoutRow.map((c) => (
                <div key={c.documentId} className={rowCls}>
                  <span className="text-[13px] font-semibold text-ink-soft whitespace-nowrap w-[84px]">{fmtCsDate(c.date)}</span>
                  <span className="text-[14px] font-extrabold text-ink whitespace-nowrap">{kc(c.sum)}</span>
                  <span className="text-[13.5px] font-semibold text-ink min-w-0 flex-1">{c.name}</span>
                  <button type="button" className={btnNeutralCls} onClick={() => onOpenCost(c.documentId)}>
                    Открыть
                  </button>
                </div>
              ))}
            </div>
          )}

          {data.skipped.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                className={pillCls(showSkipped)}
                aria-pressed={showSkipped}
                onClick={() => setShowSkipped((v) => !v)}
              >
                Помечено «не затрата» ({data.skipped.length})
              </button>
              {showSkipped && (
                <div className="mt-2" data-testid="cash-skipped">
                  {data.skipped.map((f) => (
                    <div key={f.key} className={rowCls} data-skip={f.skipId}>
                      <span className="text-[13px] font-semibold text-ink-soft whitespace-nowrap w-[84px]">
                        {fmtCsDate(f.date)}
                      </span>
                      <span className="text-[14px] font-bold text-ink-soft whitespace-nowrap">−{kc(f.sum)}</span>
                      <span className="text-[13.5px] font-semibold text-ink-soft min-w-0 flex-1">
                        {f.comment ?? 'без комментария'}
                        {f.markedBy && <span className={`${mutedCls} ml-2`}>пометил(а): {f.markedBy}</span>}
                      </span>
                      <button
                        type="button"
                        className={btnNeutralCls}
                        disabled={busy !== null}
                        onClick={() => act(f.skipId, () => unskipCashRow(f.skipId))}
                      >
                        {busy === f.skipId ? 'Сохраняю…' : 'Вернуть в сверку'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </StatSection>
  )
}
