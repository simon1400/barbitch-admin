import type { UserRole } from '../types/admin'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337'

export interface LoginResponse {
  username: string
  role: UserRole
  id: number
}

export interface LoginError {
  error: string
  message?: string
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
    const response = await fetch(`${API_URL}/api/admin-users/check-status/${userId}`)

    if (!response.ok) {
      console.error('Failed to check user status')
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
  window.location.href = '/login'
}
