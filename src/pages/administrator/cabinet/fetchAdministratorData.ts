// Запрос данных кабинета. Тело перенесено из useEffect страницы (этап 6):
// тот же адрес, те же заголовки, тот же текст ошибки — менялась бы хоть
// подпись, администратор увидел бы другое сообщение.
import { API_URL } from '../../../lib/config'
import { authHeaders } from '../../../lib/authHeaders'
import type { AdministratorData } from './types'

export const fetchAdministratorData = async (username: string): Promise<AdministratorData> => {
  const response = await fetch(
    `${API_URL}/api/admin-users/administrator-data/${encodeURIComponent(username)}`,
    { headers: { ...authHeaders() } },
  )

  if (!response.ok) {
    throw new Error('Не удалось загрузить данные')
  }

  return response.json()
}
