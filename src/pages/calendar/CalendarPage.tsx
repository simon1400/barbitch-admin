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
  ClientHistoryItem,
  MasterColumn,
} from './fetch/calendarDay'
import { fetchCalendarDay, fetchCalendarWeek, fetchWeekEmployees } from './fetch/calendarDay'
import { enginePatchBooking } from './fetch/engineApi'
import { fetchBookingLabels, type BookingLabel } from './fetch/bookingLabels'
import { CalendarGrid } from './CalendarGrid'
import { BookingDrawer } from './BookingDrawer'
import { fmtHM, fmtTime, mondayOf, shiftDate, todayStr, type Mode } from './utils'
import {
  CellActionModal,
  ChangeServiceModal,
  ColumnOrderModal,
  EditBlockModal,
  ManageLabelsModal,
  MoveBookingModal,
  NewBookingModal,
  NewBlockModal,
  type MovePending,
  type NewBookingInitial,
} from './modals'

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
  // подсветка брони после перехода из истории клиента (мигает 3 сек)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // смена услуги открытой брони (модал «Změnit službu»)
  const [changeService, setChangeService] = useState<CalendarBooking | null>(null)

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

  // Клик по строке истории клиента → закрыть drawer, перейти на день брони, мигнуть 3 с
  const openHistoryBooking = (r: ClientHistoryItem) => {
    setSelected(null)
    setMode('day')
    setDate(r.date)
    setHighlightId(r.documentId)
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlightId(null), 3000)
  }

  useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
  }, [])

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

      {/* Грид остаётся на месте при переключении дня — сверху появляется лоадер,
          ничего не прыгает (старые данные видны, пока грузятся новые) */}
      <div className="relative min-h-[200px]">
        {day && (
          <CalendarGrid
            day={day}
            onSelect={setSelected}
            highlightId={highlightId}
            onEmptyCell={(col, startMin) => setCellChoice({ col, startMin })}
            onMoveBooking={moveBooking}
            onSelectBlock={selectBlock}
          />
        )}
        {loading && (
          <div className="absolute inset-0 z-30 flex items-start justify-center rounded-xl bg-white/60 pt-20">
            <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-md">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
              <span className="text-sm font-medium text-gray-600">Načítám…</span>
            </div>
          </div>
        )}
        {error && !day && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {selected && (
        <BookingDrawer
          b={selected}
          labels={labels}
          onClose={() => setSelected(null)}
          onStatus={patchStatus}
          onLabel={patchLabel}
          onManageLabels={() => setManageLabels(true)}
          onOpenHistory={openHistoryBooking}
          onChangeService={() => selected && setChangeService(selected)}
          busy={mutating}
        />
      )}
      {changeService && (
        <ChangeServiceModal
          booking={changeService}
          employees={employees}
          onClose={() => setChangeService(null)}
          onChanged={(upd) => {
            setChangeService(null)
            // drawer остаётся открытым — обновляем услуги/цену/конец из ответа движка
            setSelected((prev) =>
              prev && prev.documentId === changeService.documentId
                ? {
                    ...prev,
                    services: upd.services ?? prev.services,
                    totalPrice: upd.totalPrice ?? prev.totalPrice,
                    endsAt: upd.endsAt ?? prev.endsAt,
                  }
                : prev,
            )
            reload()
          }}
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
