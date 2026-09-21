// Карточка «Odpis ze mzdy» в шторке интерной брони (s203).
//
// У интерной брони нет клиента, поэтому вместо bitchcard / скидки за дозапись /
// контакта / истории показываем, кого обслуживают и что списание — черновик:
// публикует его закрытие смены, и только если визит состоялся.
//
// Вынесено из BookingDrawer.tsx: тот перешагнул порог 600 строк из аудита (test-split).

import type { CalendarBooking } from '../fetch/calendarDay'

export const InternalOdpisCard = ({ b }: { b: CalendarBooking }) => (
  <div
    className="mt-2.5 rounded-lg border border-indigo-200 bg-indigo-50/60 p-2.5 dark:border-indigo-500/30 dark:bg-indigo-500/10"
    data-internal-odpis
  >
    <div className="text-[11px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
      Odpis ze mzdy · návrh
    </div>
    <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">
      Pro: <b>{b.internalFor?.name || b.clientNameRaw || '—'}</b>
    </div>
    <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
      Salon 0 Kč · publikuje se při uzavření směny.
    </div>
  </div>
)
