// Карточка «Kontakt» шторки брони: телефон/e-mail + blacklist (s208 вынесена из
// BookingDrawer, чтобы форма причины не раздула шторку за порог 600 строк).
//
// Блэклист блокирует клиенту ТОЛЬКО запись через сайт (движок 403); из календаря
// админ бронировать может как раньше. Кнопка — только у броней со связанным
// клиентом (у старых импортных связи нет). Добавление — через форму с обязательной
// причиной, снятие — confirm. Рендерить с key=documentId брони: шторка между
// бронями не размонтируется, а открытая форма не должна переехать к другому клиенту.
import { useState } from 'react'
import type { CalendarBooking } from '../fetch/calendarDay'
import { describeBlacklistReason } from '../../../lib/blacklistReasons'
import { BlacklistReasonForm } from '../BlacklistReasonForm'

interface Props {
  b: CalendarBooking
  busy: boolean
  onToggleBlacklist: (next: boolean, reason?: string) => void
}

export const ContactCard = ({ b, busy, onToggleBlacklist }: Props) => {
  const [asking, setAsking] = useState(false)
  const blacklisted = Boolean(b.client?.blacklisted)
  const reasonText = blacklisted ? describeBlacklistReason(b.client?.blacklistReason) : null

  return (
    <div className="mt-3 rounded-xl border border-gray-400 p-3 dark:border-[#2e2e2c]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Kontakt
        </span>
        {b.client?.documentId && !(asking && !blacklisted) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!blacklisted) {
                setAsking(true)
                return
              }
              if (window.confirm(`Odebrat klienta ${b.clientNameRaw} z blacklistu?`)) {
                setAsking(false)
                onToggleBlacklist(false)
              }
            }}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-40 ${
              blacklisted
                ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30'
                : 'border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-500/50 dark:text-red-300 dark:hover:bg-red-500/10'
            }`}
          >
            {blacklisted ? '⛔ Na blacklistu · zrušit' : '⛔ Na blacklist'}
          </button>
        )}
      </div>
      {asking && !blacklisted && b.client?.documentId && (
        <BlacklistReasonForm
          clientName={b.clientNameRaw || 'klienta'}
          busy={busy}
          onSubmit={(reason) => onToggleBlacklist(true, reason)}
          onCancel={() => setAsking(false)}
        />
      )}
      {blacklisted && (
        <div data-blacklist-reason className="mb-2 text-xs text-red-700 dark:text-red-300">
          Důvod: {reasonText || <span className="italic text-gray-500 dark:text-gray-400">neuveden</span>}
        </div>
      )}
      <div className="flex flex-col gap-1 rounded-lg bg-gray-50 px-3 py-2 dark:bg-[#252523] text-sm">
        {b.client?.phone ? (
          <a
            href={`tel:${b.client.phone}`}
            className="font-semibold text-gray-800 hover:text-primary dark:text-gray-300"
          >
            {b.client.phone}
          </a>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">telefon není uveden</span>
        )}
        {b.client?.email ? (
          <a
            href={`mailto:${b.client.email}`}
            className="break-all text-gray-800 hover:text-primary dark:text-gray-300"
          >
            {b.client.email}
          </a>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">e-mail není uveden</span>
        )}
      </div>
    </div>
  )
}
