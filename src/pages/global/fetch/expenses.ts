/* eslint-disable @typescript-eslint/no-explicit-any */
import qs from 'qs'
import { getMonthRange } from '../../../utils/getMonthRange'
import { Axios } from '../../../lib/api'

export interface IExpenseItem {
  id: string
  name: string
  date: string
  sum: number
  noDph?: number
  comment?: string
  category?: string
}

export const getExpenses = async (month: number, year: number): Promise<IExpenseItem[]> => {
  const { firstDay, lastDay } = getMonthRange(year, month)

  const query = qs.stringify(
    {
      filters: {
        date: {
          $gte: firstDay.toISOString(),
          $lte: lastDay.toISOString(),
        },
      },
      fields: ['name', 'sum', 'date', 'comment', 'noDph', 'category'],
      sort: ['date:desc'],
      pagination: {
        page: 1,
        pageSize: 500,
      },
    },
    { encodeValuesOnly: true }
  )

  try {
    const response = await Axios.get<any[]>(`/api/costs?${query}`)

    return response.map((item: any) => ({
      id: item.id || item._id,
      name: item.name || 'Без названия',
      date: item.date,
      sum: Number(item.sum) || 0,
      noDph: Number(item.noDph) || 0,
      comment: item.comment || '',
      category: item.category || 'Другое',
    }))
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return []
  }
}

export const getAllExpenses = async (): Promise<IExpenseItem[]> => {
  const query = qs.stringify(
    {
      fields: ['name', 'sum', 'date', 'comment', 'noDph', 'category'],
      sort: ['date:desc'],
      pagination: {
        page: 1,
        pageSize: 5000,
      },
    },
    { encodeValuesOnly: true }
  )

  try {
    const response = await Axios.get<any[]>(`/api/costs?${query}`)

    return response.map((item: any) => ({
      id: item.id || item._id,
      name: item.name || 'Без названия',
      date: item.date,
      sum: Number(item.sum) || 0,
      noDph: Number(item.noDph) || 0,
      comment: item.comment || '',
      category: item.category || 'Другое',
    }))
  } catch (error) {
    console.error('Error fetching all expenses:', error)
    return []
  }
}
