// Карточка скидки дозаписи (rebook −15 %): снять или вернуть.
// Вынесено из calendar/BookingDrawer.tsx ДОСЛОВНО (этап 6 аудита).

import type { CalendarBooking } from '../fetch/calendarDay'

export const RebookDiscountCard = ({
  b,
  busy,
  onRemove,
  onRestore,
  blockedByRedemption,
}: {
  b: CalendarBooking
  busy: boolean
  onRemove: () => void
  onRestore: () => void
  // на брони уже применена награда bitchcard → вернуть скидку за дозапис нельзя
  // (одна скидка на услугу; сервер тоже вернёт 409 booking_has_redemption)
  blockedByRedemption: boolean
}) => {
  const d = b.discount
  if (!d || d.type !== 'rebook') return null
  const editable = b.status === 'active'
  // Рендерится ВНУТРИ главной карты брони (под ценой) — без своей рамки-карточки
  return (
    <div className="mt-2.5">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Sleva za dozápis
      </div>
      {d.applied ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-500/10">
          <span className="text-emerald-800 dark:text-emerald-200">
            ✓ Uplatněno: <b>{`−${d.percent} %`}</b>
            {` · −${d.discountKc} Kč (běžná cena ${d.originalPrice} Kč)`}
          </span>
          {editable && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Zrušit slevu za dozápis? Cena rezervace se vrátí na plnou.')) onRemove()
              }}
              className="shrink-0 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-[#3f3f3d] dark:text-gray-300 dark:hover:bg-[#2e2e2c]"
            >
              Zrušit slevu
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm dark:bg-[#2c2c2a]">
          <span className="text-gray-600 dark:text-gray-400">
            {`Sleva −${d.percent} % (−${d.discountKc} Kč) je zrušená — klient platí plnou cenu.`}
            {blockedByRedemption && (
              <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                Na rezervaci je sleva bitchcard — slevy se nesčítají. Vrátit slevu za dozápis lze
                až po zrušení slevy bitchcard.
              </span>
            )}
          </span>
          {editable && !blockedByRedemption && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Vrátit slevu za dozápis? Cena rezervace se sníží o slevu.')) onRestore()
              }}
              className="shrink-0 rounded-md border border-pink-300 bg-white px-3 py-2 text-xs font-semibold text-primary shadow-sm transition hover:bg-pink-50 disabled:opacity-40 dark:border-[#e71e6e80] dark:bg-transparent dark:shadow-none dark:hover:bg-[#e71e6e26] sm:px-2.5 sm:py-1"
            >
              Vrátit slevu
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Человеческие названия каналов Noona (bsChannel зеркальных броней)
