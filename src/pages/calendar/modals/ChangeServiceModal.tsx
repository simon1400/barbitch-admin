// «Změnit službu» — смена услуги существующей брони (PATCH serviceItems:
// сервер пишет новый снапшот services, пересчитывает цену/длительность и
// перепроверяет пересечения — при конфликте вернёт slot_taken).
//
// Уже применённую скидку (bitchcard / −15 % за дозапис) движок пересчитывает от
// новой суммы (s174) — здесь показываем итог заранее, чтобы админ видел, сколько
// клиент реально заплатит. Ручная цена в поле «Cena ručně» скидку отменяет.

import { useEffect, useState } from 'react'
import type { CalendarBooking, CalendarEmployee } from '../fetch/calendarDay'
import type { BookingRedemption, CatalogService, EnginePatchResult } from '../fetch/engineApi'
import {
  JUNIOR_DISCOUNT_PERCENT,
  calcCombo,
  enginePatchBooking,
  fetchBookingRedemptions,
  fetchCatalog,
} from '../fetch/engineApi'
import {
  EMPTY_SERVICE_SELECTION,
  btnPrimaryCls,
  btnSecondaryCls,
  inputCls,
  labelCls,
  previewDiscountReprice,
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

  // применённая награда bitchcard (свой fetch — в брони лежит только сумма
  // redemptionKc, а для пересчёта нужен тип награды). Сбой → просто нет подсказки.
  const [usedRedemption, setUsedRedemption] = useState<BookingRedemption | null>(null)
  useEffect(() => {
    let alive = true
    fetchBookingRedemptions(booking.documentId)
      .then((res) => {
        if (!alive) return
        const rows = res.enabled ? res.redemptions : []
        setUsedRedemption(
          rows.find((r) => r.status === 'used' && r.usedInBookingDocId === booking.documentId) || null,
        )
      })
      .catch(() => setUsedRedemption(null))
    return () => {
      alive = false
    }
  }, [booking.documentId])

  // tier мастера брони — junior-цена считается как в «Nová rezervace»
  const tier = employees.find((e) => e.id === booking.noonaEmployeeId)?.tier || 'senior'
  const svc = sel.service
  const pricing = svc ? calcCombo(svc, sel.variantLabel || null, sel.modKeys, tier) : null
  const currentTitle = (booking.services || [])
    .map((s) => s.title)
    .filter(Boolean)
    .join(' + ')
  // ручная цена побеждает пересчёт (и скидку) — сервер берёт её как итог
  const manualPrice = priceOverride.trim() !== ''
  const rd = booking.discount
  const hasDiscount = !!usedRedemption || !!(rd && rd.type === 'rebook' && rd.applied)
  const discount =
    pricing && !manualPrice ? previewDiscountReprice(booking, usedRedemption, pricing.price) : null

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
          {error && <p className="mb-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
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
        <div className="rounded-md bg-gray-50 dark:bg-[#2a2a28] px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
          Nyní: <b>{currentTitle || '—'}</b>
          {booking.totalPrice != null && <span className="text-gray-400 dark:text-gray-500"> · {booking.totalPrice} Kč</span>}
        </div>

        <Section title="Nová služba">
          <ServicePicker catalog={catalog} sel={sel} onChange={setSel} />
        </Section>

        {pricing && (
          <div className="flex items-center justify-between rounded-lg border border-[#e71e6e33] bg-[#e71e6e0d] px-3 py-2">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {pricing.durationMin} min
              {tier === 'junior' && (
                <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                  junior −{JUNIOR_DISCOUNT_PERCENT} %
                </span>
              )}
            </span>
            <span className="flex items-baseline gap-2">
              {tier === 'junior' && pricing.seniorPrice !== pricing.price && (
                <span className="text-xs text-gray-400 dark:text-gray-500 line-through">{pricing.seniorPrice} Kč</span>
              )}
              <span className="text-base font-bold text-primary">{pricing.price} Kč</span>
            </span>
          </div>
        )}

        {discount && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-500/40 dark:bg-emerald-500/10">
            <div className="text-emerald-800 dark:text-emerald-200">
              Na rezervaci je <b>{discount.label}</b> — sleva se přepočítá z nové ceny:
            </div>
            <div className="mt-0.5 flex items-baseline gap-2 text-emerald-900 dark:text-emerald-100">
              <span className="text-xs line-through opacity-60">{pricing?.price} Kč</span>
              <b className="text-base">{discount.totalPrice} Kč</b>
              <span className="text-xs">(−{discount.discountKc} Kč)</span>
            </div>
          </div>
        )}

        {manualPrice && hasDiscount && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            Ruční cena přepíše slevu na rezervaci — zadejte částku už po slevě.
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
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">Prázdné → cena se přepočítá automaticky.</p>
        </div>

      </div>
    </ModalShell>
  )
}
