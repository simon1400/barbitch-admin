import { todayYmd } from '../../../../utils/date'
import { fetchAnalyticsHistory, fetchMirrorEmployees } from '../../../../lib/mirror'

// Общий кэш ВСЕЙ истории броней — используется табами «Спящие», «Возвращаемость»,
// «Прогноз», «Отмены», «Клиенты», результатами кампаний/дозаписей. Один fetch на 5 минут.
//
// own-booking фаза 4: источник — НАША БД (коллекция booking: зеркало Noona + записи
// собственного движка), Noona API здесь больше не участвует. Бонусы против Noona-версии:
//   - customerName = ТЕКУЩЕЕ имя клиента (relation), а не снимок на момент брони (боль s97);
//   - customer = noonaCustomerId (совместимость с историей email-campaign-log) или
//     documentId для клиентов, созданных уже нашим движком;
//   - будущие брони в кэше автоматически (зеркало живёт по синку, без «до 1 января»).
//
// Аудит s184: проекция переехала на сервер. Раньше сюда постранично приезжали ВСЕ
// брони со снапшотами услуг и вложенным клиентом (~10 запросов, ~2.9 МБ JSON), а
// использовались восемь скалярных полей. Теперь их считает движок и отдаёт одним
// колоночным ответом. ⚠️ Порядок колонок задан сервером (HISTORY_COLS в
// strapi/src/api/booking-engine/services/admin-analytics.ts) — читаем ПО ИМЕНАМ
// из `cols`, чтобы рассинхрон версий не превратился в тихо перепутанные поля.

export interface HistEvent {
  customer: string
  customerName: string
  employee: string
  status: string
  date: string // 'YYYY-MM-DD'
  createdAt: string // ISO timestamp брони (когда создана) — для атрибуции дозаписей
  price: number
  durationMin: number
}

const EXPECTED_COLS: Array<keyof HistEvent> = [
  'customer',
  'customerName',
  'employee',
  'status',
  'date',
  'createdAt',
  'price',
  'durationMin',
]

let cache: { ts: number; events: HistEvent[]; empNames: Map<string, string> } | null = null
const CACHE_TTL = 5 * 60 * 1000

const loadHistory = async (force: boolean) => {
  if (!force && cache && Date.now() - cache.ts < CACHE_TTL) return cache
  const [history, employees] = await Promise.all([
    fetchAnalyticsHistory(),
    fetchMirrorEmployees().catch(() => []),
  ])

  // Индексы колонок по именам: если сервер добавит/переставит поле, мы либо
  // прочитаем правильное, либо честно упадём, но не подставим чужое значение.
  const idx = new Map((history.cols || []).map((c, i) => [c, i]))
  const missing = EXPECTED_COLS.filter((c) => !idx.has(c))
  if (missing.length) {
    throw new Error(`analytics/history: сервер не отдал колонки ${missing.join(', ')}`)
  }
  const at = Object.fromEntries(EXPECTED_COLS.map((c) => [c, idx.get(c) as number])) as Record<
    keyof HistEvent,
    number
  >

  const events: HistEvent[] = (history.events || []).map((r) => ({
    customer: String(r[at.customer] ?? ''),
    customerName: String(r[at.customerName] ?? ''),
    employee: String(r[at.employee] ?? ''),
    status: String(r[at.status] ?? ''),
    date: String(r[at.date] ?? ''),
    createdAt: String(r[at.createdAt] ?? ''),
    price: Number(r[at.price]) || 0,
    durationMin: Number(r[at.durationMin]) || 0,
  }))

  // Имена мастеров: базово — снимки из броней (покрывают и бывших сотрудников),
  // поверх — полные актуальные имена активных из personal
  const empNames = new Map<string, string>(history.empNames || [])
  for (const e of employees) empNames.set(e.id, e.name)
  cache = { ts: Date.now(), events, empNames }
  return cache
}

export const getEventsHistory = async (force = false): Promise<HistEvent[]> =>
  (await loadHistory(force)).events

// «Состоявшийся визит» — не отменён и не no-show
export const isAttended = (e: HistEvent) => e.status !== 'cancelled' && e.status !== 'noshow'
// Активная бронь (для будущего): просто не отменена
export const isActive = (e: HistEvent) => e.status !== 'cancelled'

// «Сегодня» здесь сравнивается с `event_date` броней, а это день САЛОНА.
// Раньше считалось по поясу браузера — у владельца в поездке «спящие»,
// «возвраты» и прогноз брали на день больше или меньше (s186).
export const todayStr = todayYmd

// Имена ВСЕХ сотрудников (включая бывших) — для атрибуции исторических событий
export const fetchEmployeeNames = async (): Promise<Map<string, string>> =>
  (await loadHistory(false)).empNames
