// «Změnit termín» — перенос брони из drawer: дата + время + мастер одним модалом
// (PATCH date/time/employee). Пересечение с другой бронью админа НЕ блокирует (решает
// человек) — про него предупреждаем жёлтой плашкой, как про «служба не влезает в окно».
// Чекбокс «уведомить клиента» шлёт письмо о переносе (как при DnD-переносе).

import { useMemo, useState } from 'react'
import type { CalendarBooking, CalendarEmployee } from '../fetch/calendarDay'
import { enginePatchBooking } from '../fetch/engineApi'
import { fmtTime } from '../utils'
import { TIME_OPTIONS, btnPrimaryCls, btnSecondaryCls, inputCls, labelCls, toMin } from './helpers'
import type { SlotFitContext } from './NewBookingModal'
import { ModalShell, Section } from './ui'

export const RescheduleModal = ({
  booking,
  employees,
  slotFit,
  onClose,
  onMoved,
}: {
  booking: CalendarBooking
  employees: CalendarEmployee[]
  slotFit?: SlotFitContext | null
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

  const durMin = useMemo(() => {
    if (!booking.startsAt || !booking.endsAt) return 0
    return Math.round((new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime()) / 60000)
  }, [booking.startsAt, booking.endsAt])

  // Накладывается ли новый термин на чужую бронь/блок этого мастера. Только информация:
  // перенос всё равно разрешён (сервер тоже не блокирует — см. adminPatchBooking).
  const conflict = useMemo(() => {
    if (!slotFit || !durMin || !/^\d{2}:\d{2}$/.test(time)) return false
    const busy = slotFit.busyByKey[`${empDocId}|${date}`]
    if (!busy) return false // дата/мастер вне загруженного дня — не врём, подсказку не показываем
    const start = toMin(time)
    // свой же интервал не считаем конфликтом (сдвиг внутри собственного слота)
    const ownStart = toMin(curTime)
    const sameColumn = date === booking.date && empDocId === (curEmp?.docId || '')
    return busy.some(
      (b) =>
        !(sameColumn && b.startMin === ownStart && b.endMin === ownStart + durMin) &&
        b.startMin < start + durMin &&
        start < b.endMin
    )
  }, [slotFit, empDocId, date, time, durMin, curTime, booking.date, curEmp?.docId])

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
    <ModalShell
      title="Změnit termín"
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
              disabled={!changed || !date || submitting}
              onClick={submit}
              className={`${btnPrimaryCls} flex-1 sm:flex-none`}
            >
              {submitting ? 'Přesouvám…' : 'Přesunout'}
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-md bg-gray-50 dark:bg-[#2a2a28] px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
          <b>{booking.clientNameRaw || 'Klient'}</b> · nyní {ddmm(booking.date)} · {curTime}
          {booking.employeeNameRaw && <span className="text-gray-400 dark:text-gray-500"> · {booking.employeeNameRaw}</span>}
        </div>

        <Section title="Nový termín">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
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
          {conflict && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              <span className="text-sm leading-none">⚠</span>
              <span>
                V tomto čase už mistr má rezervaci nebo blok — termíny se budou překrývat. Přesunout to lze i tak.
              </span>
            </div>
          )}
        </Section>

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
        </Section>

      </div>
    </ModalShell>
  )
}
