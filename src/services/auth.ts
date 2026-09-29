import { API_URL } from '../lib/config'
import type { UserRole } from '../types/admin'

export interface LoginResponse {
  username: string
  role: UserRole
  id: number
  personalDocId?: string
  jwt: string
}

export interface LoginError {
  error: string
  message?: string
}

export function getToken(): string | null {
  return localStorage.getItem('userJwt')
}

interface SessionPayload {
  id: number
  username: string
  role: UserRole
  /**
   * documentId своей карточки сотрудника (s229, §5а.1) — есть в токенах, выданных после
   * s229 учётке со связью. Нет — «кто я» ищется по имени (username = personal.name).
   * Сервер этому полю не верит: связь он берёт из базы, а токен с устаревшей связью
   * отзывает (401 personal_changed).
   */
  personalDocId?: string
  iat: number
  exp: number
}

// UTF-8-safe base64url decode (Czech usernames may be non-ASCII).
function decodeB64Url(segment: string): string {
  let b64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  const binary = atob(b64)
  return decodeURIComponent(
    binary
      .split('')
      .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(''),
  )
}

// Decode (NOT cryptographically verify — that is server-side) the session token
// to read role/expiry. Defense-in-depth for client route guards; real
// authorization is enforced on the server for sensitive endpoints.
export function getSession(): SessionPayload | null {
  const token = getToken()
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(decodeB64Url(parts[1])) as SessionPayload
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function getSessionRole(): UserRole | null {
  return getSession()?.role ?? null
}

/**
 * Своя карточка среди сотрудников: по связи из токена, у старого токена или учётки без
 * связи — по имени (как до s229). Один матч на календарь и кабинет мастера.
 */
export function isOwnPersonal(p: { docId?: string | null; name: string }): boolean {
  const session = getSession()
  if (!session) return false
  const own = (session.personalDocId || '').trim()
  if (own) return p.docId === own
  const uname = (session.username || '').trim().toLowerCase()
  return uname !== '' && p.name.trim().toLowerCase() === uname
}

export async function loginUser(
  username: string,
  password: string,
): Promise<LoginResponse | LoginError> {
  try {
    const response = await fetch(`${API_URL}/api/admin-users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        error: data.error?.message || 'Invalid credentials',
        message: data.error?.details?.message,
      }
    }

    return data
  } catch (error) {
    console.error('Login error:', error)
    return {
      error: 'Network error. Please check your connection.',
    }
  }
}

// Статус СВОЕЙ учётки (деактивирована ли). id берём из токена, а не из
// отдельного localStorage-ключа; сервер всё равно смотрит только на сессию.
//
// ⚠️ Single-flight: запрос дедуплицируется по всему приложению. Раньше дедуп жил
// флагом в response-интерсепторе Axios, который дёргал эту проверку после КАЖДОГО
// ответа; теперь её зовут таймер в App.tsx и обработчик 401, и параллельные вызовы
// (у календаря на старте несколько запросов сразу) должны схлопываться в один.
let statusInFlight: Promise<{ isActive: boolean } | null> | null = null

function checkUserStatus(): Promise<{ isActive: boolean } | null> {
  if (statusInFlight) return statusInFlight
  statusInFlight = requestUserStatus().finally(() => {
    statusInFlight = null
  })
  return statusInFlight
}

async function requestUserStatus(): Promise<{ isActive: boolean } | null> {
  try {
    const token = getToken()
    if (!token) return null
    // Токен есть, но разобрать/срок вышел — разлогиниваем сразу. Раньше это
    // делал ответ 401 от сервера; без явной ветки истёкшая сессия молча висела
    // бы на странице до первой неудачной загрузки данных.
    const session = getSession()
    if (!session) {
      logout()
      return null
    }

    const response = await fetch(`${API_URL}/api/admin-users/check-status/${session.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      // Истёкший/невалидный токен — разлогинить, чтобы пользователь переавторизовался
      if (response.status === 401) logout()
      else console.error('Failed to check user status')
      return null
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Check status error:', error)
    return null
  }
}

// Единая реакция на «учётка больше не годится»: деактивирован → разлогинить.
// Истёкшую/отозванную сессию разлогинивает сам checkUserStatus (нет payload →
// logout, 401 от сервера → logout). Зовут её ровно два места: таймер App.tsx
// (раз в 30 с) и обработчик 401 в Axios-интерсепторе.
export async function enforceActiveSession(): Promise<void> {
  const status = await checkUserStatus()
  if (status && !status.isActive) {
    console.log('User has been deactivated, logging out...')
    logout()
  }
}

export function logout() {
  // первые три ключа больше не пишутся (s182), удаляем ради старых сессий
  localStorage.removeItem('usernameLocalData')
  localStorage.removeItem('userRole')
  localStorage.removeItem('userId')
  localStorage.removeItem('userJwt')
  window.location.href = '/login'
}
