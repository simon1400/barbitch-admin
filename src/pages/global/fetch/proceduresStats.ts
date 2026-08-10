import qs from 'qs'

import { Axios } from '../../../lib/api'
import { getMonthRange } from '../../../utils/getMonthRange'
import {
  bookingServiceTitle,
  normalizeTitle,
} from '../components/shiftClose/helpers'

interface ServiceProvidedData {
  staffSalaries: string
  salonSalaries: string
  tip: string | null
  date: string
  offer: {
    title: string
    price: number | null
  } | null
  // Записи чекаута из календаря (D2) оффера не имеют — услуга живёт в снапшоте брони
  booking: {
    services: { title?: string }[] | null
  } | null
}

const NO_SERVICE = 'Bez služby'

// 🟥 GET-ы админки идут БЕЗ токена (интерсептор Axios подставляет его только на
// мутации) → Strapi санитизирует populate по Public-роли, а у коллекции `booking`
// Public-прав нет (PII) → relation `booking` МОЛЧА выпадает из ответа. После
// cutover'а услуга живёт ТОЛЬКО в снапшоте брони (offer у записей чекаута нет) →
// все процедуры схлопывались в одну строку «Bez služby». Явный Bearer (паттерн
// shiftClose.ts, s153) возвращает booking.services в ответ.
const STRAPI_TOKEN = import.meta.env.VITE_STRAPI_TOKEN as string | undefined
const authHeaders = STRAPI_TOKEN
  ? { headers: { Authorization: `Bearer ${STRAPI_TOKEN}` } }
  : undefined

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
        booking: {
          fields: ['services'],
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
    const data: ServiceProvidedData[] = await Axios.get(
      `/api/services-provided?${query}`,
      authHeaders,
    )

    const proceduresMap = new Map<string, ProcedureStats>()
    let totalCount = 0
    let totalRevenue = 0

    data.forEach((item) => {
      // Название процедуры: снапшот брони (новые записи из календаря) → offer
      // (~6000 исторических записей) → заглушка.
      const title =
        bookingServiceTitle(item.booking) || item.offer?.title || NO_SERVICE
      // Названия из брони и из легаси-офферов различаются регистром/пробелами
      // вокруг «+» и префиксом «Юниор » → группируем по нормализованному ключу,
      // показываем первое встреченное «человеческое» написание.
      const key = normalizeTitle(title) || NO_SERVICE
      const revenue =
        Number.parseFloat(item.staffSalaries || '0') +
        Number.parseFloat(item.salonSalaries || '0') +
        Number.parseFloat(item.tip || '0')

      totalCount += 1
      totalRevenue += revenue

      if (!proceduresMap.has(key)) {
        proceduresMap.set(key, {
          name: title,
          count: 0,
          totalRevenue: 0,
        })
      }

      const stats = proceduresMap.get(key)!
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
