import { Axios } from '../../../lib/api'
import { fetchStaffCard, patchStaff } from '../team/fetch/staff'

export interface MasterPriorityData {
  documentId: string
  name: string
  noonaEmployeeId: string | null
  bookingPriority: number
}

/** Сырая запись personal из Strapi (часть полей может отсутствовать). */
interface RawMasterPersonal {
  documentId: string
  name: string
  noonaEmployeeId?: string | null
  bookingPriority?: number | null
}

export const fetchMasters = async (): Promise<MasterPriorityData[]> => {
  const data: RawMasterPersonal[] = await Axios.get(
    '/api/personals?fields[0]=name&fields[1]=noonaEmployeeId&fields[2]=bookingPriority&filters[position][$eq]=master&filters[isActive][$eq]=true&pagination[pageSize]=100&status=published',
  )

  return (data || []).map((item) => ({
    documentId: item.documentId,
    name: item.name,
    noonaEmployeeId: item.noonaEmployeeId || null,
    bookingPriority: item.bookingPriority ?? 0,
  }))
}

// Запись — ручкой карточки сотрудника (s226): черновик + публикация, т.е. обе версии
// (прямой REST писал только published — черновик отставал) + запись в журнал.
// base — свежая версия карточки: экран правит одно число, последняя правка побеждает.
export const updateMasterPriority = async (
  documentId: string,
  data: { bookingPriority: number },
): Promise<void> => {
  const card = await fetchStaffCard(documentId)
  await patchStaff(documentId, 'booking', data, card.updatedAt)
}
