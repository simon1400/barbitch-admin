// Заголовок авторизации для запросов к Strapi из админки.
//
// 🟥 Раньше каждый data-слой брал `import.meta.env.VITE_STRAPI_TOKEN` — вечный
// full-access токен Strapi, вкомпилированный в бандл. Кто открыл JS админки,
// получал постоянный полный доступ к API.
//
// Теперь шлём токен СЕССИИ сотрудника; на стороне Strapi middleware
// `global::admin-session` меняет его на серверный API-токен, который в браузер
// не попадает.
//
// ⚠️ Это ФУНКЦИЯ, а не константа: сессия появляется после логина и меняется при
// повторном входе. Прежний код вычислял заголовок на загрузке модуля — с
// сессией так нельзя, значение бы «застыло» пустым до перезагрузки страницы.

import { getToken } from '../services/auth'

export const authHeaders = (): Record<string, string> | undefined => {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : undefined
}
