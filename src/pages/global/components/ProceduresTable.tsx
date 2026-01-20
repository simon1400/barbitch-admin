import { useState, useMemo } from 'react'

import type { ProcedureStats } from '../fetch/proceduresStats'

import { Cell } from '../../dashboard/components/Cell'
import { TableWrapper } from './TableWrapper'

type SortField = 'name' | 'count' | 'totalRevenue'
type SortDirection = 'asc' | 'desc'

interface ProceduresTableProps {
  data: ProcedureStats[]
  totalCount: number
  totalRevenue: number
  loading: boolean
}

export const ProceduresTable = ({ data, totalCount, totalRevenue, loading }: ProceduresTableProps) => {
  const [sortField, setSortField] = useState<SortField>('count')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue, 'ru')
          : bValue.localeCompare(aValue, 'ru')
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }

      return 0
    })
  }, [data, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕'
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Нет данных за выбранный период
      </div>
    )
  }

  return (
    <TableWrapper
      totalSum={`${totalRevenue.toLocaleString()} Kč`}
      totalLabel={`Всего процедур: ${totalCount.toLocaleString()}`}
    >
      <table className="w-full text-left table-auto min-w-max">
        <thead>
          <tr>
            <th
              className="p-4 border-b border-blue-gray-100 bg-blue-gray-50 cursor-pointer hover:bg-blue-gray-100 transition-colors"
              onClick={() => handleSort('name')}
            >
              <p className="flex items-center gap-2 font-sans text-sm font-normal text-blue-gray-900 opacity-70">
                Название процедуры
                <span className="text-xs">{getSortIcon('name')}</span>
              </p>
            </th>
            <th
              className="p-4 border-b border-blue-gray-100 bg-blue-gray-50 cursor-pointer hover:bg-blue-gray-100 transition-colors"
              onClick={() => handleSort('count')}
            >
              <p className="flex items-center gap-2 font-sans text-sm font-normal text-blue-gray-900 opacity-70">
                Количество
                <span className="text-xs">{getSortIcon('count')}</span>
              </p>
            </th>
            <th
              className="p-4 border-b border-blue-gray-100 bg-blue-gray-50 cursor-pointer hover:bg-blue-gray-100 transition-colors"
              onClick={() => handleSort('totalRevenue')}
            >
              <p className="flex items-center gap-2 font-sans text-sm font-normal text-blue-gray-900 opacity-70">
                Общая выручка
                <span className="text-xs">{getSortIcon('totalRevenue')}</span>
              </p>
            </th>
            <th className="p-4 border-b border-blue-gray-100 bg-blue-gray-50">
              <p className="font-sans text-sm font-normal text-blue-gray-900 opacity-70">
                Ср. чек
              </p>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item, index) => {
            const averageCheck = item.count > 0 ? Math.round(item.totalRevenue / item.count) : 0

            return (
              <tr key={`${item.name}-${index}`} className="hover:bg-gray-50 transition-colors">
                <Cell title={item.name} />
                <Cell title={item.count.toLocaleString()} />
                <Cell
                  className="text-primary font-semibold"
                  title={`${item.totalRevenue.toLocaleString()} Kč`}
                />
                <Cell title={`${averageCheck.toLocaleString()} Kč`} />
              </tr>
            )
          })}
        </tbody>
      </table>
    </TableWrapper>
  )
}
