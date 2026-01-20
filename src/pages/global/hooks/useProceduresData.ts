import { useCallback, useEffect, useState } from 'react'

import { getProceduresStats, type ProceduresStatsResult } from '../fetch/proceduresStats'

export const useProceduresData = (month: number, year: number) => {
  const [data, setData] = useState<ProceduresStatsResult>({
    procedures: [],
    totalCount: 0,
    totalRevenue: 0,
  })
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const result = await getProceduresStats(month, year)
    setData(result)
    setLoading(false)
  }, [month, year])

  useEffect(() => {
    loadData()
  }, [loadData])

  return { ...data, loading }
}
