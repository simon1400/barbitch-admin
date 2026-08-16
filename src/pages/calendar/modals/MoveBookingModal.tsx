// Подтверждение переноса брони (drag-and-drop в гриде): что и куда + чекбокс
// «уведомить клиента e-mailem» (движок шлёт письмо с новыми деталями + ICS).

import { useMemo, useState } from 'react'
import type { CalendarBooking } from '../fetch/calendarDay'
import { previewTierReprice } from './helpers'
import { ModalShell, RepriceNotice, Section } from './ui'

export interface MovePending {
  booking: CalendarBooking
  employeeDocId: string
  date: string
  time: string
  fromLabel: string // «14:00 · Yana» (старый термин)
  toLabel: string // «11:30 · 12. 7. · Karina» (новый)
  masterChanged: boolean
  // тиры мастеров для превью пересчёта цены (junior −20 %)
  fromTier?: 'senior' | 'junior'
  toTier?: 'senior' | 'junior'
}

interface MoveModalProps {
  pending: MovePending
  onClose: () => void
  onConfirm: (notifyClient: boolean) => void
  busy: boolean
}

export const MoveBookingModal = ({ pending, onClose, onConfirm, busy }: MoveModalProps) => {
  const hasEmail = Boolean(pending.booking.client?.email?.trim())
  const [notifyClient, setNotifyClient] = useState(hasEmail)
  // цена при переносе к мастеру другого тира (junior −20 %) — превью до подтверждения
  const reprice = useMemo(
    () =>
      pending.masterChanged
        ? previewTierReprice(pending.booking, pending.fromTier, pending.toTier)
        : null,
    [pending],
  )

  return (
    <ModalShell title="Přesunout rezervaci" onClose={onClose}>
      <div className="space-y-4">
        {/* что и куда */}
        <div className="rounded-lg bg-gray-50 dark:bg-[#2a2a28] px-3 py-2.5 text-sm">
          <div className="mb-1.5 font-semibold text-gray-900 dark:text-gray-300">{pending.booking.clientNameRaw || 'Klient'}</div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <span className="text-gray-400 dark:text-gray-500 line-through">{pending.fromLabel}</span>
            <span className="text-primary">→</span>
            <span className="font-semibold text-gray-900 dark:text-gray-300">{pending.toLabel}</span>
          </div>
          {reprice && <RepriceNotice reprice={reprice} />}
        </div>

        {/* уведомление клиента */}
        <Section title="Oznámení">
          {hasEmail ? (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-gray-200 dark:border-[#2e2e2c] bg-white dark:bg-[#2a2a28] px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:border-gray-300">
              <input
                type="checkbox"
                checked={notifyClient}
                onChange={(e) => setNotifyClient(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              Poslat klientovi e-mail o změně termínu
            </label>
          ) : (
            <p className="rounded-md bg-gray-50 dark:bg-[#2a2a28] px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
              Klient nemá e-mail — oznámení nelze odeslat.
            </p>
          )}
          {/* уведомление мастеру — отдельная задача, добавим позже */}
        </Section>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100">
            Zrušit
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(notifyClient && hasEmail)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? 'Přesouvám…' : 'Přesunout'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
