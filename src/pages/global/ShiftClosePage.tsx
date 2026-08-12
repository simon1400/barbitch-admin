import { useState } from 'react'
import {
  btnPinkCls,
  h1Cls,
  inputBaseCls,
  kickerCls,
  labelCls,
  pageShellCls,
  toolbarCardCls,
} from '../../ui/kit'
import { OwnerProtection } from './components/OwnerProtection'
import { StatSection } from './components/StatSection'
import {
  checkShift,
  publishShift,
  revertShift,
  fetchMonthlyResult,
  previewShiftResult,
  getMonthlyCardProfit,
  FLAG_META,
  VERIFY_FLAGS,
  type ShiftCheckResult,
  type PublishFailure,
  type RevertResult,
  type ShiftDelta,
} from './fetch/shiftClose'
import {
  ComparisonCard,
  ServiceProvidedCard,
  CashCard,
  WorkTimeCard,
  PayrollCard,
  PublishSection,
} from './components/shiftClose'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

export default function ShiftClosePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [result, setResult] = useState<ShiftCheckResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [cardSum, setCardSum] = useState('')
  const [extraIncome, setExtraIncome] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishFailures, setPublishFailures] = useState<PublishFailure[]>([])
  const [profitDelta, setProfitDelta] = useState<{
    before: number
    after: number
    diffBefore: number
    diffAfter: number
  } | null>(null)

  const [reverting, setReverting] = useState(false)
  const [revertResult, setRevertResult] = useState<RevertResult | null>(null)
  const [revertError, setRevertError] = useState<string | null>(null)

  const [previewing, setPreviewing] = useState(false)
  const [previewDelta, setPreviewDelta] = useState<ShiftDelta | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const handleCheck = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setPublished(false)
    setPublishError(null)
    setPublishFailures([])
    setProfitDelta(null)
    setRevertResult(null)
    setRevertError(null)
    setPreviewDelta(null)
    setPreviewError(null)
    try {
      const data = await checkShift(selectedDate)
      setResult(data)
      // Pre-fill the optional "Extra příjem" with the value already saved for the month,
      // so it isn't overwritten with 0 — the owner edits it only if needed.
      const cp = await getMonthlyCardProfit(data.date)
      setExtraIncome(cp && cp.extraIncome ? String(cp.extraIncome) : '')
    } catch (e) {
      console.error(e)
      setError('Chyba při kontrole směny. Zkuste to znovu.')
    } finally {
      setLoading(false)
    }
  }

  const handleRevert = async () => {
    if (!result) return
    const ok = window.confirm(
      'Vrátit uzavření směny?\n\nVšechny publikované záznamy tohoto dne se vrátí do konceptu ' +
        '(data zůstanou, nic se nesmaže). Poté je můžete upravit ve Strapi a směnu znovu uzavřít.',
    )
    if (!ok) return

    setReverting(true)
    setRevertError(null)
    setRevertResult(null)
    try {
      const r = await revertShift(result.date)
      setRevertResult(r)
      // Records are drafts again — reset publish state and refresh the check.
      setPublished(false)
      setProfitDelta(null)
      setPublishFailures([])
      setPublishError(null)
      const data = await checkShift(selectedDate)
      setResult(data)
      // Card-profit was zeroed by the revert — reflect that in the pre-filled field.
      const cp = await getMonthlyCardProfit(data.date)
      setExtraIncome(cp && cp.extraIncome ? String(cp.extraIncome) : '')
    } catch (e) {
      console.error(e)
      setRevertError('Chyba při vrácení uzavření. Zkuste to znovu.')
    } finally {
      setReverting(false)
    }
  }

  const handlePreview = async () => {
    if (!result) return
    setPreviewing(true)
    setPreviewError(null)
    setPreviewDelta(null)
    try {
      const d = await previewShiftResult(
        result.date,
        Number(cardSum) || 0,
        Number(extraIncome) || 0,
      )
      setPreviewDelta(d)
    } catch (e) {
      console.error(e)
      setPreviewError('Chyba při výpočtu náhledu. Zkuste to znovu.')
    } finally {
      setPreviewing(false)
    }
  }

  const handlePublishShift = async () => {
    if (!cardSum || isNaN(Number(cardSum)) || Number(cardSum) <= 0) {
      setPublishError('Nejdříve zadejte částku na kartu')
      return
    }
    if (!result) return

    setPublishing(true)
    setPublishError(null)
    setPublishFailures([])
    setPublished(false)
    setProfitDelta(null)
    setPreviewDelta(null)
    setPreviewError(null)
    try {
      const date = new Date(result.date)
      const month = date.getMonth()
      const year = date.getFullYear()

      const before = await fetchMonthlyResult(month, year)
      const { failures } = await publishShift(result.date, Number(cardSum), Number(extraIncome) || 0)
      const after = await fetchMonthlyResult(month, year)

      setProfitDelta({
        before: before.result,
        after: after.result,
        diffBefore: before.difference,
        diffAfter: after.difference,
      })

      if (failures.length > 0) {
        setPublishFailures(failures)
        setPublishError(
          `Některé záznamy (${failures.length}) se nepodařilo publikovat — opravte je ve Strapi a zkuste znovu.`,
        )
        // NOT marking as published — user must fix the records first
      } else {
        setPublished(true)
      }
    } catch (e) {
      console.error(e)
      setPublishError('Chyba při publikaci. Zkuste to znovu.')
    } finally {
      setPublishing(false)
    }
  }

  // 'ok' = vše v pořádku, 'warn' = chybí záznam / nesoulad / žluté/fialové flagy, 'error' = 🟥 ztráta
  type OverallLevel = 'ok' | 'warn' | 'error'
  const overall: OverallLevel | null = result
    ? (() => {
        const fc = result.serviceProvided.flagCounts
        // Highest severity flag in any record wins
        let topSeverity: 0 | 1 | 2 = 0
        for (const f of VERIFY_FLAGS) {
          if (fc[f] > 0 && FLAG_META[f].severity > topSeverity) {
            topSeverity = FLAG_META[f].severity
          }
        }
        if (topSeverity === 2) return 'error'
        const baseOk =
          result.cash.found &&
          result.serviceProvided.found &&
          result.workTime.found &&
          result.comparison.match
        if (!baseOk) return 'warn'
        if (topSeverity === 1) return 'warn'
        if (result.serviceProvided.unverified > 0) return 'warn'
        return 'ok'
      })()
    : null

  const overallMessages: Record<OverallLevel, string> = {
    ok: 'Směna vypadá kompletní',
    warn: 'Některé záznamy chybí, neshodují se nebo vyžadují kontrolu',
    error: 'Pozor: některé služby mají chyby v platbách (🟥 ztráta)',
  }

  const overallStyles: Record<OverallLevel, { bg: string; icon: string }> = {
    ok: { bg: 'bg-pos-bg border-pos-line', icon: '✅' },
    warn: { bg: 'bg-warn-bg border-warn-line', icon: '⚠️' },
    error: { bg: 'bg-neg-bg border-neg-line', icon: '🟥' },
  }

  return (
    <OwnerProtection>
      <div className={pageShellCls}>
        <div className={kickerCls}>Barbitch Admin</div>
        <h1 className={h1Cls}>Uzavření směny</h1>

        {/* Тулбар: дата смены + запуск проверки */}
        <div className={toolbarCardCls}>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className={labelCls}>Datum</label>
              <DatePicker
                selected={selectedDate}
                onChange={(date: Date | null) => date && setSelectedDate(date)}
                dateFormat="dd.MM.yyyy"
                className={`${inputBaseCls} rounded-lg px-3 py-[9px] text-[14px] w-[140px]`}
                maxDate={new Date()}
              />
            </div>
            <button type="button" onClick={handleCheck} disabled={loading} className={btnPinkCls}>
              {loading ? 'Kontroluji...' : 'Zkontrolovat'}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-neg-bg text-neg text-[13px] font-semibold px-4 py-2.5 mb-3.5">
            {error}
          </div>
        )}

        {loading && (
          <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">
            Kontroluji…
          </div>
        )}

        {result && !loading && (
          <>
            {/* Overall status */}
            {overall && (
              <div className={`rounded-xl px-5 py-4 mb-3.5 border ${overallStyles[overall].bg}`}>
                <div className="flex items-start gap-3">
                  <span className="text-[20px] leading-none mt-0.5">
                    {overallStyles[overall].icon}
                  </span>
                  <div className="flex-1">
                    <p className="m-0 text-[14px] font-extrabold text-ink">
                      {overallMessages[overall]}
                    </p>
                    <p className="m-0 mt-0.5 text-[12.5px] font-semibold text-ink-faint">
                      Datum: {result.date}
                    </p>
                    {(() => {
                      const fc = result.serviceProvided.flagCounts
                      const visible = VERIFY_FLAGS.filter(
                        (f) => f !== 'ok' && f !== 'sleva' && fc[f] > 0,
                      )
                      const hasUnverified = result.serviceProvided.unverified > 0
                      if (visible.length === 0 && !hasUnverified) return null
                      return (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {visible.map((f) => (
                            <span
                              key={f}
                              className="text-[11px] font-bold rounded-md px-[7px] py-0.5 bg-white text-ink-body"
                            >
                              {FLAG_META[f].emoji} {FLAG_META[f].label}: {fc[f]}
                            </span>
                          ))}
                          {hasUnverified && (
                            <span className="text-[11px] font-bold rounded-md px-[7px] py-0.5 bg-white text-ink-body">
                              Neověřeno: {result.serviceProvided.unverified}
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            )}

            <ComparisonCard result={result} />

            <StatSection title="Kontrola záznamů" id="checks" defaultOpen>
              <div className="grid gap-3.5">
                <CashCard data={result.cash} />
                {/* Отдельная таблица «Rezervace v kalendáři» убрана: записи закрываются
                    прямо в календаре → услуга/čas/cena брони видны в тултипе чипа ⇄,
                    а брони БЕЗ записи показывает ComparisonCard («Pouze v kalendáři»). */}
                <ServiceProvidedCard
                  data={result.serviceProvided}
                  calendarBookings={result.calendar.events}
                />
                <WorkTimeCard data={result.workTime} />
                <PayrollCard data={result.payroll} />
              </div>
            </StatSection>

            <PublishSection
              cardSum={cardSum}
              setCardSum={setCardSum}
              extraIncome={extraIncome}
              setExtraIncome={setExtraIncome}
              publishing={publishing}
              published={published}
              publishError={publishError}
              publishFailures={publishFailures}
              profitDelta={profitDelta}
              onPublish={handlePublishShift}
              reverting={reverting}
              revertResult={revertResult}
              revertError={revertError}
              onRevert={handleRevert}
              previewing={previewing}
              previewDelta={previewDelta}
              previewError={previewError}
              onPreview={handlePreview}
            />
          </>
        )}
      </div>
    </OwnerProtection>
  )
}
