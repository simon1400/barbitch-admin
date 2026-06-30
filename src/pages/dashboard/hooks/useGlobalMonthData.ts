import { useCallback, useEffect, useState } from 'react'

import {
  EMPTY_GLOBAL_MONTH_DATA,
  getGlobalMonthData,
  type GlobalMonthData,
} from '../fetch/monthDataCache'

export interface UseGlobalMonthData {
  data: GlobalMonthData
  loading: boolean
  cachedAt: number // timestamp последнего реального пересчёта
  refresh: () => void // принудительный пересчёт (минуя кэш)
}

export const useGlobalMonthData = (month: number, year: number): UseGlobalMonthData => {
  const [data, setData] = useState<GlobalMonthData>(EMPTY_GLOBAL_MONTH_DATA)
  const [loading, setLoading] = useState(false)
  const [cachedAt, setCachedAt] = useState(0)

  const load = useCallback(
    async (force: boolean) => {
      setLoading(true)
      try {
        const res = await getGlobalMonthData(month, year, force)
        setData(res.data)
        setCachedAt(res.cachedAt)
      } finally {
        setLoading(false)
      }
    },
    [month, year],
  )

  useEffect(() => {
    load(false)
  }, [load])

  const refresh = useCallback(() => {
    load(true)
  }, [load])

  return { data, loading, cachedAt, refresh }
}
