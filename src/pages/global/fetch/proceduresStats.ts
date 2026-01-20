import qs from 'qs'

import { Axios } from '../../../lib/api'
import { getMonthRange } from '../../../utils/getMonthRange'

interface ServiceProvidedData {
  staffSalaries: string
  salonSalaries: string
  tip: string | null
  date: string
  offer: {
    title: string
    price: number | null
  } | null
}

export interface ProcedureStats {
  name: string
  count: number
  totalRevenue: number
}

export interface ProceduresStatsResult {
  procedures: ProcedureStats[]
  totalCount: number
  totalRevenue: number
}

export const getProceduresStats = async (month: number, year: number): Promise<ProceduresStatsResult> => {
  const { firstDay, lastDay } = getMonthRange(year, month)

  const query = qs.stringify(
    {
      filters: {
        date: {
          $gte: firstDay.toISOString(),
          $lte: lastDay.toISOString(),
        },
      },
      fields: ['staffSalaries', 'salonSalaries', 'tip', 'date'],
      populate: {
        offer: {
          fields: ['title', 'price'],
        },
      },
      pagination: {
        page: 1,
        pageSize: 2000,
      },
    },
    { encodeValuesOnly: true },
  )

  try {
    const data: ServiceProvidedData[] = await Axios.get(`/api/services-provided?${query}`)

    const proceduresMap = new Map<string, ProcedureStats>()
    let totalCount = 0
    let totalRevenue = 0

    data.forEach((item) => {
      const offerTitle = item.offer?.title || 'Без названия'
      const revenue =
        Number.parseFloat(item.staffSalaries || '0') +
        Number.parseFloat(item.salonSalaries || '0') +
        Number.parseFloat(item.tip || '0')

      totalCount += 1
      totalRevenue += revenue

      if (!proceduresMap.has(offerTitle)) {
        proceduresMap.set(offerTitle, {
          name: offerTitle,
          count: 0,
          totalRevenue: 0,
        })
      }

      const stats = proceduresMap.get(offerTitle)!
      stats.count += 1
      stats.totalRevenue += revenue
    })

    const procedures = Array.from(proceduresMap.values())

    return {
      procedures,
      totalCount,
      totalRevenue,
    }
  } catch (error) {
    console.error('Error fetching procedures stats:', error)
    return {
      procedures: [],
      totalCount: 0,
      totalRevenue: 0,
    }
  }
}
