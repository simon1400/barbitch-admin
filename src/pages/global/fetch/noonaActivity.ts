/* eslint-disable @typescript-eslint/no-explicit-any */
import { NoonaHQ } from '../../../lib/noona'

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string

export interface NoonaEmployee {
  id: string
  name: string
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

export interface BlockItem {
  id: string
  timestamp: string
  actorName: string
  actorId: string
  description: string
  details: {
    employeeName: string
    blockTitle: string
    blockDate: string
    blockFrom: string
    blockTo: string
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

export const buildBlockItems = (
  blockedTimes: BlockedTime[],
  employeeMap: Map<string, string>,
): BlockItem[] => {
  const items: BlockItem[] = []

  for (const block of blockedTimes) {
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

  items.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  return items
}
