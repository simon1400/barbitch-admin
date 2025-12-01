import axios from 'axios'
import { checkUserStatus, logout } from '../services/auth'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:1337'

export const Axios = axios.create({
  baseURL: apiUrl,
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
