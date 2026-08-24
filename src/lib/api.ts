import axios from 'axios'
import { checkUserStatus, getToken, logout } from '../services/auth'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:1337'

export const Axios = axios.create({
  baseURL: apiUrl,
})

// 🟥 Раньше здесь подставлялся VITE_STRAPI_TOKEN — вечный full-access токен
// Strapi, вкомпилированный в бандл: кто открыл JS админки, получал постоянный
// полный доступ к API. И подставлялся он только на мутациях, поэтому все GET-ы
// шли анонимно и держались на правах роли Public — из-за чего наружу были
// открыты зарплаты, расходы и персональные данные покупателей ваучеров.
//
// Теперь шлём токен СЕССИИ сотрудника (7 дней, привязан к admin-user и роли).
// На стороне Strapi middleware `global::admin-session` меняет его на серверный
// API-токен, который в браузер не попадает. Токен нужен на ВСЕХ методах, включая
// GET, — после закрытия прав Public без него чтение коллекций отдаёт 403.
Axios.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
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
