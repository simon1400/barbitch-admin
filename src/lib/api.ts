import axios from 'axios'
import { enforceActiveSession, getToken } from '../services/auth'

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

// 🟥 Раньше здесь после КАЖДОГО успешного ответа await-илась проверка
// `check-status`: каждый запрос админки превращался в два, и все они ждали лишний
// круг до сервера (страница дня календаря = 5 запросов → 10). При этом App.tsx и
// так опрашивает статус раз в 30 секунд, то есть проверка была ещё и дублирующей.
//
// Осталось два триггера: таймер (штатный путь) и ответ 401 (быстрая реакция, если
// сессию отозвали между тиками таймера). Ветку 401 намеренно НЕ делаем безусловным
// logout: наши собственные ручки отвечают 401 и на «не твоя роль» (`owner_only`),
// а это не повод выкидывать залогиненного человека. Решает `enforceActiveSession` —
// он разлогинивает только когда сессия действительно мертва или учётка выключена.
Axios.interceptors.response.use(
  (response) => response.data.data,
  (error) => {
    if (error?.response?.status === 401) void enforceActiveSession()
    return Promise.reject(error)
  },
)
