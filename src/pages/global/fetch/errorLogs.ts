import { Axios } from '../../../lib/api'

export interface ClientErrorLog {
  id: number
  documentId: string
  errorHash: string
  message: string
  stack: string | null
  source: 'window-error' | 'unhandled-rejection' | 'react-error' | 'manual'
  url: string | null
  userAgent: string | null
  sessionId: string | null
  environment: 'production' | 'development'
  count: number
  firstSeen: string | null
  lastSeen: string | null
  resolved: boolean
  createdAt: string
  updatedAt: string
}

export type ErrorFilter = 'all' | 'unresolved' | 'resolved'

export async function fetchErrorLogs(filter: ErrorFilter = 'all'): Promise<ClientErrorLog[]> {
  const filterPart =
    filter === 'unresolved'
      ? '&filters[resolved][$eq]=false'
      : filter === 'resolved'
        ? '&filters[resolved][$eq]=true'
        : ''
  const res: ClientErrorLog[] = await Axios.get(
    `/api/client-error-logs?sort=lastSeen:desc&pagination[pageSize]=200${filterPart}`,
  )
  return res
}

export async function updateErrorLog(
  documentId: string,
  data: Partial<Pick<ClientErrorLog, 'resolved'>>,
): Promise<void> {
  await Axios.put(`/api/client-error-logs/${documentId}`, { data })
}

export async function deleteErrorLog(documentId: string): Promise<void> {
  await Axios.delete(`/api/client-error-logs/${documentId}`)
}

export async function deleteAllResolved(): Promise<number> {
  const resolved = await fetchErrorLogs('resolved')
  let deleted = 0
  for (const log of resolved) {
    try {
      await deleteErrorLog(log.documentId)
      deleted++
    } catch {
      /* skip failures */
    }
  }
  return deleted
}
