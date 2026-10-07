// «Кто сегодня работает» для дашборда «Сегодня» (s214): из дня календаря.
//
// Расписания мастера как сущности нет: рабочее время = окно дня минус
// ДЕЙСТВУЮЩИЕ блоки (approved или легаси без статуса; pending/rejected время не
// занимают — как в движке). Загрузка = время живых броней (не отменённых;
// noshow тоже занимал время) / рабочее время. Интерная бронь время мастера не
// занимает (s204) — в загрузку не идёт, но в счётчике визитов видна отдельно.
// Колонки «бывших мастеров» (orphan:) в список не попадают.
// s245: три интервала дня (как в дайджесте): салон (окно дня), «открыто для записи»
// (окно минус действующие блоки — от самого раннего до самого позднего свободного куска
// по всем мастерам) и «фактически» (первая–последняя клиентская бронь, окном не режется).
import { isActiveStatus } from '../../../lib/bookingStatus'
import { isoToMinPrague } from '../../../utils/date'
import { isInternalBooking, type CalendarDay } from '../../calendar/fetch/calendarDay'

/** Меньше этого рабочего времени — считаем, что мастер сегодня не работает. */
export const OFF_DAY_MIN = 30

export interface MasterToday {
  id: string
  name: string
  visits: number
  internal: number
  bookedMin: number
  availableMin: number
  /** null — рабочего времени нет (выходной/блок на весь день) */
  loadPct: number | null
  off: boolean
  firstMin: number | null
  lastMin: number | null
}

export interface DayExtents {
  salon: Iv | null
  /** от первого до последнего свободного куска по всем мастерам; null — записаться не к кому */
  open: Iv | null
  /** первая–последняя клиентская бронь; null — броней нет */
  actual: Iv | null
}

export interface WorkingToday {
  masters: MasterToday[]
  bookedMin: number
  availableMin: number
  loadPct: number | null
  extents: DayExtents
}

export type Iv = [number, number]

/** Объединение интервалов, обрезанных окном [lo, hi]. */
export const unionClipped = (ivs: Iv[], lo: number, hi: number): Iv[] => {
  const cut = ivs
    .map(([s, e]): Iv => [Math.max(s, lo), Math.min(e, hi)])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])
  const out: Iv[] = []
  for (const iv of cut) {
    const last = out[out.length - 1]
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
    else out.push([iv[0], iv[1]])
  }
  return out
}

const total = (ivs: Iv[]) => ivs.reduce((s, [a, b]) => s + (b - a), 0)

/** Длина A минус пересечение с B (оба — уже объединённые). */
const minusLen = (a: Iv[], b: Iv[]): number => {
  let len = total(a)
  for (const [s1, e1] of a) for (const [s2, e2] of b) len -= Math.max(0, Math.min(e1, e2) - Math.max(s1, s2))
  return len
}

const pct = (booked: number, available: number): number | null =>
  available > 0 ? Math.round((booked / available) * 100) : null

/** Окно [lo, hi] минус уже объединённые интервалы → свободные куски. */
const freeIn = (lo: number, hi: number, busy: Iv[]): Iv[] => {
  const out: Iv[] = []
  let cursor = lo
  for (const [s, e] of busy) {
    if (s > cursor) out.push([cursor, Math.min(s, hi)])
    cursor = Math.max(cursor, e)
    if (cursor >= hi) break
  }
  if (cursor < hi) out.push([cursor, hi])
  return out
}

const extent = (ivs: Iv[]): Iv | null => (ivs.length ? [Math.min(...ivs.map((i) => i[0])), Math.max(...ivs.map((i) => i[1]))] : null)

/** Три интервала дня по уже посчитанным мастерам и их свободным кускам. */
export const dayExtents = (openMin: number, closeMin: number, free: Iv[], masters: Pick<MasterToday, 'firstMin' | 'lastMin'>[]): DayExtents => {
  const booked: Iv[] = []
  for (const m of masters) if (m.firstMin != null && m.lastMin != null && m.lastMin > m.firstMin) booked.push([m.firstMin, m.lastMin])
  return { salon: closeMin > openMin ? [openMin, closeMin] : null, open: closeMin > openMin ? extent(free) : null, actual: extent(booked) }
}

export function summarizeDay(day: CalendarDay): WorkingToday {
  const { openMin, closeMin } = day
  const masters: MasterToday[] = []
  const free: Iv[] = []
  for (const col of day.columns) {
    if (col.id.startsWith('orphan:')) continue
    const blocks = unionClipped(
      col.blocks.filter((b) => !b.approval || b.approval === 'approved').map((b): Iv => [b.startMin, b.endMin]),
      openMin,
      closeMin,
    )
    const availableMin = closeMin - openMin - total(blocks)
    free.push(...freeIn(openMin, closeMin, blocks))
    const live = col.bookings.filter((b) => isActiveStatus(b.status))
    const client = live.filter((b) => !isInternalBooking(b))
    const ivs: Iv[] = []
    for (const b of client) {
      const s = isoToMinPrague(b.startsAt)
      const e = isoToMinPrague(b.endsAt)
      if (s != null && e != null && e > s) ivs.push([s, e])
    }
    const booked = unionClipped(ivs, openMin, closeMin)
    // бронь поверх блока (перенос, ручной овербук) не должна дать загрузку > рабочего времени
    const bookedMin = minusLen(booked, blocks)
    masters.push({
      id: col.id,
      name: col.name,
      visits: client.length,
      internal: live.length - client.length,
      bookedMin,
      availableMin,
      loadPct: pct(bookedMin, availableMin),
      off: availableMin < OFF_DAY_MIN && client.length === 0,
      firstMin: ivs.length ? Math.min(...ivs.map((i) => i[0])) : null,
      lastMin: ivs.length ? Math.max(...ivs.map((i) => i[1])) : null,
    })
  }
  const working = masters.filter((m) => !m.off)
  const bookedMin = working.reduce((s, m) => s + m.bookedMin, 0)
  const availableMin = working.reduce((s, m) => s + Math.max(0, m.availableMin), 0)
  return { masters, bookedMin, availableMin, loadPct: pct(bookedMin, availableMin), extents: dayExtents(openMin, closeMin, free, masters) }
}
