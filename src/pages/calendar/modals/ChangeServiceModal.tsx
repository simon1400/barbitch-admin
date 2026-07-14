// «Změnit službu» — смена услуги существующей брони (PATCH serviceItems:
// сервер пишет новый снапшот services, пересчитывает цену/длительность и
// перепроверяет пересечения — при конфликте вернёт slot_taken).

import { useEffect, useState } from 'react'
import type { CalendarBooking, CalendarEmployee } from '../fetch/calendarDay'
import type { CatalogService, EnginePatchResult } from '../fetch/engineApi'
import { JUNIOR_DISCOUNT_PERCENT, calcCombo, enginePatchBooking, fetchCatalog } from '../fetch/engineApi'
import {
  EMPTY_SERVICE_SELECTION,
  btnPrimaryCls,
  btnSecondaryCls,
  inputCls,
  labelCls,
  type ServiceSelection,
} from './helpers'
import { ServicePicker } from './ServicePicker'
import { ModalShell, Section } from './ui'

export const ChangeServiceModal = ({
  booking,
  employees,
  onClose,
  onChanged,
}: {
  booking: CalendarBooking
  employees: CalendarEmployee[]
  onClose: () => void
  onChanged: (updated: EnginePatchResult) => void
}) => {
  const [catalog, setCatalog] = useState<CatalogService[]>([])
  const [sel, setSel] = useState<ServiceSelection>(EMPTY_SERVICE_SELECTION)
  const [priceOverride, setPriceOverride] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCatalog()
      .then(setCatalog)
      .catch(() => setError('Nepodařilo se načíst katalog služeb'))
  }, [])

  // tier мастера брони — junior-цена считается как в «Nová rezervace»
  const tier = employees.find((e) => e.id === booking.noonaEmployeeId)?.tier || 'senior'
  const svc = sel.service
  const pricing = svc ? calcCombo(svc, sel.variantLabel || null, sel.modKeys, tier) : null
  const currentTitle = (booking.services || [])
    .map((s) => s.title)
    .filter(Boolean)
    .join(' + ')

  const submit = async () => {
    if (!svc) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await enginePatchBooking(booking.documentId, {
        serviceItems: [{ service: svc.documentId, variant: sel.variantLabel || null, modifiers: sel.modKeys }],
        ...(priceOverride.trim() ? { totalPrice: Number(priceOverride) } : {}),
      })
      onChanged(res)
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      title="Změnit službu"
      onClose={onClose}
      footer={
        <>
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={btnSecondaryCls}>
              Zrušit
            </button>
            <button
              type="button"
              disabled={!svc || submitting}
              onClick={submit}
              className={`${btnPrimaryCls} flex-1 sm:flex-none`}
            >
              {submitting ? 'Ukládám…' : 'Změnit službu'}
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
          Nyní: <b>{currentTitle || '—'}</b>
          {booking.totalPrice != null && <span className="text-gray-400"> · {booking.totalPrice} Kč</span>}
        </div>

        <Section title="Nová služba">
          <ServicePicker catalog={catalog} sel={sel} onChange={setSel} />
        </Section>

        {pricing && (
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="text-sm text-gray-600">
              {pricing.durationMin} min
              {tier === 'junior' && (
                <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                  junior −{JUNIOR_DISCOUNT_PERCENT} %
                </span>
              )}
            </span>
            <span className="flex items-baseline gap-2">
              {tier === 'junior' && pricing.seniorPrice !== pricing.price && (
                <span className="text-xs text-gray-400 line-through">{pricing.seniorPrice} Kč</span>
              )}
              <span className="text-base font-bold text-primary">{pricing.price} Kč</span>
            </span>
          </div>
        )}

        <div>
          <span className={labelCls}>Cena ručně (Kč)</span>
          <input
            className={inputCls}
            placeholder={pricing ? String(pricing.price) : ''}
            value={priceOverride}
            onChange={(e) => setPriceOverride(e.target.value)}
          />
          <p className="mt-0.5 text-[11px] text-gray-400">Prázdné → cena se přepočítá automaticky.</p>
        </div>

      </div>
    </ModalShell>
  )
}
