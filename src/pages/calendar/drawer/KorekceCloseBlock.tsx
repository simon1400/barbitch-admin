// Блок переноса доли в форме «Uzavřít návštěvu» (s210). Вынесен из
// VisitCloseSection.tsx: тот у порога 600 строк из аудита.
//
// Показывает: у брони-коррекции — поле «Opravená část ceny» и живой расчёт трёх
// строк (или списания с зарплаты в режиме payroll); у исходного визита — что его
// доля уже ушла на коррекцию. Суммы в поля мастера/салона НЕ подставляются
// (правило s142): только подсказка.

import type { VisitCheckoutHint } from '../fetch/engineApi'
import { dec } from '../../../utils/money'
import { csDay, csMonth, korekceAmounts, parseKc, signedKc } from './korekce'

const boxCls = 'mb-2 rounded-lg px-3 py-2 text-xs'
const inputCls =
  'w-28 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 focus:border-primary focus:outline-none dark:border-[#3f3f3d] dark:bg-[#2a2a28] dark:text-gray-300'

export const KorekceCloseBlock = ({
  hint,
  base,
  onBase,
}: {
  hint: VisitCheckoutHint
  base: string
  onBase: (v: string) => void
}) => {
  const k = hint.korekce
  const out = hint.korekceOut

  if (!k) {
    // исходный визит: доля (или её часть) уже ушла на коррекцию
    if (!out || (!out.staffOutKc && !out.salonAdjKc)) return null
    return (
      <div className={`${boxCls} bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200`} data-korekce-out>
        {out.items.map((it) => (
          <div key={it.spDocId}>
            🔁 Podíl převeden na korekci {csDay(it.korekceDate)} ({it.master}): mistr −{dec(it.staffOutKc)} Kč, salon{' '}
            {signedKc(it.salonAdjKc)} Kč
          </div>
        ))}
        <div className="mt-0.5 text-rose-700/80 dark:text-rose-300/80">Nápověda níže už počítá s odečtem.</div>
      </div>
    )
  }

  if (k.status === 'no_link') {
    return (
      <div className={`${boxCls} bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200`} data-korekce-nolink>
        Vyberte původní návštěvu v kartě «Korekce po návštěvě» — bez ní nelze korekci uzavřít.
      </div>
    )
  }
  if (k.status === 'paid') {
    return (
      <div className={`${boxCls} bg-gray-50 text-gray-600 dark:bg-[#252523] dark:text-gray-400`}>
        Placená korekce — podíl se nepřevádí.
      </div>
    )
  }
  if (k.status === 'same_master') {
    return (
      <div className={`${boxCls} bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200`} data-korekce-same>
        🔁 Korekce u stejné mistrové ({csDay(k.original?.date)}) — bez převodu, 0 / 0.
      </div>
    )
  }
  if (k.status !== 'ok' || !k.original) return null

  const b = parseKc(base)
  const valid = b != null && b > 0 && b <= k.remainingBaseKc + 0.005
  const a = korekceAmounts(b || 0, k.rateA || 0, k.rateB || 0)
  const A = k.original.master
  const B = k.master || 'mistrová korekce'

  return (
    <div className={`${boxCls} bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-100`} data-korekce-block>
      <div className="font-semibold">
        🔁 Korekce po návštěvě {csDay(k.original.date)} · {A}
      </div>
      {!k.originalClosed && (
        <div className="mt-1 text-rose-700 dark:text-rose-300" data-korekce-pending>
          Původní návštěva {csDay(k.original.date)} u {A} ještě není uzavřená — podíl se odečte při jejím uzavření.
        </div>
      )}
      <label className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide">Opravená část ceny</span>
        <input
          type="text"
          inputMode="decimal"
          value={base}
          onChange={(e) => onBase(e.target.value)}
          className={inputCls}
          data-korekce-base
        />
        <span className="text-rose-700/80 dark:text-rose-300/80">
          Kč z {dec(k.fullPrice || 0)} · zbývá {dec(k.remainingBaseKc)}
        </span>
      </label>
      {!valid ? (
        <div className="mt-1 text-red-700 dark:text-red-300" data-korekce-invalid>
          Zadejte částku od 0 do {dec(k.remainingBaseKc)} Kč.
        </div>
      ) : (
        <div className="mt-1.5 space-y-0.5" data-korekce-lines>
          {k.mode === 'payroll' ? (
            <>
              <div>
                {B} +{dec(a.staffInKc)} Kč ({k.rateB} %)
              </div>
              <div>
                Odpis ze mzdy {A} −{Math.round(a.staffInKc)} Kč ({csMonth(k.date)}) — původní návštěva je v jiném měsíci
              </div>
            </>
          ) : (
            <>
              <div>
                {A} −{dec(a.staffOutKc)} Kč ({k.rateA} % z {dec(b || 0)})
              </div>
              <div>
                {B} +{dec(a.staffInKc)} Kč ({k.rateB} %)
              </div>
              <div>Salon {signedKc(a.salonAdjKc)} Kč</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
