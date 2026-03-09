/* eslint-disable @typescript-eslint/no-explicit-any */
import { NoonaHQ } from '../../../lib/noona'

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string

export interface NoonaEmployee {
  id: string
  name: string
}

export interface ActivityEvent {
  customer_name?: string
  employee_name?: string
  employee?: string
  event_types?: { title?: string; color?: string }[]
  starts_at?: string
  ends_at?: string
  duration?: number
  status?: string
  created_by?: string | null
  booking_source?: { channel?: string; group?: string }
}

export interface NoonaActivity {
  id: string
  action: 'created' | 'updated' | 'deleted'
  type: 'event' | 'customer'
  created_at: string
  created_by: string | null
  event?: ActivityEvent | string
  customer?: string
  field?: string
  old_value?: any
  new_value?: any
}

export interface BlockedTime {
  id: string
  employee: string
  created_by: string
  title: string
  date: string
  starts_at: string
  ends_at: string
  duration: number
  created_at: string
  updated_at: string
  theme?: string
}

export interface ActivityItem {
  id: string
  timestamp: string
  actorName: string
  actorId: string
  actionType:
    | 'event_created'
    | 'event_deleted'
    | 'event_cancelled'
    | 'event_duration_changed'
    | 'calendar_block'
  description: string
  details?: {
    customerName?: string
    employeeName?: string
    serviceName?: string
    startsAt?: string
    oldValue?: any
    newValue?: any
    blockTitle?: string
    blockDate?: string
    blockFrom?: string
    blockTo?: string
  }
}

export const getEmployees = async (): Promise<NoonaEmployee[]> => {
  try {
    const { data } = await NoonaHQ.get(`/${COMPANY_ID}/employees`)
    return (data as any[]).map((e: any) => ({
      id: e.id,
      name: e.name || 'Unknown',
    }))
  } catch (err) {
    console.error('Failed to fetch employees:', err)
    return []
  }
}

export const getActivities = async (from: Date): Promise<NoonaActivity[]> => {
  try {
    // Fetch without expand — event field is a string ID
    const { data } = await NoonaHQ.get(
      `/${COMPANY_ID}/activities?limit=200`,
    )
    if (!Array.isArray(data)) return []

    // Filter by date (API doesn't support date filtering)
    const fromTime = from.getTime()
    const filtered = data.filter(
      (act: any) => new Date(act.created_at).getTime() >= fromTime,
    )

    // Collect all unique event IDs
    const eventIds = new Set<string>()
    for (const act of filtered) {
      if (act.type === 'event' && typeof act.event === 'string') {
        eventIds.add(act.event)
      }
    }

    // Fetch all events (including deleted) in one request
    const eventsMap = await fetchEventsWithDeleted(eventIds, from)

    // Enrich activities with event data
    for (const act of filtered) {
      if (act.type === 'event' && typeof act.event === 'string') {
        const eventData = eventsMap.get(act.event)
        if (eventData) {
          act.event = eventData
        }
      }
    }

    return filtered
  } catch (err) {
    console.error('Failed to fetch activities:', err)
    return []
  }
}

const fetchEventsWithDeleted = async (
  eventIds: Set<string>,
  from: Date,
): Promise<Map<string, ActivityEvent>> => {
  const map = new Map<string, ActivityEvent>()
  if (eventIds.size === 0) return map
  try {
    const filter = {
      include_deleted: true,
      created_from: from.toISOString(),
      created_to: new Date().toISOString(),
    }
    const { data } = await NoonaHQ.get(
      `/${COMPANY_ID}/events?filter=${encodeURIComponent(JSON.stringify(filter))}&limit=500`,
    )
    if (Array.isArray(data)) {
      for (const event of data) {
        if (eventIds.has(event.id)) {
          map.set(event.id, {
            customer_name: event.customer_name,
            employee_name: event.employee_name,
            employee: event.employee,
            event_types: event.event_types,
            starts_at: event.starts_at,
            ends_at: event.ends_at,
            duration: event.duration,
            status: event.status,
            created_by: event.created_by,
            booking_source: event.booking_source,
          })
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch events:', err)
  }
  return map
}

export const getBlockedTimes = async (
  from: string,
  to: string,
): Promise<BlockedTime[]> => {
  try {
    const { data } = await NoonaHQ.get(
      `/${COMPANY_ID}/blocked_times?from=${from}&to=${to}`,
    )
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Failed to fetch blocked times:', err)
    return []
  }
}

const resolveEmployeeName = (
  id: string | null | undefined,
  employeeMap: Map<string, string>,
): string => {
  if (!id) return 'Systém'
  if (id === 'system-marketplace') return 'Online rezervace'
  return employeeMap.get(id) || 'Neznámý'
}

const formatTime = (iso: string): string => {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('cs-CZ', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Prague',
    })
  } catch {
    return ''
  }
}

const formatDate = (iso: string): string => {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'numeric',
      timeZone: 'Europe/Prague',
    })
  } catch {
    return ''
  }
}

