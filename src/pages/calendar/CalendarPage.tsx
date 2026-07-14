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
import { busyIntervals, fetchCalendarDay, fetchCalendarWeek, fetchWeekEmployees } from './fetch/calendarDay'
import { engineDeleteBooking, enginePatchBooking } from './fetch/engineApi'
import { fetchBookingLabels, type BookingLabel } from './fetch/bookingLabels'
import { CalendarGrid } from './CalendarGrid'
import { BookingDrawer } from './BookingDrawer'
import { useCoarsePointer } from './useMediaQuery'
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
  RescheduleModal,
  type MovePending,
  type NewBookingInitial,
} from './modals'

// Чешские дни недели для нижней пилюли даты (мобила, Noona-паттерн)
const WEEKDAYS_CS = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota']
const dateLabelCs = (d: string): string => {
  const [y, m, dd] = d.split('-')
  return `${WEEKDAYS_CS[new Date(`${d}T00:00:00`).getDay()]} ${+dd}. ${+m}. ${y}`
}

export default function CalendarPage() {
  const navigate = useNavigate()
  // тач-устройство (телефон/планшет) — там показываем кнопки зума грида
  const coarse = useCoarsePointer()
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
  // мобильное меню «⋯» тулбара (второстепенные действия: + Blok, ⇅ Pořadí)
  const [moreOpen, setMoreOpen] = useState(false)
  // вертикальный зум грида (кнопки +/− на мобиле, как в Noona); живёт между сессиями
  const [zoom, setZoom] = useState(() => {
    const v = Number(localStorage.getItem('bb_cal_zoom'))
    return v >= 0.7 && v <= 2.2 ? v : 1
  })
  const changeZoom = (dir: 1 | -1) =>
    setZoom((z) => {
      const next = Math.min(2.2, Math.max(0.7, +(z + dir * 0.3).toFixed(1)))
      localStorage.setItem('bb_cal_zoom', String(next))
      return next
    })
  // подсветка брони после перехода из истории клиента (мигает 3 сек)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // смена услуги открытой брони (модал «Změnit službu»)
  const [changeService, setChangeService] = useState<CalendarBooking | null>(null)
  // перенос открытой брони из drawer (модал «Změnit termín»: дата/время/мастер)
  const [reschedule, setReschedule] = useState<CalendarBooking | null>(null)

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

  // полное удаление брони (корзина в drawer, подтверждение уже пройдено в drawer)
  const deleteBooking = async () => {
    if (!selected) return
    setMutating(true)
    try {
      await engineDeleteBooking(selected.documentId)
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

  // Контекст «влезает ли служба в свободное время» для модала новой брони:
  // занятые интервалы каждой колонки (ключ employeeDocId|date) + конец окна салона.
  // Модал сам считает свободные минуты от выбранного времени и предупреждает (не блокируя).
  const slotFit = useMemo(() => {
    if (!day) return null
    const busyByKey: Record<string, { startMin: number; endMin: number }[]> = {}
    for (const col of day.columns) {
      if (!col.employeeDocId || !col.date) continue
      busyByKey[`${col.employeeDocId}|${col.date}`] = busyIntervals(col)
    }
    return { closeMin: day.closeMin, busyByKey }
  }, [day])

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

  // Кнопка тулбара: на тач-экране ≥44px высоты, на десктопе компактная (как раньше)
  const tbBtn =
    'inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-semibold sm:min-h-[34px]'

  return (
    // Страница = вся высота окна (dvh — iOS-safe): тулбар фикс, грид скроллится внутри
    <div className="flex h-[100dvh] w-full flex-col px-2 pt-3 md:px-4">
      {/* Тулбар: минимальный (Noona-паттерн) — на мобиле навигация по датам живёт
          в нижней пилюле, тут только режим/«Dnes»/действия; на sm+ полный ряд */}
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-1.5 sm:mb-3 sm:gap-2">
          {/* Возврат на главную (страница без общего хедера) */}
          <button
            type="button"
            onClick={goHome}
            aria-label="Domů"
            className={`${tbBtn} border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 sm:mr-2`}
          >
            ←<span className="ml-1 hidden sm:inline">Domů</span>
          </button>
          {/* ◀ дата ▶ — только десктоп; на мобиле — нижняя пилюля (как в Noona) */}
          <button
            type="button"
            onClick={() => setDate(shiftDate(date, mode === 'week' ? -7 : -1))}
            className={`${tbBtn} hidden bg-white shadow-sm hover:bg-gray-50 sm:inline-flex`}
          >
            ◀
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="hidden min-w-0 rounded-md border border-gray-300 px-2 py-1 text-sm sm:block sm:min-h-[34px]"
          />
          <button
            type="button"
            onClick={() => setDate(shiftDate(date, mode === 'week' ? 7 : 1))}
            className={`${tbBtn} hidden bg-white shadow-sm hover:bg-gray-50 sm:inline-flex`}
          >
            ▶
          </button>
          <button
            type="button"
            onClick={() => setDate(todayStr())}
            className={`${tbBtn} bg-white shadow-sm hover:bg-gray-50`}
          >
            Dnes
          </button>

          {/* Режим задаётся кликом: в дневном виде — клик по имени мастера в шапке
              открывает его неделю; в недельном — селектор мастера + «Všichni mistři»
              (возврат в дневной вид всех мастеров). Отдельного тогла Den/Týden нет. */}
          {mode === 'week' && (
            <select
              value={weekEmpId}
              onChange={(e) => {
                if (e.target.value === '__all__') setMode('day')
                else setWeekEmpId(e.target.value)
              }}
              className="min-h-11 min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm font-semibold sm:min-h-[34px] sm:flex-none"
            >
              <option value="__all__">← Všichni mistři (denní)</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          )}

          {/* Счётчик — только sm+ (мобильный верх минимальный, как в Noona) */}
          <span className="hidden whitespace-nowrap text-sm text-gray-600 sm:inline">
            <b>{totals.total}</b> rezervací
          </span>

          <div className="ml-auto flex items-center gap-2">
            {/* Десктоп: + Rezervace в тулбаре; мобила — FAB внизу справа (см. ниже) */}
            <button
              type="button"
              onClick={() => openNewBooking()}
              className={`${tbBtn} hidden bg-primary text-white hover:brightness-110 sm:inline-flex`}
            >
              + Rezervace
            </button>
            {/* Десктоп: второстепенные действия в ряд */}
            <button
              type="button"
              onClick={() => setBlockModal({ date })}
              className={`${tbBtn} hidden border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 sm:inline-flex`}
            >
              + Blok
            </button>
            <button
              type="button"
              onClick={() => setOrderModal(true)}
              title="Pořadí sloupců mistrů"
              className={`${tbBtn} hidden border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 sm:inline-flex`}
            >
              ⇅ Pořadí
            </button>
            {/* Мобила: то же в меню «⋯» */}
            <div className="relative sm:hidden">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-label="Další akce"
                className={`${tbBtn} border border-gray-300 bg-white text-gray-700`}
              >
                ⋯
              </button>
              {moreOpen && (
                <>
                  {/* невидимая подложка — клик мимо закрывает меню */}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    onClick={() => setMoreOpen(false)}
                    className="fixed inset-0 z-40 cursor-default"
                  />
                  <div className="absolute right-0 z-50 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false)
                        setBlockModal({ date })
                      }}
                      className="flex min-h-11 w-full items-center px-4 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      + Blok
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false)
                        setOrderModal(true)
                      }}
                      className="flex min-h-11 w-full items-center px-4 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      ⇅ Pořadí sloupců
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
      </div>

      {/* Грид скроллится внутри собственной области (sticky ось/шапки живут там);
          при переключении дня остаётся на месте — поверх появляется лоадер */}
      <div className="relative min-h-0 flex-1 pb-2">
        {day && (
          <CalendarGrid
            day={day}
            onSelect={setSelected}
            highlightId={highlightId}
            zoomFactor={zoom}
            onEmptyCell={(col, startMin) => setCellChoice({ col, startMin })}
            onMoveBooking={moveBooking}
            onSelectBlock={selectBlock}
            onSelectMaster={
              mode === 'day'
                ? (col) => {
                    setWeekEmpId(col.id)
                    setMode('week')
                  }
                : undefined
            }
          />
        )}
        {loading && (
          <div className="absolute inset-0 z-40 flex items-start justify-center rounded-xl bg-white/60 pt-20">
            <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-md">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
              <span className="text-sm font-medium text-gray-600">Načítám…</span>
            </div>
          </div>
        )}
        {error && !day && <p className="text-sm text-red-600">{error}</p>}

        {/* ── Мобильные оверлеи (Noona-паттерн), на sm+ скрыты ── */}

        {/* Зум грида +/− (слева внизу) — на любом тач-устройстве (телефон/планшет) */}
        {coarse && (
          <div className="absolute bottom-[4.5rem] left-3 z-40 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg sm:bottom-4">
            <button
              type="button"
              onClick={() => changeZoom(1)}
              disabled={zoom >= 2.2}
              aria-label="Přiblížit"
              className="flex h-11 w-11 items-center justify-center text-[20px] leading-none text-gray-700 active:bg-gray-100 disabled:opacity-30"
            >
              +
            </button>
            <div className="border-t border-gray-200" />
            <button
              type="button"
              onClick={() => changeZoom(-1)}
              disabled={zoom <= 0.7}
              aria-label="Oddálit"
              className="flex h-11 w-11 items-center justify-center text-[20px] leading-none text-gray-700 active:bg-gray-100 disabled:opacity-30"
            >
              −
            </button>
          </div>
        )}

        {/* FAB «+ Rezervace» (справа над пилюлей даты; на sm+ кнопка в тулбаре) */}
        <button
          type="button"
          onClick={() => openNewBooking()}
          aria-label="Nová rezervace"
          className="absolute bottom-[4.5rem] right-3 z-40 flex h-12 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-white shadow-lg active:brightness-90 sm:hidden"
        >
          {/* ⚠️ НЕ text-xl — в admin-конфиге это 71px (гоча s42) */}
          <span className="text-[20px] leading-none">+</span> Rezervace
        </button>

        {/* Пилюля даты внизу по центру: ‹ Pondělí 13. 7. 2026 › — тап по дате
            открывает нативный пикер (невидимый input поверх лейбла) */}
        <div className="absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center overflow-hidden rounded-full border border-gray-200 bg-white shadow-lg sm:hidden">
          <button
            type="button"
            onClick={() => setDate(shiftDate(date, mode === 'week' ? -7 : -1))}
            aria-label="Předchozí"
            className="flex h-11 w-11 items-center justify-center text-gray-700 active:bg-gray-100"
          >
            ‹
          </button>
          <div className="relative">
            <span className="block min-w-[10rem] px-1 text-center text-sm font-semibold text-gray-800">
              {dateLabelCs(date)}
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="Datum"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
          <button
            type="button"
            onClick={() => setDate(shiftDate(date, mode === 'week' ? 7 : 1))}
            aria-label="Další"
            className="flex h-11 w-11 items-center justify-center text-gray-700 active:bg-gray-100"
          >
            ›
          </button>
        </div>
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
          onReschedule={() => selected && setReschedule(selected)}
          onDelete={deleteBooking}
          busy={mutating}
        />
      )}
      {reschedule && (
        <RescheduleModal
          booking={reschedule}
          employees={employees}
          onClose={() => setReschedule(null)}
          onMoved={(newDate) => {
            // как переход из истории: закрыть drawer, показать день брони, мигнуть 3 с
            const docId = reschedule.documentId
            setReschedule(null)
            setSelected(null)
            setHighlightId(docId)
            if (highlightTimer.current) clearTimeout(highlightTimer.current)
            highlightTimer.current = setTimeout(() => setHighlightId(null), 3000)
            if (mode !== 'day' || newDate !== date) {
              setMode('day')
              setDate(newDate)
            } else {
              reload()
            }
          }}
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
          slotFit={slotFit}
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
