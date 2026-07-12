// «Změnit termín» — перенос брони из drawer: дата + время + мастер одним модалом
// (PATCH date/time/employee — сервер перепроверяет пересечения → slot_taken).
// Чекбокс «уведомить клиента» шлёт письмо о переносе (как при DnD-переносе).

import { useState } from 'react'
import type { CalendarBooking, CalendarEmployee } from '../fetch/calendarDay'
import { enginePatchBooking } from '../fetch/engineApi'
import { fmtTime } from '../utils'
import { TIME_OPTIONS, inputCls, labelCls } from './helpers'
import { ModalShell, Section } from './ui'

export const RescheduleModal = ({
  booking,
  employees,
  onClose,
  onMoved,
}: {
  booking: CalendarBooking
  employees: CalendarEmployee[]
  onClose: () => void
  onMoved: (newDate: string) => void
}) => {
  const curTime = fmtTime(booking.startsAt)
  // текущий мастер брони; бывший сотрудник может отсутствовать в списке → ''
  const curEmp = employees.find((e) => e.id === booking.noonaEmployeeId)
  const [date, setDate] = useState(booking.date)
  const [time, setTime] = useState(curTime)
  const [empDocId, setEmpDocId] = useState(curEmp?.docId || '')
  const hasEmail = Boolean(booking.client?.email?.trim())
  const [notifyClient, setNotifyClient] = useState(hasEmail)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const masterChanged = Boolean(empDocId) && empDocId !== (curEmp?.docId || '')
  const changed = date !== booking.date || time !== curTime || masterChanged
  const ddmm = (d: string) => d.split('-').reverse().join('. ')

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await enginePatchBooking(booking.documentId, {
        date,
        time,
        ...(masterChanged ? { employee: empDocId } : {}),
        ...(notifyClient && hasEmail ? { notifyClient: true } : {}),
      })
      onMoved(date)
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <ModalShell title="Změnit termín" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
          <b>{booking.clientNameRaw || 'Klient'}</b> · nyní {ddmm(booking.date)} · {curTime}
          {booking.employeeNameRaw && <span className="text-gray-400"> · {booking.employeeNameRaw}</span>}
        </div>

        <Section title="Nový termín">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className={labelCls}>Mistr</span>
              <select className={inputCls} value={empDocId} onChange={(e) => setEmpDocId(e.target.value)}>
                {!curEmp && (
                  <option value="">{booking.employeeNameRaw || '—'} (současný)</option>
                )}
                {employees.map((e) => (
                  <option key={e.docId} value={e.docId}>
                    {e.name}
                    {e.tier === 'junior' ? ' (junior)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className={labelCls}>Datum</span>
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <span className={labelCls}>Čas</span>
              <select className={inputCls} value={time} onChange={(e) => setTime(e.target.value)}>
                {(TIME_OPTIONS.includes(time) ? TIME_OPTIONS : [...TIME_OPTIONS, time].sort()).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Section>

        <Section title="Oznámení">
          {hasEmail ? (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-gray-300">
              <input
                type="checkbox"
                checked={notifyClient}
                onChange={(e) => setNotifyClient(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              Poslat klientovi e-mail o změně termínu
            </label>
          ) : (
            <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-400">
              Klient nemá e-mail — oznámení nelze odeslat.
            </p>
          )}
        </Section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Zrušit
          </button>
          <button
            type="button"
            disabled={!changed || !date || submitting}
            onClick={submit}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {submitting ? 'Přesouvám…' : 'Přesunout'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