export const buildActivityItems = (
  activities: NoonaActivity[],
  blockedTimes: BlockedTime[],
  employeeMap: Map<string, string>,
): ActivityItem[] => {
  const items: ActivityItem[] = []

  for (const act of activities) {
    if (act.type !== 'event') continue

    // Only show actions by active employees (skip system/client/unknown)
    if (!act.created_by || act.created_by === 'system-marketplace' || !employeeMap.has(act.created_by)) {
      continue
    }

    const event = typeof act.event === 'object' ? act.event : undefined
    const actorName = employeeMap.get(act.created_by)!
    const actorId = act.created_by
    const customerName = event?.customer_name || ''
    const employeeName =
      event?.employee_name?.trim() ||
      resolveEmployeeName(event?.employee, employeeMap)
    const serviceName = event?.event_types?.[0]?.title || ''
    const startsAt = event?.starts_at || ''

    if (act.action === 'deleted') {
      items.push({
        id: act.id,
        timestamp: act.created_at,
        actorName,
        actorId,
        actionType: 'event_deleted',
        description: `Smazal/a rezervaci${customerName ? ` — ${customerName}` : ''}`,
        details: { customerName, employeeName, serviceName, startsAt },
      })
    } else if (act.action === 'created') {
      items.push({
        id: act.id,
        timestamp: act.created_at,
        actorName,
        actorId,
        actionType: 'event_created',
        description: `Vytvořil/a rezervaci${customerName ? ` pro ${customerName}` : ''}`,
        details: { customerName, employeeName, serviceName, startsAt },
      })
    } else if (act.action === 'updated') {
      if (act.field === 'status' && act.new_value === 'cancelled') {
        items.push({
          id: act.id,
          timestamp: act.created_at,
          actorName,
          actorId,
          actionType: 'event_cancelled',
          description: `Zrušil/a rezervaci ${customerName || '?'}`,
          details: { customerName, employeeName, serviceName, startsAt },
        })
      } else if (act.field === 'duration') {
        items.push({
          id: act.id,
          timestamp: act.created_at,
          actorName,
          actorId,
          actionType: 'event_duration_changed',
          description: `Změnil/a délku: ${act.old_value} → ${act.new_value} min — ${customerName || '?'}`,
          details: {
            customerName,
            employeeName,
            serviceName,
            startsAt,
            oldValue: act.old_value,
            newValue: act.new_value,
          },
        })
      }
    }
  }

  for (const block of blockedTimes) {
    // Only blocks created by active employees
    if (!block.created_by || !employeeMap.has(block.created_by)) continue

    const actorName = employeeMap.get(block.created_by)!
    const targetName = employeeMap.get(block.employee) || 'Neznámý'
    const blockFrom = formatTime(block.starts_at)
    const blockTo = formatTime(block.ends_at)
    const blockDate = formatDate(block.starts_at)

    items.push({
      id: block.id,
      timestamp: block.created_at,
      actorName,
      actorId: block.created_by,
      actionType: 'calendar_block',
      description: `Blokace kalendáře pro ${targetName}`,
      details: {
        employeeName: targetName,
        blockTitle: block.title || 'Bez důvodu',
        blockDate,
        blockFrom,
        blockTo,
      },
    })
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return items
}
