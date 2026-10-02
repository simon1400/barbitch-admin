// Поручения владельца управляющей (s240, «Výkaz práce» Фаза 3).
//
// 🟥 Данные — ТОЛЬКО ручки движка `/engine/admin/tasks…`: у коллекций нет REST.
// Создать и править — владелец; исполнитель видит свои (сервер сам находит карточку
// сессии), пишет ход работы, «hotovo», комментарии; вложения — обе стороны.
// Подписи статусов и приоритетов приходят с сервера (services/owner-tasks.ts).
import { ApiError, makeApiFetch } from '../../../lib/apiFetch'
import { API_URL } from '../../../lib/config'
import { getToken } from '../../../services/auth'
import { shrinkPhoto } from '../../../lib/shrinkPhoto'
import type { Labeled } from './workReports'

export type TaskStatus = 'open' | 'done' | 'accepted' | 'cancelled'
export type TaskPriority = 'normal' | 'urgent'
export type TaskAction = 'done' | 'progress' | 'comment' | 'accept' | 'reopen' | 'cancel'
export type TaskScope = 'active' | 'closed' | 'all'

export interface TaskEvent {
  at: string
  kind: 'created' | 'edited' | TaskAction
  by: string
  role: string
  text: string
  /** событие пришло из ежедневного отчёта за этот день */
  reportDate?: string
}

export interface TaskFile {
  documentId: string
  fileName: string
  mime: string | null
  size: number
  uploadedBy: string | null
  uploadedRole: string | null
  createdAt: string | null
}

export interface Task {
  documentId: string
  personal: string | null
  personalName: string | null
  title: string
  description: string
  dueDate: string | null
  priority: TaskPriority
  status: TaskStatus
  overdue: boolean
  createdByName: string | null
  doneAt: string | null
  closedAt: string | null
  closedBy: string | null
  events: TaskEvent[]
  files: TaskFile[]
  version: number
  createdAt: string | null
  updatedAt: string | null
}

export interface TasksList {
  today: string
  priorities: Labeled[]
  statuses: Labeled[]
  maxFiles: number
  role: 'owner' | 'manager'
  scope: TaskScope
  people?: { documentId: string; name: string; isActive: boolean }[]
  tasks: Task[]
}

/** Поручение для формы отчёта (из `/work-reports/mine`). */
export interface OpenTask {
  documentId: string
  title: string
  dueDate: string | null
  priority: TaskPriority
  status: TaskStatus
  overdue: boolean
}

export interface TaskBrief {
  documentId: string
  title: string
  personalName: string | null
  dueDate: string | null
  priority: TaskPriority
  status: TaskStatus
  overdue: boolean
  doneAt: string | null
}

export interface TasksAttention {
  role: 'owner' | 'manager'
  today: string
  open: number
  overdue: TaskBrief[]
  urgent: TaskBrief[]
  waiting: TaskBrief[]
  next: TaskBrief[]
}

export interface TaskInput {
  personal?: string
  title?: string
  description?: string
  dueDate?: string | null
  priority?: TaskPriority
}

const CODE_MESSAGES: Record<string, string> = {
  unauthorized: 'Relace vypršela — přihlaste se znovu.',
  owner_only: 'Úkoly zadává a upravuje jen majitel.',
  task_changed: 'Úkol se mezitím změnil — načetla jsem ho znovu, zkuste to prosím ještě jednou.',
  storage_not_configured: 'Úložiště příloh na serveru zatím není nastavené.',
  // ostatní kódy — text ze serveru (česky)
}

const tasksFetch = makeApiFetch('/api/engine/admin/tasks', CODE_MESSAGES, (s) => `Chyba ${s}`)
const enc = encodeURIComponent

export const fetchTasks = (scope: TaskScope, personal?: string | null) =>
  tasksFetch<TasksList>('GET', `?scope=${enc(scope)}${personal ? `&personal=${enc(personal)}` : ''}`)

export const fetchTasksAttention = () => tasksFetch<TasksAttention>('GET', '/attention')

export const createTask = (body: TaskInput) => tasksFetch<{ task: Task }>('POST', '', body)

export const updateTask = (id: string, body: TaskInput) => tasksFetch<{ task: Task }>('PATCH', `/${enc(id)}`, body)

export const taskAction = (id: string, action: TaskAction, text = '') =>
  tasksFetch<{ task: Task }>('POST', `/${enc(id)}/actions`, { action, text })

export const deleteTaskFile = (id: string, fid: string) => tasksFetch<{ deleted: string }>('DELETE', `/${enc(id)}/files/${enc(fid)}`)

const failFrom = async (res: Response): Promise<never> => {
  const json = await res.json().catch(() => null)
  const code = json?.error?.code || 'internal'
  throw new ApiError(res.status, code, CODE_MESSAGES[code] || json?.error?.message || `Chyba ${res.status}`)
}

export const MAX_TASK_FILE_BYTES = 10 * 1024 * 1024
export const ACCEPT_TASK_FILE = 'image/*,application/pdf'
const TASK_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

/** Один файл (фото ужимается в браузере). Поле — `files`, Content-Type ставит браузер. */
export const uploadTaskFile = async (id: string, raw: File): Promise<TaskFile> => {
  const file = await shrinkPhoto(raw)
  if (!TASK_FILE_TYPES.includes(file.type)) {
    throw new ApiError(
      400,
      'bad_file_type',
      /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
        ? `«${file.name}»: HEIC není podporován — vyberte fotku jako JPEG.`
        : `«${file.name}»: příloha — fotka (JPG, PNG, WEBP) nebo PDF.`,
    )
  }
  if (file.size > MAX_TASK_FILE_BYTES) throw new ApiError(413, 'file_too_big', `«${file.name}»: větší než 10 MB.`)
  const fd = new FormData()
  fd.append('files', file, file.name)
  const res = await fetch(`${API_URL}/api/engine/admin/tasks/${enc(id)}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken() || ''}` },
    body: fd,
  })
  if (!res.ok) return failFrom(res)
  return (await res.json()).file
}

/** Вложение в новой вкладке: окно — синхронно по клику, иначе браузер заблокирует его после await. */
export async function openTaskFile(id: string, f: TaskFile): Promise<void> {
  const win = window.open('', '_blank')
  try {
    const res = await fetch(`${API_URL}/api/engine/admin/tasks/${enc(id)}/files/${enc(f.documentId)}`, {
      headers: { Authorization: `Bearer ${getToken() || ''}` },
      cache: 'no-store',
    })
    if (!res.ok) await failFrom(res)
    const url = URL.createObjectURL(await res.blob())
    if (win) win.location.href = url
    else {
      const a = document.createElement('a')
      a.href = url
      a.download = f.fileName || 'priloha'
      a.click()
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    win?.close()
    throw e
  }
}

// ── подписи ───────────────────────────────────────────────────────────────────

export const EVENT_LABEL: Record<TaskEvent['kind'], string> = {
  created: 'zadáno',
  edited: 'upraveno',
  progress: 'průběh',
  done: 'hotovo',
  accept: 'převzato',
  reopen: 'vráceno do práce',
  cancel: 'zrušeno',
  comment: 'komentář',
}

/** Действия по роли и статусу — те же правила, что на сервере (TRANSITIONS). */
export const actionsFor = (role: 'owner' | 'manager', status: TaskStatus): TaskAction[] => {
  if (role === 'owner') {
    return [
      ...(status === 'done' ? (['accept'] as const) : []),
      ...(status !== 'open' ? (['reopen'] as const) : []),
      ...(status === 'open' || status === 'done' ? (['cancel'] as const) : []),
    ]
  }
  return status === 'open' ? ['done'] : []
}
