import { NoonaHQ } from '../../../lib/noona'

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string

export interface NoonaCategory {
  id: string
  title?: string
  name?: string
}

export const getNoonaCategories = async (): Promise<NoonaCategory[]> => {
  try {
    const res = await NoonaHQ.get(`/${COMPANY_ID}/event_type_groups`)
    const data = res.data
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}
