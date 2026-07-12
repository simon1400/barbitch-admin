// Календарь администраторов (own-booking). Данные — ТОЛЬКО из нашей локальной БД
// (booking/salon-hour/time-block/personal), Noona не участвует. Дневной + недельный
// вид. WRITE через собственный движок (/api/engine/admin/*): drag-and-drop перенос,
// статусы в drawer, модалы «+ Rezervace» / «+ Blok», удаление own-блоков.
// Обновление: polling 25 с (тихий reload), после мутаций — немедленный reload.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessionRole } from '../../services/auth'
import type {
  BlockedRange,
  CalendarBooking,
  CalendarDay,
  CalendarEmployee,
  MasterColumn,
} from './fetch/calendarDay'
import { fetchCalendarDay, fetchCalendarWeek, fetchWeekEmployees } from './fetch/calendarDay'
import { enginePatchBooking } from './fetch/engineApi'
import { fetchBookingLabels, type BookingLabel } from './fetch/bookingLabels'
import { CalendarGrid } from './CalendarGrid'
import {
  CellActionModal,
  ColumnOrderModal,
  EditBlockModal,
  ManageLabelsModal,
  MoveBookingModal,
  NewBookingModal,
  NewBlockModal,
  type MovePending,
  type NewBookingInitial,
} from './CalendarModals'

type Mode = 'day' | 'week'

