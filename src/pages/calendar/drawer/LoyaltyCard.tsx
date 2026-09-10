// Карточка bitchcard в шторке брони: награды клиента и применение кода.
// Вынесено из calendar/BookingDrawer.tsx ДОСЛОВНО (этап 6 аудита).

import { kcNum } from '../../../utils/money'
import type { CalendarBooking } from '../fetch/calendarDay'
import { fetchBookingRedemptions } from '../fetch/engineApi'
import type { BookingRedemption, LoyaltyProgress } from '../fetch/engineApi'
import { useEffect, useState } from 'react'

const redemptionRewardLabel = (r: BookingRedemption) =>
  `${r.reward.title} (od ${kcNum(r.reward.thresholdKc)} Kč)`

// Карточка «Bitchcard» в drawer (walk-in флоу К4): награды available у клиента
// брони + применённая к этой брони. Свой fetch (паттерн ClientHistory); рефетч
// по totalPrice — после apply/release CalendarPage обновляет selected и данные
// перезагружаются. Программа выключена (enabled:false) / нет наград → карточки нет.
export const LoyaltyCard = ({
  b,
  busy,
  onApply,
  onRelease,
  onUsedChange,
}: {
  b: CalendarBooking
  busy: boolean
  onApply: (code: string) => void
  onRelease: () => void
  onUsedChange: (used: boolean) => void
}) => {
  const [redemptions, setRedemptions] = useState<BookingRedemption[] | null>(null)
  const [progress, setProgress] = useState<LoyaltyProgress | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchBookingRedemptions(b.documentId)
      .then((res) => {
        if (cancelled) return
        const rows = res.enabled ? res.redemptions : []
        setRedemptions(rows)
        setProgress(res.enabled ? res.progress || null : null)
        // наверх — чтобы карточка «Sleva za dozápis» знала, что скидка bitchcard
        // уже применена (одна скидка на услугу → «Vrátit slevu» прячем)
        onUsedChange(
          rows.some((r) => r.status === 'used' && r.usedInBookingDocId === b.documentId),
        )
      })
      .catch(() => {
        if (cancelled) return
        setRedemptions([])
        setProgress(null)
        onUsedChange(false)
      })
    return () => {
      cancelled = true
    }
    // onUsedChange стабилен (useCallback в drawer) — рефетч только по брони/цене
  }, [b.documentId, b.totalPrice, onUsedChange])

  const used = (redemptions || []).find(
    (r) => r.status === 'used' && r.usedInBookingDocId === b.documentId,
  )
  const available = (redemptions || []).filter((r) => r.status === 'available')
  // Правило салона: одна скидка на услугу. При применённой скидке за дозапис
  // награды показываем, но применить их нельзя (сервер тоже вернёт 409).
  const rd = b.discount
  const rebookApplied = !!rd && rd.type === 'rebook' && !!rd.applied
  if (!used && available.length === 0 && !progress) return null

  // Рендерится ВНУТРИ главной карты брони (под ценой) — без своей рамки-карточки
  return (
    <div className="mt-2.5">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Bitchcard — věrnostní program
      </div>
      {progress && (
        <div className="mb-1.5 text-xs text-gray-600 dark:text-gray-400">
          Letos utraceno:{' '}
          <b className="text-gray-800 dark:text-gray-200">
            {kcNum(progress.balanceKc)} Kč
          </b>
          {progress.nextReward ? (
            <>
              {' · do „'}
              {progress.nextReward.title}
              {'“ zbývá '}
              <b className="text-primary">
                {kcNum(progress.nextReward.remainingKc)} Kč
              </b>
            </>
          ) : (
            <> · dosaženy všechny odměny</>
          )}
        </div>
      )}
      {used && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-500/10">
          <span className="text-emerald-800 dark:text-emerald-200">
            ✓ Uplatněno: <b>{redemptionRewardLabel(used)}</b>
            {used.discountKc != null && ` · −${used.discountKc} Kč`}
            {used.code && <span className="ml-1 font-mono text-xs">({used.code})</span>}
          </span>
          {b.status === 'active' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Zrušit uplatněnou slevu? Cena rezervace se vrátí zpět.')) onRelease()
              }}
              className="shrink-0 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-[#3f3f3d] dark:text-gray-300 dark:hover:bg-[#2e2e2c]"
            >
              Zrušit slevu
            </button>
          )}
        </div>
      )}
      {!used && rebookApplied && available.length > 0 && (
        <div className="mb-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          Na rezervaci už je sleva za dozápis — slevy se nesčítají. Chcete-li uplatnit bitchcard,
          nejdřív zrušte slevu za dozápis níže.
        </div>
      )}
      {!used &&
        available.map((r) => (
          <div
            key={r.documentId}
            className="mb-1.5 flex items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm last:mb-0 dark:bg-[#2c2c2a]"
          >
            <span className="min-w-0 text-gray-800 dark:text-gray-300">
              🎟 <b>{redemptionRewardLabel(r)}</b>
              {r.code && <span className="ml-1 font-mono text-xs text-gray-500 dark:text-gray-400">{r.code}</span>}
            </span>
            {!rebookApplied && (
              <button
                type="button"
                disabled={busy || !r.code}
                onClick={() => {
                  if (
                    window.confirm(
                      `Uplatnit slevu „${r.reward.title}“ na tuto rezervaci? Cena se přepočítá.`,
                    )
                  )
                    onApply(r.code || '')
                }}
                className="shrink-0 rounded-md border border-pink-300 bg-white px-3 py-2 text-xs font-semibold text-primary shadow-sm transition hover:bg-pink-50 disabled:opacity-40 dark:border-[#e71e6e80] dark:bg-transparent dark:shadow-none dark:hover:bg-[#e71e6e26] sm:px-2.5 sm:py-1"
              >
                Uplatnit slevu
              </button>
            )}
          </div>
        ))}
    </div>
  )
}

// Карточка «Sleva za dozápis» (rebook −15% с thank-you): показывает применённую
// скидку с кнопкой «Zrušit slevu» либо снятую с кнопкой «Vrátit slevu» —
// та же механика управления, что у bitchcard-redemption (LoyaltyCard выше).
