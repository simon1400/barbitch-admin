import type { UserRole } from '../types/admin'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337'

export interface LoginResponse {
  username: string
  role: UserRole
  id: number
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

export async function checkUserStatus(userId: string): Promise<{ isActive: boolean } | null> {
  try {
    const token = getToken()
    if (!token) return null

    const response = await fetch(`${API_URL}/api/admin-users/check-status/${userId}`, {
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

export function logout() {
  localStorage.removeItem('usernameLocalData')
  localStorage.removeItem('userRole')
  localStorage.removeItem('userId')
  localStorage.removeItem('userJwt')
  window.location.href = '/login'
}
