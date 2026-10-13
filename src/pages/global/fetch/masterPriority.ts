import { Axios } from '../../../lib/api'
import { worksAsMaster } from '../../../lib/worksAsMaster'
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
  position?: string | null
  alsoMaster?: boolean | null
}

export const fetchMasters = async (): Promise<MasterPriorityData[]> => {
  const data: RawMasterPersonal[] = await Axios.get(
    // мастер — worksAsMaster (s249): и управляющая с флагом alsoMaster
    '/api/personals?fields[0]=name&fields[1]=noonaEmployeeId&fields[2]=bookingPriority&fields[3]=position&fields[4]=alsoMaster&filters[isActive][$eq]=true&pagination[pageSize]=100&status=published',
  )

  return (data || []).filter(worksAsMaster).map((item) => ({
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
