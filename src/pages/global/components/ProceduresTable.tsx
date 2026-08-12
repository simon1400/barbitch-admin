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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">
        Нет данных за выбранный период
      </div>
    )
  }

  return (
    <TableWrapper
      totalSum={`${totalRevenue.toLocaleString()} Kč`}
      totalLabel={`Всего процедур: ${totalCount.toLocaleString()}`}
    >
      {/* Названия комбо-услуг из снапшота брони («Gel lak manikúra + Francouzská
          manikúra + Posílení nehtů + …») длиннее экрана → min-w-max растягивал
          таблицу и включал горизонтальный скролл на десктопе. Теперь колонка
          названия переносится по словам, числовые колонки ужимаются по контенту
          (w-px + nowrap), а min-w нужен только чтобы таблица не схлопывалась на
          узком телефоне. */}
      <table className="w-full text-left min-w-[560px]">
        <thead>
          <tr>
            <th
              className="px-3 py-[7px] text-left border-b border-line cursor-pointer select-none"
              onClick={() => handleSort('name')}
            >
              <p className="flex items-center gap-2 text-[10.5px] font-bold tracking-[0.06em] uppercase text-ink-label whitespace-nowrap">
                Название процедуры
                <span className="text-[10px]">{getSortIcon('name')}</span>
              </p>
            </th>
            <th
              className="w-px whitespace-nowrap px-3 py-[7px] text-left border-b border-line cursor-pointer select-none"
              onClick={() => handleSort('count')}
            >
              <p className="flex items-center gap-2 text-[10.5px] font-bold tracking-[0.06em] uppercase text-ink-label whitespace-nowrap">
                Количество
                <span className="text-[10px]">{getSortIcon('count')}</span>
              </p>
            </th>
            <th
              className="w-px whitespace-nowrap px-3 py-[7px] text-left border-b border-line cursor-pointer select-none"
              onClick={() => handleSort('totalRevenue')}
            >
              <p className="flex items-center gap-2 text-[10.5px] font-bold tracking-[0.06em] uppercase text-ink-label whitespace-nowrap">
                Общая выручка
                <span className="text-[10px]">{getSortIcon('totalRevenue')}</span>
              </p>
            </th>
            <th className="w-px whitespace-nowrap px-3 py-[7px] text-left border-b border-line">
              <p className="text-[10.5px] font-bold tracking-[0.06em] uppercase text-ink-label whitespace-nowrap">
                Ср. чек
              </p>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item, index) => {
            const averageCheck = item.count > 0 ? Math.round(item.totalRevenue / item.count) : 0

            return (
              <tr key={`${item.name}-${index}`} className="hover:bg-surface-hover transition-colors">
                <Cell className="break-words" title={item.name} />
                <Cell className="whitespace-nowrap" title={item.count.toLocaleString()} />
                <Cell
                  className="whitespace-nowrap text-brand-dark font-extrabold"
                  title={`${item.totalRevenue.toLocaleString()} Kč`}
                />
                <Cell className="whitespace-nowrap" title={`${averageCheck.toLocaleString()} Kč`} />
              </tr>
            )
          })}
        </tbody>
      </table>
    </TableWrapper>
  )
}
