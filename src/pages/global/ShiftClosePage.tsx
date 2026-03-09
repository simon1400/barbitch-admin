import { useState } from 'react'
import { Container } from '../../components/Container'
import { OwnerProtection } from './components/OwnerProtection'
import { StatSection } from './components/StatSection'
import { checkShift, publishShift, fetchMonthlyResult, type ShiftCheckResult } from './fetch/shiftClose'
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
  const [profitDelta, setProfitDelta] = useState<{ before: number; after: number } | null>(null)

  const handleCheck = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setPublished(false)
    setPublishError(null)
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
    setPublished(false)
    setProfitDelta(null)
    try {
      const date = new Date(result.date)
      const month = date.getMonth()
      const year = date.getFullYear()

      const before = await fetchMonthlyResult(month, year)
      await publishShift(result.date, Number(cardSum))
      const after = await fetchMonthlyResult(month, year)

      setProfitDelta({ before: before.result, after: after.result })
      setPublished(true)
    } catch (e) {
      console.error(e)
      setPublishError('Chyba při publikaci. Zkuste to znovu.')
    } finally {
      setPublishing(false)
    }
  }

  const overallStatus = result
    ? result.cash.found &&
      result.serviceProvided.found &&
      result.workTime.found &&
      result.comparison.match
    : null

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
              <div
                className={`rounded-xl p-5 mb-6 border ${
                  overallStatus
                    ? 'bg-green-50 border-green-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{overallStatus ? '✅' : '⚠️'}</span>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {overallStatus
                        ? 'Směna vypadá kompletní'
                        : 'Některé záznamy chybí nebo se neshodují'}
                    </p>
                    <p className="text-sm text-gray-600">Datum: {result.date}</p>
                  </div>
                </div>
              </div>

              <ComparisonCard result={result} />

              <StatSection title="Kontrola záznamů" id="checks" defaultOpen>
                <div className="grid gap-4">
                  <CashCard data={result.cash} />
                  <ServiceProvidedCard data={result.serviceProvided} />
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