const todayStr = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const shiftDate = (dateStr: string, days: number): string => {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Понедельник недели, в которой лежит dateStr
const mondayOf = (dateStr: string): string => {
  const d = new Date(`${dateStr}T12:00:00`)
  const dow = (d.getDay() + 6) % 7 // Пн=0
  d.setDate(d.getDate() - dow)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fmtTime = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : '—'

const fmtHM = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

const STATUS_META: Record<CalendarBooking['status'], { label: string; cls: string }> = {
  active: { label: 'aktivní', cls: 'bg-pink-100 text-pink-700' },
  checkedOut: { label: '✓ proběhla', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'zrušena', cls: 'bg-gray-200 text-gray-500' },
  noshow: { label: 'nepřišla', cls: 'bg-red-100 text-red-700' },
}

// Drawer с деталями брони + кнопки статусов (пишут в движок)
const BookingDrawer = ({
  b,
  labels,
  onClose,
  onStatus,
  onLabel,
  onManageLabels,
  busy,
}: {
  b: CalendarBooking
  labels: BookingLabel[]
  onClose: () => void
  onStatus: (status: CalendarBooking['status'], notify?: boolean) => void
  onLabel: (label: { name: string; color: string } | null) => void
  onManageLabels: () => void
  busy: boolean
}) => {
  const meta = STATUS_META[b.status] ?? STATUS_META.active
  const hasEmail = Boolean((b.client?.email ?? '').trim())
  // инлайн-подтверждение отмены с чекбоксом «уведомить клиента» (роадмап §4.2)
  const [cancelling, setCancelling] = useState(false)
  const [notifyCancel, setNotifyCancel] = useState(hasEmail)
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative h-full w-full max-w-sm overflow-y-auto bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="text-md font-bold text-gray-900">{b.clientNameRaw || '—'}</div>
            <div className="text-sm text-gray-500">
              {fmtTime(b.startsAt)}–{fmtTime(b.endsAt)}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm1">
            ✕
          </button>
        </div>

        <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>
          {meta.label}
        </span>

        {/* Кнопки статусов */}
        <div className="mt-3 flex flex-wrap gap-2">
          {b.status === 'active' ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onStatus('checkedOut')}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
              >
                ✓ Proběhla
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onStatus('noshow')}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                Nepřišla
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCancelling(true)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Zrušit
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus('active')}
              className="rounded-md border border-pink-300 px-3 py-1.5 text-sm font-semibold text-pink-700 hover:bg-pink-50 disabled:opacity-40"
            >
              ↩ Obnovit (aktivní)
            </button>
          )}
        </div>

        {/* Кастомный лейбл (только активные; прошедшие/отменённые получают авто-лейбл) */}
        {b.status === 'active' && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Štítek</span>
              <button type="button" onClick={onManageLabels} className="text-xs font-semibold text-primary hover:underline">
                Spravovat štítky
              </button>
            </div>
            {labels.length ? (
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => {
                  const isSet = b.label?.name === l.name && b.label?.color === l.color
                  return (
                    <button
                      key={l.documentId}
                      type="button"
                      disabled={busy}
                      onClick={() => onLabel(isSet ? null : { name: l.name, color: l.color })}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
                        isSet ? 'border-gray-700 bg-gray-100 text-gray-900' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                      {l.name}
                      {isSet && <span className="text-gray-400">✕</span>}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Zatím žádné štítky — vytvořte je přes „Spravovat štítky“.</p>
            )}
          </div>
        )}

        {/* Инлайн-подтверждение отмены + чекбокс «уведомить клиента» */}
        {cancelling && b.status === 'active' && (
          <div className="mt-3 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="text-sm font-semibold text-red-800">
              Zrušit rezervaci {b.clientNameRaw}?
            </div>
            <label
              className={`flex items-center gap-2 text-sm ${hasEmail ? 'text-gray-700' : 'text-gray-400'}`}
            >
              <input
                type="checkbox"
                disabled={!hasEmail}
                checked={notifyCancel && hasEmail}
                onChange={(e) => setNotifyCancel(e.target.checked)}
              />
              Poslat klientovi e-mail o zrušení
              {!hasEmail && <span className="text-xs">(klient nemá e-mail)</span>}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onStatus('cancelled', notifyCancel && hasEmail)}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                Potvrdit zrušení
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCancelling(false)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Zpět
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {(b.services || []).map((s, i) => (
            <div key={i} className="flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <span className="text-gray-800">{s.title}</span>
              <span className="text-gray-500">
                 {s.durationMin ? `${s.durationMin} min` : ''} {/*{s.price != null ? `· ${s.price} Kč` : ''} */}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3">
          <span className="text-sm text-gray-500">Celkem</span>
          <span className="text-sm1 font-bold text-primary">
            {b.totalPrice != null ? `${b.totalPrice} Kč` : '—'}
          </span>
        </div>

        {(b.comment || b.customerComment) && (
          <div className="mt-4 space-y-2">
            {b.comment && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <b>Poznámka:</b> {b.comment}
              </div>
            )}
            {b.customerComment && (
              <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <b>Klient:</b> {b.customerComment}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 text-xs text-gray-400">
          {b.employeeNameRaw && <div>Mistr: {b.employeeNameRaw}</div>}
          {b.bsChannel && <div>Kanál: {b.bsChannel}</div>}
        </div>

        <p className="mt-6 text-xs italic text-gray-400">
          Přesun rezervace: přetáhněte kartu v kalendáři na nový čas / k jinému mistrovi.
        </p>
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const [date, setDate] = useState(todayStr())
  const [mode, setMode] = useState<Mode>('day')
  const [day, setDay] = useState<CalendarDay | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<CalendarBooking | null>(null)
  const [employees, setEmployees] = useState<CalendarEmployee[]>([])
  const [weekEmpId, setWeekEmpId] = useState<string>('')
  const [mutating, setMutating] = useState(false)
  const [bookingModal, setBookingModal] = useState<NewBookingInitial | null>(null)
  const [blockModal, setBlockModal] = useState<{ employeeDocId?: string; date: string; startMin?: number } | null>(null)
  // клик по пустой ячейке → сначала выбор «rezervace / blok», потом конкретный модал
  const [cellChoice, setCellChoice] = useState<{ col: MasterColumn; startMin: number } | null>(null)
  // клик по существующему блоку в гриде → управление (правка времени / удаление / серия)
  const [editBlock, setEditBlock] = useState<{ block: BlockedRange; masterName: string; date: string } | null>(null)
  // drag-and-drop перенос брони → модалка подтверждения (с чекбоксом уведомления)
  const [movePending, setMovePending] = useState<MovePending | null>(null)
  // кастомные лейблы броней (справочник + модал управления)
  const [labels, setLabels] = useState<BookingLabel[]>([])
  const [manageLabels, setManageLabels] = useState(false)
  // модал порядка колонок мастеров (personal.calendarOrder)
  const [orderModal, setOrderModal] = useState(false)

  useEffect(() => {
    fetchBookingLabels().then(setLabels).catch(() => {})
  }, [])

  // Список мастеров для недельного селектора (один раз)
  useEffect(() => {
    fetchWeekEmployees()
      .then((emps) => {
        setEmployees(emps)
        setWeekEmpId((cur) => cur || emps[0]?.id || '')
      })
      .catch(() => setEmployees([]))
  }, [])

  const load = useCallback(
    async (dateStr: string, m: Mode, empId: string, emps: CalendarEmployee[], silent = false) => {
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      try {
        if (m === 'week') {
          const emp = emps.find((e) => e.id === empId)
          if (!emp) {
            setDay({ openMin: 9 * 60, closeMin: 20 * 60, columns: [] })
          } else {
            setDay(await fetchCalendarWeek(mondayOf(dateStr), emp))
          }
        } else {
          setDay(await fetchCalendarDay(dateStr))
        }
        if (silent) setError(null)
      } catch (e) {
        if (!silent) {
          setError((e as Error).message || 'Nepodařilo se načíst')
          setDay(null)
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    load(date, mode, weekEmpId, employees)
  }, [date, mode, weekEmpId, employees, load])

  const reload = useCallback(
    (silent = true) => load(date, mode, weekEmpId, employees, silent),
    [date, mode, weekEmpId, employees, load],
  )
  const reloadRef = useRef(reload)
  reloadRef.current = reload

  // Polling 25 с — тихое обновление (чужие изменения); скрытый таб не дёргаем
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) reloadRef.current(true)
    }, 25000)
    return () => clearInterval(t)
  }, [])

  // ── write-операции ──

  const patchStatus = async (status: CalendarBooking['status'], notify?: boolean) => {
    if (!selected) return
    setMutating(true)
    try {
      await enginePatchBooking(selected.documentId, { status, ...(notify ? { notify: true } : {}) })
      setSelected(null)
      await reload()
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setMutating(false)
    }
  }

  // лейбл на бронь (drawer остаётся открытым — обновляем и selected, и грид)
  const patchLabel = async (label: { name: string; color: string } | null) => {
    if (!selected) return
    setMutating(true)
    try {
      await enginePatchBooking(selected.documentId, { label })
      setSelected({ ...selected, label })
      await reload(true)
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setMutating(false)
    }
  }

  const moveBooking = (b: CalendarBooking, target: MasterColumn, startMin: number) => {
    if (!target.employeeDocId || !target.date) return
    const time = fmtHM(startMin)
    const masterChanged = mode === 'day' && target.id !== b.noonaEmployeeId
    const dateChanged = target.date !== b.date
    const curTime = fmtTime(b.startsAt)
    if (!masterChanged && !dateChanged && time === curTime) return
    const ddmm = (d: string) => d.split('-').reverse().slice(0, 2).join('. ') + '.'
    const fromLabel = [curTime, dateChanged ? ddmm(b.date) : '', b.employeeNameRaw?.split(' ')[0]]
      .filter(Boolean)
      .join(' · ')
    const toLabel = [time, dateChanged ? ddmm(target.date) : '', masterChanged ? target.name.split(' ')[0] : '']
      .filter(Boolean)
      .join(' · ')
    setMovePending({ booking: b, employeeDocId: target.employeeDocId, date: target.date, time, fromLabel, toLabel, masterChanged })
  }

  const confirmMove = async (notifyClient: boolean) => {
    if (!movePending) return
    const m = movePending
    setMutating(true)
    try {
      await enginePatchBooking(m.booking.documentId, {
        date: m.date,
        time: m.time,
        ...(m.masterChanged ? { employee: m.employeeDocId } : {}),
        ...(notifyClient ? { notifyClient: true } : {}),
      })
      setMovePending(null)
      await reload()
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setMutating(false)
    }
  }

  const selectBlock = (block: BlockedRange, col: MasterColumn) => {
    setEditBlock({ block, masterName: col.name, date: col.date || date })
  }

  const openNewBooking = (col?: MasterColumn, startMin?: number) => {
    setBookingModal({
      employeeDocId: col?.employeeDocId,
      date: col?.date || date,
      time: startMin != null ? fmtHM(startMin) : undefined,
    })
  }

  const totals = useMemo(() => {
    if (!day) return { total: 0, cancelled: 0 }
    const all = day.columns.flatMap((c) => c.bookings)
    return {
      total: all.filter((b) => b.status !== 'cancelled').length,
      cancelled: all.filter((b) => b.status === 'cancelled').length,
    }
  }, [day])

  // Домашняя страница по роли (календарь доступен только owner/administrator)
  const goHome = () => {
    navigate(getSessionRole() === 'administrator' ? '/administrator-cabinet' : '/global')
  }

  return (
    <div className="w-full px-2 py-4 md:px-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Возврат на главную (страница без общего хедера) */}
        <button
          type="button"
          onClick={goHome}
          className="mr-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
        >
          ← Domů
        </button>

        {/* Переключатель День/Неделя */}
        <div className="mr-2 flex overflow-hidden rounded-md border border-gray-300">
          {(['day', 'week'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-sm font-semibold ${
                mode === m ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m === 'day' ? 'Den' : 'Týden'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setDate(shiftDate(date, mode === 'week' ? -7 : -1))}
          className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold shadow-sm hover:bg-gray-50"
        >
          ◀
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => setDate(shiftDate(date, mode === 'week' ? 7 : 1))}
          className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold shadow-sm hover:bg-gray-50"
        >
          ▶
        </button>
        <button
          type="button"
          onClick={() => setDate(todayStr())}
          className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold shadow-sm hover:bg-gray-50"
        >
          Dnes
        </button>

        {/* Селектор мастера — только в недельном режиме */}
        {mode === 'week' && (
          <select
            value={weekEmpId}
            onChange={(e) => setWeekEmpId(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        )}

        <div>
          <span className="text-sm text-gray-600">
            <b>{totals.total}</b> rezervací
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => openNewBooking()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110"
          >
            + Rezervace
          </button>
          <button
            type="button"
            onClick={() => setBlockModal({ date })}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            + Blok
          </button>
          <button
            type="button"
            onClick={() => setOrderModal(true)}
            title="Pořadí sloupců mistrů"
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            ⇅ Pořadí
          </button>
        </div>
      </div>

      {/* <p className="mb-4 text-xs text-gray-400">
        Vlastní rezervační systém. Přetažením karty přesunete rezervaci, kliknutím do volného místa
        vytvoříte novou, stavy měníte v detailu rezervace.
      </p> */}

      {loading && <p className="text-sm text-gray-500">Načítám…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && day && (
        <CalendarGrid
          day={day}
          onSelect={setSelected}
          onEmptyCell={(col, startMin) => setCellChoice({ col, startMin })}
          onMoveBooking={moveBooking}
          onSelectBlock={selectBlock}
        />
      )}

      {selected && (
        <BookingDrawer
          b={selected}
          labels={labels}
          onClose={() => setSelected(null)}
          onStatus={patchStatus}
          onLabel={patchLabel}
          onManageLabels={() => setManageLabels(true)}
          busy={mutating}
        />
      )}
      {manageLabels && (
        <ManageLabelsModal
          onClose={() => {
            setManageLabels(false)
            fetchBookingLabels().then(setLabels).catch(() => {})
          }}
        />
      )}

      {orderModal && (
        <ColumnOrderModal
          employees={employees}
          onClose={() => setOrderModal(false)}
          onSaved={() => {
            setOrderModal(false)
            // список мастеров (недельный селектор) + колонки дня — с новым порядком
            fetchWeekEmployees()
              .then(setEmployees)
              .catch(() => {})
            reload()
          }}
        />
      )}

      {cellChoice && (
        <CellActionModal
          masterName={cellChoice.col.name}
          date={cellChoice.col.date || date}
          time={fmtHM(cellChoice.startMin)}
          onClose={() => setCellChoice(null)}
          onReservation={() => {
            const { col, startMin } = cellChoice
            setCellChoice(null)
            openNewBooking(col, startMin)
          }}
          onBlock={() => {
            const { col, startMin } = cellChoice
            setCellChoice(null)
            setBlockModal({ employeeDocId: col.employeeDocId, date: col.date || date, startMin })
          }}
        />
      )}

      {bookingModal && (
        <NewBookingModal
          employees={employees}
          initial={bookingModal}
          onClose={() => setBookingModal(null)}
          onCreated={() => {
            setBookingModal(null)
            reload()
          }}
        />
      )}
      {blockModal && (
        <NewBlockModal
          employees={employees}
          initial={blockModal}
          onClose={() => setBlockModal(null)}
          onCreated={() => {
            setBlockModal(null)
            reload()
          }}
        />
      )}
      {editBlock && (
        <EditBlockModal
          block={editBlock.block}
          masterName={editBlock.masterName}
          date={editBlock.date}
          onClose={() => setEditBlock(null)}
          onChanged={() => {
            setEditBlock(null)
            reload()
          }}
        />
      )}
      {movePending && (
        <MoveBookingModal
          pending={movePending}
          busy={mutating}
          onClose={() => setMovePending(null)}
          onConfirm={confirmMove}
        />
      )}
    </div>
  )
}
