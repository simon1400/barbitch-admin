import { NoonaHQ } from '../../../../lib/noona'
import { fetchAllNoonaCategoriesWithServices, type NoonaCategory } from '../../fetch/priceIncrease'

export { fetchAllNoonaCategoriesWithServices }
export type { NoonaCategory }

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string

const getErr = (err: unknown): string => {
  const e = err as {
    response?: { data?: { error?: { message?: string }; message?: string } }
    message?: string
  }
  return (
    e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message ?? 'Неизвестная ошибка'
  )
}

// ─── Noona employee ↔ service availability model (verified s57) ────────────────
// A service is AVAILABLE for a master when it is ABSENT from event_type_preferences
// (default = available) OR present with skip_calendar=false. It is DISABLED only when
// present with skip_calendar=true. NEVER remove an entry to disable — removal re-enables
// by default. To disable → set skip_calendar=true. To enable → skip_calendar=false.
// POST replaces the WHOLE list atomically.

export interface EventTypePreference {
  event_type: string
  has_custom_duration: boolean
  skip_calendar: boolean
}

export interface Employee {
  id: string
  name: string
  event_type_preferences: EventTypePreference[]
}

export interface ServiceMeta {
  id: string
  title: string
  hidden: boolean
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

const normalizePrefs = (raw: unknown): EventTypePreference[] => {
  const arr = Array.isArray(raw) ? raw : []
  return arr
    .map((p) => {
      const pref = p as { event_type?: string; has_custom_duration?: boolean; skip_calendar?: boolean }
      return {
        event_type: pref.event_type ?? '',
        has_custom_duration: Boolean(pref.has_custom_duration),
        skip_calendar: Boolean(pref.skip_calendar),
      }
    })
    .filter((p) => p.event_type)
}

export const fetchEmployees = async (): Promise<Employee[]> => {
  const res = await NoonaHQ.get(`/${COMPANY_ID}/employees`)
  const items: Array<{
    id?: string
    name?: string
    display_name?: string
    available_for_bookings?: boolean
    event_type_preferences?: unknown
  }> = Array.isArray(res.data) ? res.data : []

  // Only ACTIVE masters (visible in calendar). `available_for_bookings === true`
  // is exactly the calendar-visible set — it excludes the calendar-HIDDEN employee
  // and all REMOVED ("Odstranění") employees, which are all available_for_bookings:false.
  // (marketplace.enabled is NOT reliable — some removed employees have it true.)
  return items
    .filter((e) => e.id && e.available_for_bookings === true)
    .map((e) => ({
      id: e.id!,
      name: e.name ?? e.display_name ?? e.id!,
      event_type_preferences: normalizePrefs(e.event_type_preferences),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
}

// Fresh prefs for one employee — fetched right before save so we build the new list
// on top of the current server state (not a stale list snapshot).
export const fetchEmployee = async (id: string): Promise<Employee> => {
  const res = await NoonaHQ.get(`/${COMPANY_ID}/employees/${id}`)
  const e = res.data as {
    id?: string
    name?: string
    display_name?: string
    event_type_preferences?: unknown
  }
  return {
    id: e.id ?? id,
    name: e.name ?? e.display_name ?? id,
    event_type_preferences: normalizePrefs(e.event_type_preferences),
  }
}

// id → { title, hidden } for every event_type (for names + greying hidden services).
export const fetchServiceMeta = async (): Promise<Map<string, ServiceMeta>> => {
  const res = await NoonaHQ.get(`/${COMPANY_ID}/event_types`)
  const items: Array<{ id?: string; title?: string; connections?: { hidden?: boolean } }> =
    Array.isArray(res.data) ? res.data : []
  const map = new Map<string, ServiceMeta>()
  for (const s of items) {
    if (!s.id) continue
    map.set(s.id, {
      id: s.id,
      title: s.title ?? '(без названия)',
      hidden: Boolean(s.connections?.hidden),
    })
  }
  return map
}

// ─── Availability helpers ──────────────────────────────────────────────────────

// Map<event_type_id, enabled> for the given employee, restricted to the managed ids.
// enabled = pref absent OR skip_calendar=false; disabled = pref present & skip_calendar=true.
export const buildEnabledMap = (
  employee: Employee,
  managedIds: string[],
): Map<string, boolean> => {
  const prefById = new Map(employee.event_type_preferences.map((p) => [p.event_type, p]))
  const map = new Map<string, boolean>()
  for (const id of managedIds) {
    const pref = prefById.get(id)
    map.set(id, pref ? !pref.skip_calendar : true)
  }
  return map
}

export type CategoryState = 'on' | 'off' | 'partial'

export const categoryState = (
  serviceIds: string[],
  enabledMap: Map<string, boolean>,
): CategoryState => {
  const known = serviceIds.filter((id) => enabledMap.has(id))
  if (known.length === 0) return 'off'
  const enabledCount = known.filter((id) => enabledMap.get(id)).length
  if (enabledCount === 0) return 'off'
  if (enabledCount === known.length) return 'on'
  return 'partial'
}

// ─── Save ─────────────────────────────────────────────────────────────────────

// Build the new event_type_preferences list:
//   • start from the employee's CURRENT prefs (preserves has_custom_duration and any
//     entries for services we don't manage — e.g. services not in any category)
//   • for every managed service write an explicit entry: skip_calendar = !enabled,
//     keeping its existing has_custom_duration. Explicit false (instead of removal) is
//     intentional — removal would re-enable by default and is easy to misread.
// Keyed by event_type id → naturally deduped (a service in several categories = 1 entry).
export const buildPrefsPayload = (
  employee: Employee,
  managedIds: string[],
  enabledMap: Map<string, boolean>,
): EventTypePreference[] => {
  const byId = new Map<string, EventTypePreference>(
    employee.event_type_preferences.map((p) => [p.event_type, { ...p }]),
  )
  for (const id of managedIds) {
    const existing = byId.get(id)
    byId.set(id, {
      event_type: id,
      has_custom_duration: existing?.has_custom_duration ?? false,
      skip_calendar: !enabledMap.get(id),
    })
  }
  return [...byId.values()]
}

export interface SaveResult {
  status: 'ok' | 'error'
  count: number
  error?: string
}

export const saveEmployeePrefs = async (
  employeeId: string,
  prefs: EventTypePreference[],
): Promise<SaveResult> => {
  try {
    await NoonaHQ.post(`/${COMPANY_ID}/employees/${employeeId}`, {
      event_type_preferences: prefs,
    })
    return { status: 'ok', count: prefs.length }
  } catch (err) {
    return { status: 'error', count: prefs.length, error: getErr(err) }
  }
}

// ─── Backup ─────────────────────────────────────────────────────────────────────

// Trigger a browser download of the employee's current prefs as JSON — always run
// before a save so there is a rollback snapshot.
export const downloadPrefsBackup = (employee: Employee): void => {
  const payload = {
    company_id: COMPANY_ID,
    employee_id: employee.id,
    employee_name: employee.name,
    saved_at: new Date().toISOString(),
    event_type_preferences: employee.event_type_preferences,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safeName = employee.name.replace(/[^\w-]+/g, '_')
  a.download = `prefs-backup-${safeName}-${employee.id}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
