import { NoonaMarketplace } from '../../../lib/noona'

const COMPANY_ID = import.meta.env.VITE_NOONA_COMPANY_ID as string

export interface NoonaEmployee {
  id: string
  profile: { name: string }
}

export const getNoonaEmployees = async (): Promise<NoonaEmployee[]> => {
  const res = await NoonaMarketplace.get(
    `/companies/${COMPANY_ID}/employees?type=available&select[]=profile&select[]=id`,
  )
  const data = res.data
  return Array.isArray(data) ? data : []
}
