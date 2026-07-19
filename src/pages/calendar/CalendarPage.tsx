// Календарь администраторов (own-booking). Данные — ТОЛЬКО из нашей локальной БД
// (booking/salon-hour/time-block/personal), Noona не участвует. Дневной + недельный
// вид. WRITE через собственный движок (/api/engine/admin/*): drag-and-drop перенос,
// статусы в drawer, модалы «+ Rezervace» / «+ Blok», удаление own-блоков.
// Обновление: polling 25 с (тихий reload), после мутаций — немедленный reload.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessionRole } from '../../services/auth'
import type {
  AdminRoster,
  BlockedRange,
  CalendarBooking,
  CalendarDay,
  CalendarEmployee,
  ClientHistoryItem,
  MasterColumn,
} from './fetch/calendarDay'
import {
  busyIntervals,
  fetchAdminRoster,
  fetchCalendarDay,
  fetchCalendarWeek,
  fetchWeekEmployees,
} from './fetch/calendarDay'
import { AdminShiftBar } from './AdminShiftBar'
import {
  engineApplyRedemption,
  engineDeleteBooking,
  enginePatchBooking,
  engineReleaseRedemption,
  engineRemoveRebookDiscount,
  engineRestoreRebookDiscount,
  updateClientBlacklist,
} from './fetch/engineApi'
import { fetchBookingLabels, type BookingLabel } from './fetch/bookingLabels'
import { CalendarGrid } from './CalendarGrid'
import { BookingDrawer } from './BookingDrawer'
import { InstallAppButton } from './InstallAppButton'
import { NotificationButton } from './NotificationButton'
import { useCoarsePointer } from './useMediaQuery'
import { IconArrowLeft, IconHistory, IconMoon, IconSearch, IconSun } from './icons'
import { fmtHM, fmtTime, mondayOf, shiftDate, todayStr, type Mode } from './utils'
import {
  AuditLogModal,
  CellActionModal,
  ChangeServiceModal,
  ClientSearchModal,
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

// «14. 7. – 20. 7. 2026» — подпись недели Пн–Вс (для мастера вместо конкретной даты)
const weekLabelCs = (d: string): string => {
  const mon = mondayOf(d)
  const [y, m, dd] = mon.split('-').map(Number)
  const end = new Date(y, m - 1, dd + 6)
  return `${dd}. ${m}. – ${end.getDate()}. ${end.getMonth() + 1}. ${end.getFullYear()}`
}

// Короткие подписи для нижней панели телефона: «Pá 17. 7.» / «14. 7. – 20. 7.»
// (в узкой панели рядом с кнопками полная подпись с годом не помещается)
const WEEKDAYS_SHORT_CS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So']
const dateLabelShortCs = (d: string): string => {
  const [, m, dd] = d.split('-')
  return `${WEEKDAYS_SHORT_CS[new Date(`${d}T00:00:00`).getDay()]} ${+dd}. ${+m}.`
}
const weekLabelShortCs = (d: string): string => {
  const mon = mondayOf(d)
  const [y, m, dd] = mon.split('-').map(Number)
  const end = new Date(y, m - 1, dd + 6)
  const endM = end.getMonth() + 1
  // в пределах месяца — «13.–19. 7.», через границу — «29. 6.–5. 7.»
  return m === endM ? `${dd}.–${end.getDate()}. ${m}.` : `${dd}. ${m}.–${end.getDate()}. ${endM}.`
}

export default function CalendarPage() {
  const navigate = useNavigate()
  // Роль: master видит ТОЛЬКО свой недельный календарь, read-only (без броней/блоков/статусов)
  const role = getSessionRole()
  const isMaster = role === 'master'
  // журнал действий календаря видит ТОЛЬКО владелец (оверсайт над админами)
  const isOwner = role === 'owner'
  // тач-устройство (телефон/планшет) — там показываем кнопки зума грида
  const coarse = useCoarsePointer()
  // Параметры из push-нотификации (?date=YYYY-MM-DD&highlight=<bookingDocId>):
  // открыть календарь сразу на дне брони и мигнуть её карточкой (см. sw.js)
  const bootParams = useRef<{ date: string | null; highlight: string | null } | null>(null)
  if (bootParams.current === null) {
    const p = new URLSearchParams(window.location.search)
    const d = p.get('date') || ''
    bootParams.current = {
      date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null,
      highlight: p.get('highlight'),
    }
  }
  const [date, setDate] = useState(bootParams.current.date || todayStr())
  const [mode, setMode] = useState<Mode>(isMaster ? 'week' : 'day')
  const [day, setDay] = useState<CalendarDay | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<CalendarBooking | null>(null)
  // график дежурных админов на показанную неделю (плашка «кто открыт», все роли)
  const [adminRoster, setAdminRoster] = useState<AdminRoster>({})
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
  // модал глобального поиска клиента (история/контакты/blacklist, admin-only)
  const [clientSearch, setClientSearch] = useState(false)
  // журнал действий календаря (owner-only)
  const [showLog, setShowLog] = useState(false)
  // мобильное меню «⋯» тулбара (второстепенные действия: + Blok, ⇅ Pořadí)
  const [moreOpen, setMoreOpen] = useState(false)
  // вертикальный зум грида (кнопки +/− на мобиле, как в Noona); живёт между сессиями
  const [zoom, setZoom] = useState(() => {
    const v = Number(localStorage.getItem('bb_cal_zoom'))
    return v >= 0.4 && v <= 2.2 ? v : 1
  })
  const changeZoom = (dir: 1 | -1) =>
    setZoom((z) => {
      const next = Math.min(2.2, Math.max(0.4, +(z + dir * 0.3).toFixed(1)))
      localStorage.setItem('bb_cal_zoom', String(next))
      return next
    })
  // Тема календаря (light/dark): выбор живёт между сессиями; дефолт — системная.
  // Класс `dark` вешается на корень страницы → dark:-варианты Tailwind (darkMode: class)
  const [calTheme, setCalTheme] = useState<'light' | 'dark'>(() => {
    const s = localStorage.getItem('bb_cal_theme')
    if (s === 'dark' || s === 'light') return s
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const toggleTheme = () =>
    setCalTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      localStorage.setItem('bb_cal_theme', next)
      return next
    })
  // подсветка брони после перехода из истории клиента (мигает 3 сек);
  // стартовое значение — из пуша (?highlight=), гасится эффектом ниже
  const [highlightId, setHighlightId] = useState<string | null>(bootParams.current.highlight)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Подсветка из пуша: держим дольше (6 с — данные дня ещё грузятся), затем чистим
  // query из URL, чтобы обновление страницы не прыгало на тот же день заново
  useEffect(() => {
    if (bootParams.current?.highlight) {
      highlightTimer.current = setTimeout(() => setHighlightId(null), 6000)
    }
    if (window.location.search) navigate(window.location.pathname, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // смена услуги открытой брони (модал «Změnit službu»)
  const [changeService, setChangeService] = useState<CalendarBooking | null>(null)
  // перенос открытой брони из drawer (модал «Změnit termín»: дата/время/мастер)
  const [reschedule, setReschedule] = useState<CalendarBooking | null>(null)

  useEffect(() => {
    fetchBookingLabels().then(setLabels).catch(() => {})
  }, [])

  // master без привязанного personal (имя не совпало) — показываем подсказку вместо грида
  const [masterMissing, setMasterMissing] = useState(false)

  // Список мастеров для недельного селектора (один раз).
  // Для роли master — оставляем ТОЛЬКО его самого (матч personal.name по username,
  // тот же принцип, что getWorks в кабинете мастера).
  useEffect(() => {
    fetchWeekEmployees()
      .then((emps) => {
        if (isMaster) {
          const uname = (localStorage.getItem('usernameLocalData') || '').trim().toLowerCase()
          const own = emps.find((e) => e.name.trim().toLowerCase() === uname)
          setEmployees(own ? [own] : [])
          setWeekEmpId(own?.id || '')
          setMasterMissing(!own)
        } else {
          setEmployees(emps)
          setWeekEmpId((cur) => cur || emps[0]?.id || '')
        }
      })
      .catch(() => setEmployees([]))
  }, [isMaster])

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

  // График дежурных админов недели, в которую попала показанная дата (одна запись
  // shift = неделя, покрывает оба вида). Видно всем ролям; сбой → пустой график.
  useEffect(() => {
    const monday = mondayOf(date)
    let cancelled = false
    fetchAdminRoster(monday).then((r) => {
      if (!cancelled) setAdminRoster(r)
    })
    return () => {
      cancelled = true
    }
  }, [date])

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

  // note (Zrušit/Nepřišla) — дописывается к существующей позна́мке брони новой строкой
  const patchStatus = async (status: CalendarBooking['status'], notify?: boolean, note?: string) => {
    if (!selected) return
    const trimmed = (note || '').trim()
    setMutating(true)
    try {
      await enginePatchBooking(selected.documentId, {
        status,
        ...(notify ? { notify: true } : {}),
        ...(trimmed
          ? { comment: selected.comment ? `${selected.comment}\n${trimmed}` : trimmed }
          : {}),
      })
      setSelected(null)
      await reload()
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setMutating(false)
    }
  }

  // свободная интерн-позна́мка из карточки «Poznámka» (drawer остаётся открытым)
  const saveComment = async (comment: string) => {
    if (!selected) return
    setMutating(true)
    try {
      await enginePatchBooking(selected.documentId, { comment })
      setSelected({ ...selected, comment: comment || null })
      await reload(true)
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setMutating(false)
    }
  }

  // блэклист клиента (карточка Kontakt): пишется в client напрямую (не в бронь);
  // блокирует ТОЛЬКО записи с сайта — движковый чек 403 blacklisted
  const toggleBlacklist = async (next: boolean) => {
    const clientDocId = selected?.client?.documentId
    if (!selected || !clientDocId) return
    setMutating(true)
    try {
      await updateClientBlacklist(clientDocId, next)
      setSelected({ ...selected, client: { ...selected.client, blacklisted: next } })
      await reload(true)
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

  // bitchcard (walk-in К4): уплатнить награду клиента на бронь — цена пересчитывается
  // на сервере в одной транзакции с redemption→used; drawer остаётся открытым
  // (обновлённый totalPrice в selected сам рефетчит карточку Bitchcard)
  const applyRedemption = async (code: string) => {
    if (!selected) return
    setMutating(true)
    try {
      const res = await engineApplyRedemption(selected.documentId, code)
      setSelected({ ...selected, totalPrice: res.totalPrice })
      await reload(true)
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setMutating(false)
    }
  }

  // снять ошибочно применённую скидку: redemption → available, цена возвращается
  const releaseRedemption = async () => {
    if (!selected) return
    setMutating(true)
    try {
      const res = await engineReleaseRedemption(selected.documentId)
      const restored =
        selected.totalPrice != null && res.discountKc
          ? selected.totalPrice + res.discountKc
          : selected.totalPrice
      setSelected({ ...selected, totalPrice: restored })
      await reload(true)
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setMutating(false)
    }
  }

  // скидка дозаписи (rebook −15% с thank-you): снять / вернуть — цена и discount
  // меняются транзакционно на сервере; drawer остаётся открытым (selected обновляется)
  const removeRebookDiscount = async () => {
    if (!selected) return
    setMutating(true)
    try {
      const res = await engineRemoveRebookDiscount(selected.documentId)
      setSelected({
        ...selected,
        totalPrice: res.totalPrice ?? selected.totalPrice,
        discount: selected.discount ? { ...selected.discount, applied: false } : selected.discount,
      })
      await reload(true)
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setMutating(false)
    }
  }

  const restoreRebookDiscount = async () => {
    if (!selected) return
    setMutating(true)
    try {
      const res = await engineRestoreRebookDiscount(selected.documentId)
      setSelected({
        ...selected,
        totalPrice: res.totalPrice ?? selected.totalPrice,
        discount: selected.discount ? { ...selected.discount, applied: true } : selected.discount,
      })
      await reload(true)
    } catch (e) {
      window.alert((e as Error).message)
    } finally {
      setMutating(false)
    }
  }

  // отметка «клиент dorazil» (промежуточный шаг перед Proběhla): drawer остаётся
  // открытым — обновляем selected + грид (зелёный лейбл), кнопка меняется на «Proběhla»
  const patchArrived = async () => {
    if (!selected) return
    setMutating(true)
    try {
      await enginePatchBooking(selected.documentId, { arrived: true })
      setSelected({ ...selected, arrived: true })
      await reload(true)
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
  // (master остаётся в своём недельном виде — просто листаем на неделю той брони)
  const openHistoryBooking = (r: ClientHistoryItem) => {
    setSelected(null)
    if (!isMaster) setMode('day')
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

  // Домашняя страница по роли
  const goHome = () => {
    if (role === 'administrator') navigate('/administrator-cabinet')
    else if (role === 'master') navigate('/')
    else navigate('/global')
  }

  // Кнопка тулбара: на тач-экране ≥44px высоты, на десктопе компактная (как раньше)
  const tbBtn =
    'inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-semibold sm:min-h-[34px]'
  // Нейтральная кнопка тулбара, тема-aware: светлая тема — белая с рамкой (как было),
  // тёмная — приглушённая #252523 (тон карточек клиентской резервации); акцент
  // в обеих темах остаётся только у «+ Rezervace»
  const tbNeutral = `${tbBtn} border border-gray-300 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-[#3f3f3d] dark:bg-[#252523] dark:text-gray-200 dark:shadow-none dark:hover:bg-[#343431] dark:hover:text-white`
  // тема-aware классы нативных контролов (date input / select)
  const tbInput =
    'rounded-md border border-gray-300 bg-white text-sm text-gray-900 dark:border-[#3f3f3d] dark:bg-[#252523] dark:text-gray-100 dark:[color-scheme:dark]'
  // Кнопка нижней панели (телефон): видимая рамка + крупная тач-цель
  const mbBtn =
    'flex h-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white leading-none text-gray-700 shadow-sm active:bg-gray-100 dark:border-[#3f3f3d] dark:bg-[#2a2a28] dark:text-gray-200 dark:shadow-none dark:active:bg-[#343431]'
  // пункт мобильного меню «⋯»
  const menuItemCls =
    'flex min-h-11 w-full items-center px-4 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-[#343431]'

  return (
    // Страница = вся высота окна (dvh — iOS-safe): тулбар фикс, грид скроллится внутри
    // Класс `dark` на корне включает dark:-варианты всего календаря (тема-переключатель)
    <div className={`${calTheme === 'dark' ? 'dark' : ''} flex h-[100dvh] w-full flex-col bg-white dark:bg-[#161615]`}>
      {/* Тулбар — ТОЛЬКО sm+ (десктоп/планшет): на телефоне всё управление живёт
          в нижней панели (у большого пальца), сверху остаётся максимум места гриду.
          Паддинг только у тулбара, грид ниже идёт от края до края. Тёмная тема —
          #161615 (фон страницы резервации клиента) */}
      <div className="hidden shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-2 py-2.5 dark:border-[#2e2e2c] dark:bg-[#161615] sm:flex md:px-4">
          {/* Возврат на главную (страница без общего хедера) */}
          <button
            type="button"
            onClick={goHome}
            aria-label="Domů"
            className={`${tbNeutral} sm:mr-2`}
          >
            <IconArrowLeft />
            <span className="ml-1.5 hidden sm:inline">Domů</span>
          </button>
          {/* ◀ дата ▶ — только десктоп; на мобиле — нижняя пилюля (как в Noona) */}
          <button
            type="button"
            onClick={() => setDate(shiftDate(date, mode === 'week' ? -7 : -1))}
            className={`${tbNeutral} hidden sm:inline-flex`}
          >
            ◀
          </button>
          {/* master листает неделями — вместо пикера конкретной даты подпись недели */}
          {isMaster ? (
            <span className="hidden whitespace-nowrap text-sm font-semibold text-gray-800 sm:block">
              {weekLabelCs(date)}
            </span>
          ) : (
            // подпись с днём недели без года («Pá 17. 7.»); нативный пикер — невидимым
            // инпутом поверх (тап/клик открывает календарь)
            <div className="relative hidden sm:block">
              <span
                className={`${tbInput} flex min-h-[34px] items-center whitespace-nowrap px-3 py-1 text-sm font-semibold`}
              >
                {dateLabelShortCs(date)}
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                aria-label="Datum"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => setDate(shiftDate(date, mode === 'week' ? 7 : 1))}
            className={`${tbNeutral} hidden sm:inline-flex`}
          >
            ▶
          </button>
          <button type="button" onClick={() => setDate(todayStr())} className={tbNeutral}>
            Dnes
          </button>
          {/* Счётчик — только sm+ (мобильный верх минимальный, как в Noona) */}
          <span className="hidden whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 sm:inline">
            <b className="dark:text-gray-200">{totals.total}</b> rezervací
          </span>
          {/* Установка календаря как PWA-приложения на телефон (видна только вне
              установленного приложения и только когда установка доступна) */}
          <InstallAppButton className={tbNeutral} />
          {/* Web Push: уведомления о бронях к этому мастеру (и админу) на телефон */}
          <NotificationButton className={tbNeutral} />
          {/* Глобальный поиск клиента (историe / kontakt / blacklist) — только админ:
              мастер видит лишь свои брони, чужие данные клиентов ему не показываем */}
          {!isMaster && (
            <button
              type="button"
              onClick={() => setClientSearch(true)}
              title="Hledat klienta — jméno, telefon nebo e-mail"
              className={tbNeutral}
            >
              <IconSearch />
              <span className="ml-1.5">Klient</span>
            </button>
          )}
          {/* Deník kalendáře — журнал действий админов; ТОЛЬКО владелец (оверсайт) */}
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowLog(true)}
              title="Deník kalendáře — historie akcí administrátorů"
              className={tbNeutral}
            >
              <IconHistory />
              <span className="ml-1.5">Deník</span>
            </button>
          )}

          {/* Режим задаётся кликом: в дневном виде — клик по имени мастера в шапке
              открывает его неделю; в недельном — селектор мастера + «Všichni mistři»
              (возврат в дневной вид всех мастеров). Отдельного тогла Den/Týden нет. */}
          {mode === 'week' && !isMaster && (
            <select
              value={weekEmpId}
              onChange={(e) => {
                if (e.target.value === '__all__') setMode('day')
                else setWeekEmpId(e.target.value)
              }}
              className={`${tbInput} min-h-11 min-w-0 flex-1 px-2 py-1.5 font-semibold sm:min-h-[34px] sm:flex-none`}
            >
              <option value="__all__">← Všichni mistři (denní)</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          )}
          {/* master: вместо селектора — его имя (переключать мастера нельзя) */}
          {isMaster && employees[0] && (
            <span className="truncate text-sm font-semibold text-gray-800 dark:text-gray-300">
              {employees[0].name}
            </span>
          )}
          {/* Переключатель темы календаря (light/dark, живёт в localStorage) */}
          <button
            type="button"
            onClick={toggleTheme}
            title={calTheme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}
            aria-label="Přepnout vzhled"
            className={tbNeutral}
          >
            {calTheme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>

          

          

          {/* Write-действия — только owner/administrator; master = read-only */}
          {!isMaster && (
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
              className={`${tbNeutral} hidden sm:inline-flex`}
            >
              + Blok
            </button>
            <button
              type="button"
              onClick={() => setOrderModal(true)}
              title="Pořadí sloupců mistrů"
              className={`${tbNeutral} hidden sm:inline-flex`}
            >
              ⇅ Pořadí
            </button>
          </div>
          )}
      </div>

      {/* Мобила: селектор мастера недельного вида — тулбар сверху скрыт, а без
          селектора из чужой недели нельзя вернуться к «Všichni mistři» */}
      {mode === 'week' && !isMaster && (
        <div className="mb-2 shrink-0 sm:hidden">
          <select
            value={weekEmpId}
            onChange={(e) => {
              if (e.target.value === '__all__') setMode('day')
              else setWeekEmpId(e.target.value)
            }}
            className={`${tbInput} min-h-11 w-full px-2 py-1.5 font-semibold`}
          >
            <option value="__all__">← Všichni mistři (denní)</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Кто в этот день администратор (график shift) — информативно, для всех ролей */}
      <AdminShiftBar roster={adminRoster} date={date} mode={mode} />

      {/* Грид скроллится внутри собственной области (sticky ось/шапки живут там);
          при переключении дня остаётся на месте — поверх появляется лоадер */}
      <div className="relative min-h-0 flex-1">
        {day && (
          <CalendarGrid
            day={day}
            onSelect={setSelected}
            highlightId={highlightId}
            zoomFactor={zoom}
            onEmptyCell={isMaster ? undefined : (col, startMin) => setCellChoice({ col, startMin })}
            onMoveBooking={isMaster ? undefined : moveBooking}
            onSelectBlock={isMaster ? undefined : selectBlock}
            onSelectMaster={
              mode === 'day' && !isMaster
                ? (col) => {
                    setWeekEmpId(col.id)
                    setMode('week')
                  }
                : undefined
            }
            masterRate={isMaster ? (employees[0]?.ratePercent ?? null) : null}
          />
        )}
        {/* master, чей personal не найден по username — календарь показать нечего */}
        {isMaster && masterMissing && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            Váš kalendář se nepodařilo propojit (jméno uživatele neodpovídá žádnému mistrovi).
            Kontaktujte prosím administrátora.
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 z-40 flex items-start justify-center rounded-xl bg-white/60 pt-20 dark:bg-black/40">
            <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-md dark:bg-[#252523]">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary dark:border-[#4a4a48]" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Načítám…</span>
            </div>
          </div>
        )}
        {error && !day && <p className="text-sm text-red-600">{error}</p>}

        {/* ── Мобильные оверлеи (Noona-паттерн), на sm+ скрыты ── */}

        {/* Зум грида +/− (слева внизу) — на любом тач-устройстве (телефон/планшет) */}
        {coarse && (
          <div className="absolute bottom-[4.5rem] left-3 z-40 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-[#3f3f3d] dark:bg-[#2a2a28] sm:bottom-4">
            <button
              type="button"
              onClick={() => changeZoom(1)}
              disabled={zoom >= 2.2}
              aria-label="Přiblížit"
              className="flex h-11 w-11 items-center justify-center text-[20px] leading-none text-gray-700 active:bg-gray-100 disabled:opacity-30 dark:text-gray-200 dark:active:bg-[#343431]"
            >
              +
            </button>
            <div className="border-t border-gray-200 dark:border-[#3f3f3d]" />
            <button
              type="button"
              onClick={() => changeZoom(-1)}
              disabled={zoom <= 0.4}
              aria-label="Oddálit"
              className="flex h-11 w-11 items-center justify-center text-[20px] leading-none text-gray-700 active:bg-gray-100 disabled:opacity-30 dark:text-gray-200 dark:active:bg-[#343431]"
            >
              −
            </button>
          </div>
        )}

        {/* FAB «+ Rezervace» (справа над пилюлей даты; на sm+ кнопка в тулбаре) */}
        {!isMaster && (
          <button
            type="button"
            onClick={() => openNewBooking()}
            aria-label="Nová rezervace"
            className="absolute bottom-[4.5rem] right-3 z-40 flex h-12 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-white shadow-lg active:brightness-90 sm:hidden"
          >
            {/* ⚠️ НЕ text-xl — в admin-конфиге это 71px (гоча s42) */}
            <span className="text-[20px] leading-none">+</span> Rezervace
          </button>
        )}

        {/* Нижняя панель управления (телефон): ← Domů / Dnes / ‹ дата › / Instalovat /
            Upozornění / ⋯ — весь бывший верхний тулбар у большого пальца. Тап по дате
            открывает нативный пикер (невидимый input поверх лейбла). Низ грида
            подгоняется к верхнему краю этой панели (fit-масштаб в CalendarGrid). */}
        <div className="absolute inset-x-1 bottom-2 z-40 flex items-center gap-1 rounded-2xl border border-gray-200 bg-white px-1 py-1 shadow-lg dark:border-[#333331] dark:bg-[#1f1f1e] sm:hidden">
          <button
            type="button"
            onClick={goHome}
            aria-label="Domů"
            className={`${mbBtn} w-10`}
          >
            <IconArrowLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => setDate(todayStr())} className={`${mbBtn} px-2 text-[13px] font-bold`}>
            Dnes
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => setDate(shiftDate(date, mode === 'week' ? -7 : -1))}
              aria-label="Předchozí"
              className={`${mbBtn} w-10 text-[22px]`}
            >
              ‹
            </button>
            <div className="relative min-w-0">
              <span className="block truncate px-0.5 text-center text-sm font-semibold text-gray-800 dark:text-gray-300">
                {isMaster ? weekLabelShortCs(date) : dateLabelShortCs(date)}
              </span>
              {/* master листает целыми неделями — нативный пикер конкретной даты не нужен */}
              {!isMaster && (
                <input
                  type="date"
                  value={date}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  aria-label="Datum"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => setDate(shiftDate(date, mode === 'week' ? 7 : 1))}
              aria-label="Další"
              className={`${mbBtn} w-10 text-[22px]`}
            >
              ›
            </button>
          </div>
          <InstallAppButton popup="up" className={`${mbBtn} w-10 text-[16px]`} />
          {/* «⋯» — все роли: Upozornění (push) для всех + write-действия; меню ВВЕРХ */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="Další akce"
              className={`${mbBtn} w-10 text-[18px]`}
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
                <div className="absolute bottom-full right-0 z-50 mb-2 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-[#3f3f3d] dark:bg-[#252523]">
                  {/* Пуш-уведомления (меню не закрываем — кнопка может показать подсказку) */}
                  <NotificationButton popup="up" menuItem className={menuItemCls} />
                  {/* Переключатель темы (на мобиле верхний тулбар скрыт) */}
                  <button type="button" onClick={toggleTheme} className={menuItemCls}>
                    {calTheme === 'dark' ? <IconSun /> : <IconMoon />}
                    <span className="ml-2">{calTheme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}</span>
                  </button>
                  {/* Deník kalendáře — журнал действий; только владелец */}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false)
                        setShowLog(true)
                      }}
                      className={menuItemCls}
                    >
                      <IconHistory />
                      <span className="ml-2">Deník kalendáře</span>
                    </button>
                  )}
                  {!isMaster && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMoreOpen(false)
                          setClientSearch(true)
                        }}
                        className={menuItemCls}
                      >
                        <IconSearch />
                        <span className="ml-2">Hledat klienta</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMoreOpen(false)
                          setBlockModal({ date })
                        }}
                        className={menuItemCls}
                      >
                        + Blok
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMoreOpen(false)
                          setOrderModal(true)
                        }}
                        className={menuItemCls}
                      >
                        ⇅ Pořadí sloupců
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <BookingDrawer
          b={selected}
          labels={labels}
          onClose={() => setSelected(null)}
          onStatus={patchStatus}
          onSaveComment={saveComment}
          onToggleBlacklist={toggleBlacklist}
          onArrived={patchArrived}
          onLabel={patchLabel}
          onManageLabels={() => setManageLabels(true)}
          onOpenHistory={openHistoryBooking}
          onChangeService={() => selected && setChangeService(selected)}
          onReschedule={() => selected && setReschedule(selected)}
          onDelete={deleteBooking}
          onApplyRedemption={applyRedemption}
          onReleaseRedemption={releaseRedemption}
          onRemoveRebookDiscount={removeRebookDiscount}
          onRestoreRebookDiscount={restoreRebookDiscount}
          busy={mutating}
          readOnly={isMaster}
          masterRate={isMaster ? (employees[0]?.ratePercent ?? null) : null}
          // Мастеру — история клиента только по ЕГО броням (визиты к другим мастерам
          // не показываем). Фолбэк на мастера самой брони = он же (мастер видит
          // только свою колонку); '__none__' — fail-closed, если id вдруг нет.
          historyEmployeeId={
            isMaster ? employees[0]?.id || selected.noonaEmployeeId || '__none__' : null
          }
        />
      )}
      {reschedule && (
        <RescheduleModal
          booking={reschedule}
          employees={employees}
          slotFit={slotFit}
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

      {clientSearch && (
        <ClientSearchModal
          onClose={() => setClientSearch(false)}
          onOpenBooking={(r) => {
            // как клик из истории drawer'а: закрыть, перейти на день брони, мигнуть
            setClientSearch(false)
            openHistoryBooking(r)
          }}
        />
      )}

      {showLog && <AuditLogModal onClose={() => setShowLog(false)} />}

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
