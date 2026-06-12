import { useState } from 'react'
import { Container } from '../../components/Container'
import { OwnerProtection } from './components/OwnerProtection'
import { StatSection } from './components/StatSection'
import {
  checkShift,
  publishShift,
  fetchMonthlyResult,
  FLAG_META,
  VERIFY_FLAGS,
  type ShiftCheckResult,
  type PublishFailure,
} from './fetch/shiftClose'
import {
  ComparisonCard,
  ServiceProvidedCard,
  NoonaEventsCard,
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

  const handleCheck = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setPublished(false)
    setPublishError(null)
    setPublishFailures([])
    setProfitDelta(null)
    try {
      const data = await checkShift(selectedDate)
      setResult(data)
    } catch (e) {
      console.error(e)
      setError('Chyba při kontrole směny. Zkuste to znovu.')
    } finally {
      setLoading(false)
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
    try {
      const date = new Date(result.date)
      const month = date.getMonth()
      const year = date.getFullYear()

      const before = await fetchMonthlyResult(month, year)
      const { failures } = await publishShift(result.date, Number(cardSum))
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
    ok: { bg: 'bg-green-50 border-green-200', icon: '✅' },
    warn: { bg: 'bg-yellow-50 border-yellow-200', icon: '⚠️' },
    error: { bg: 'bg-red-50 border-red-200', icon: '🟥' },
  }

  return (
    <OwnerProtection>
      <section className="pb-20 min-h-screen">
        <Container size="lg">
          {/* Header + date picker */}
          <div className="mt-8 mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">
              Uzavření směny
            </h1>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Datum</label>
                <DatePicker
                  selected={selectedDate}
                  onChange={(date: Date | null) => date && setSelectedDate(date)}
                  dateFormat="dd.MM.yyyy"
                  className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  maxDate={new Date()}
                />
              </div>
              <button
                type="button"
                onClick={handleCheck}
                disabled={loading}
                className="px-6 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Kontroluji...' : 'Zkontrolovat'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
          )}

          {result && !loading && (
            <>
              {/* Overall status */}
              {overall && (
                <div className={`rounded-xl p-5 mb-6 border ${overallStyles[overall].bg}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{overallStyles[overall].icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{overallMessages[overall]}</p>
                      <p className="text-sm text-gray-600">Datum: {result.date}</p>
                      {(() => {
                        const fc = result.serviceProvided.flagCounts
                        const visible = VERIFY_FLAGS.filter(
                          (f) => f !== 'ok' && f !== 'sleva' && fc[f] > 0,
                        )
                        const hasUnverified = result.serviceProvided.unverified > 0
                        if (visible.length === 0 && !hasUnverified) return null
                        return (
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-700">
                            {visible.map((f) => (
                              <span key={f}>
                                {FLAG_META[f].emoji} {FLAG_META[f].label}: <b>{fc[f]}</b>
                              </span>
                            ))}
                            {hasUnverified && (
                              <span>Neověřeno: <b>{result.serviceProvided.unverified}</b></span>
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
                <div className="grid gap-4">
                  <CashCard data={result.cash} />
                  <ServiceProvidedCard data={result.serviceProvided} noonaEvents={result.noona.events} />
                  <NoonaEventsCard data={result.noona} />
                  <WorkTimeCard data={result.workTime} />
                  <PayrollCard data={result.payroll} />
                </div>
              </StatSection>

              <PublishSection
                cardSum={cardSum}
                setCardSum={setCardSum}
                publishing={publishing}
                published={published}
                publishError={publishError}
                publishFailures={publishFailures}
                profitDelta={profitDelta}
                onPublish={handlePublishShift}
              />
            </>
          )}
        </Container>
      </section>
    </OwnerProtection>
  )
}
