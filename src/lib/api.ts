import axios from 'axios'
import { checkUserStatus, logout } from '../services/auth'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:1337'
const strapiToken = import.meta.env.VITE_STRAPI_TOKEN as string | undefined

export const Axios = axios.create({
  baseURL: apiUrl,
})

// Add auth token for mutating requests (PUT, POST, DELETE)
Axios.interceptors.request.use((config) => {
  if (strapiToken && config.method && ['put', 'post', 'delete', 'patch'].includes(config.method)) {
    config.headers.Authorization = `Bearer ${strapiToken}`
  }
  return config
})

// Флаг для предотвращения множественных проверок
let isCheckingStatus = false

Axios.interceptors.response.use(
  async (response) => {
    // Проверяем статус пользователя при каждом успешном запросе
    if (!isCheckingStatus) {
      const userId = localStorage.getItem('userId')
      if (userId) {
        isCheckingStatus = true
        const status = await checkUserStatus(userId)
        isCheckingStatus = false

        if (status && !status.isActive) {
          console.log('User has been deactivated, logging out...')
          logout()
          return Promise.reject(new Error('User account has been deactivated'))
        }
      }
    }

    return response.data.data
  },
  (error) => {
    return Promise.reject(error)
  },
)
