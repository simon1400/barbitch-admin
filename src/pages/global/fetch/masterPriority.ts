import { Axios } from '../../../lib/api'

export interface MasterPriorityData {
  documentId: string
  name: string
  noonaEmployeeId: string | null
  bookingPriority: number
}

export const fetchMasters = async (): Promise<MasterPriorityData[]> => {
  const data: any[] = await Axios.get(
    '/api/personals?fields[0]=name&fields[1]=noonaEmployeeId&fields[2]=bookingPriority&filters[position][$eq]=master&filters[isActive][$eq]=true&pagination[pageSize]=100&status=published',
  )

  return (data || []).map((item: any) => ({
    documentId: item.documentId,
    name: item.name,
    noonaEmployeeId: item.noonaEmployeeId || null,
    bookingPriority: item.bookingPriority ?? 0,
  }))
}

export const updateMasterPriority = async (
  documentId: string,
  data: { bookingPriority: number },
): Promise<void> => {
  await Axios.put(`/api/personals/${documentId}?status=published`, { data })
}
