// «+ Blok» — нерабочее время мастера, опционально с повтором (denně / vybrané
// dny v týdnu do data). Серия материализуется на сервере (_expandBlockDates).

import { useMemo, useState } from 'react'
import type { CalendarEmployee } from '../fetch/calendarDay'
import { engineCreateBlock } from '../fetch/engineApi'
import { WEEKDAYS, addDays, blokPlural, fmtHM, inputCls, labelCls, toMin, weekdayOf } from './helpers'
import { ModalShell, Section } from './ui'

interface NewBlockProps {
  employees: CalendarEmployee[]
  initial: { employeeDocId?: string; date: string; startMin?: number }
  onClose: () => void
  onCreated: () => void
}

export const NewBlockModal = ({ employees, initial, onClose, onCreated }: NewBlockProps) => {
  const [employeeDocId, setEmployeeDocId] = useState(initial.employeeDocId || employees[0]?.docId || '')
  const [date, setDate] = useState(initial.date)
  const [fromTime, setFromTime] = useState(initial.startMin != null ? fmtHM(initial.startMin) : '09:00')
  const [toTime, setToTime] = useState(initial.startMin != null ? fmtHM(initial.startMin + 60) : '10:00')
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // повтор
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly'>('none')
  const [until, setUntil] = useState('')
  const [weekdays, setWeekdays] = useState<number[]>([])

  const onRepeatChange = (r: 'none' | 'daily' | 'weekly') => {
    setRepeat(r)
    if (r !== 'none' && !until) setUntil(addDays(date, r === 'weekly' ? 27 : 6))
    if (r === 'weekly' && weekdays.length === 0) setWeekdays([weekdayOf(date)])
  }
  const toggleWeekday = (v: number) =>
    setWeekdays((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))

  const timeValid = /^\d{2}:\d{2}$/.test(fromTime) && /^\d{2}:\d{2}$/.test(toTime) && toMin(toTime) > toMin(fromTime)
  const untilValid = /^\d{4}-\d{2}-\d{2}$/.test(until) && until >= date
  const recurrenceValid = repeat === 'none' || (untilValid && (repeat === 'daily' || weekdays.length > 0))
  const valid = timeValid && recurrenceValid

  // предпросмотр числа блоков (зеркало _expandBlockDates)
  const occurrences = useMemo(() => {
    if (repeat === 'none') return 1
    if (!untilValid) return 0
    const wds = repeat === 'weekly' ? (weekdays.length ? weekdays : [weekdayOf(date)]) : null
    let count = 0
    for (
      let t = new Date(`${date}T00:00:00Z`);
      t <= new Date(`${until}T00:00:00Z`) && count < 400;
      t.setUTCDate(t.getUTCDate() + 1)
    ) {
      if (repeat === 'daily' || wds!.includes(t.getUTCDay())) count++
    }
    return count
  }, [repeat, until, date, weekdays, untilValid])

  const submit = async () => {
    if (!valid) return
    setSubmitting(true)
    setError(null)
    try {
      await engineCreateBlock({
        employee: employeeDocId,
        date,
        startMin: toMin(fromTime),
        endMin: toMin(toTime),
        title: title.trim() || undefined,
        recurrence:
          repeat === 'none'
            ? undefined
            : {
                freq: repeat,
                until,
                weekdays: repeat === 'weekly' ? (weekdays.length ? weekdays : [weekdayOf(date)]) : undefined,
              },
      })
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell title="Nový blok" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className={labelCls}>Mistr</span>
            <select className={inputCls} value={employeeDocId} onChange={(e) => setEmployeeDocId(e.target.value)}>
              {employees.map((e) => (
                <option key={e.docId} value={e.docId}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={labelCls}>Datum</span>
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Od</span>
            <input type="time" step={900} className={inputCls} value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Do</span>
            <input type="time" step={900} className={inputCls} value={toTime} onChange={(e) => setToTime(e.target.value)} />
          </div>
        </div>
        <div>
          <span className={labelCls}>Důvod (volitelné)</span>
          <input className={inputCls} placeholder="školení / dovolená / oběd…" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {/* Повтор */}
        <Section title="Opakování">
          <div>
            <select className={inputCls} value={repeat} onChange={(e) => onRepeatChange(e.target.value as 'none' | 'daily' | 'weekly')}>
              <option value="none">Neopakovat</option>
              <option value="daily">Každý den</option>
              <option value="weekly">Vybrané dny v týdnu</option>
            </select>
          </div>

          {repeat === 'weekly' && (
            <div>
              <span className={labelCls}>Dny v týdnu</span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w) => (
                  <button
                    key={w.v}
                    type="button"
                    onClick={() => toggleWeekday(w.v)}
                    className={`h-8 w-9 rounded-md border text-xs font-semibold transition ${
                      weekdays.includes(w.v)
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {repeat !== 'none' && (
            <div>
              <span className={labelCls}>Opakovat do</span>
              <input type="date" className={inputCls} min={date} value={until} onChange={(e) => setUntil(e.target.value)} />
              <p className="mt-1 text-[10px] leading-tight text-gray-400">
                {occurrences > 0
                  ? `Vytvoří se ${occurrences} ${blokPlural(occurrences)}.`
                  : 'Vyberte datum konce (musí být po začátku).'}
              </p>
            </div>
          )}
        </Section>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
            Zrušit
          </button>
          <button
            type="button"
            disabled={!valid || submitting}
            onClick={submit}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {submitting ? 'Vytvářím…' : 'Vytvořit blok'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
