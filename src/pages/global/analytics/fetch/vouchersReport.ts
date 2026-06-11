import qs from 'qs'
import { Axios } from '../../../../lib/api'

// Отчёт по ваучерам (Strapi коллекция vouchers).
// Жизненный цикл: dateOrder (заказан) → datePay (оплачен) → dateRealized (использован).
// «Висит» (liability) = оплачен, но не использован — обязательство салона.

export interface VoucherRecord {
  id: number
  documentId: string
  name: string
  forWhom: string
  sum: number
  dateOrder: string
  datePay: string | null
  dateRealized: string | null
  idVoucher: string
}

export interface VoucherMonthRow {
  month: string // 'YYYY-MM'
  label: string
  orderedCount: number
  paidCount: number
  paidSum: number
  realizedCount: number
  realizedSum: number
}

export interface VouchersReport {
  paidTotalCount: number
  paidTotalSum: number
  realizedTotalCount: number
  realizedTotalSum: number
  outstandingCount: number
  outstandingSum: number
  outstanding: VoucherRecord[] // оплачены, не реализованы — по возрасту
  byMonth: VoucherMonthRow[] // последние 12 месяцев
}

const MONTHS_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
const monthLabel = (m: string) => {
  const [y, mm] = m.split('-')
  return `${MONTHS_RU[Number(mm) - 1]} ${y}`
}

const fetchAllVouchers = async (): Promise<VoucherRecord[]> => {
  const result: VoucherRecord[] = []
  let page = 1
  for (;;) {
    const query = qs.stringify(
      {
        fields: ['name', 'for', 'sum', 'dateOrder', 'datePay', 'dateRealized', 'idVoucher'],
        sort: ['dateOrder:desc'],
        pagination: { page, pageSize: 500 },
      },
      { encodeValuesOnly: true },
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await Axios.get<any>(`/api/vouchers?${query}`)
    const data: Array<Record<string, unknown>> = Array.isArray(res) ? res : []
    for (const v of data) {
      result.push({
        id: Number(v.id) || 0,
        documentId: String(v.documentId ?? ''),
        name: String(v.name ?? '—'),
        forWhom: String(v.for ?? ''),
        sum: Number(v.sum) || 0,
        dateOrder: String(v.dateOrder ?? ''),
        datePay: v.datePay ? String(v.datePay) : null,
        dateRealized: v.dateRealized ? String(v.dateRealized) : null,
        idVoucher: String(v.idVoucher ?? ''),
      })
    }
    if (data.length < 500) break
    page++
  }
  return result
}

export const getVouchersReport = async (): Promise<VouchersReport> => {
  const vouchers = await fetchAllVouchers()

  let paidTotalCount = 0
  let paidTotalSum = 0
  let realizedTotalCount = 0
  let realizedTotalSum = 0
  const outstanding: VoucherRecord[] = []
  const months = new Map<string, VoucherMonthRow>()

  const monthRow = (m: string): VoucherMonthRow => {
    let row = months.get(m)
    if (!row) {
      row = {
        month: m,
        label: monthLabel(m),
        orderedCount: 0,
        paidCount: 0,
        paidSum: 0,
        realizedCount: 0,
        realizedSum: 0,
      }
      months.set(m, row)
    }
    return row
  }

  for (const v of vouchers) {
    if (v.dateOrder) monthRow(v.dateOrder.slice(0, 7)).orderedCount++
    if (v.datePay) {
      paidTotalCount++
      paidTotalSum += v.sum
      const r = monthRow(v.datePay.slice(0, 7))
      r.paidCount++
      r.paidSum += v.sum
      if (!v.dateRealized) outstanding.push(v)
    }
    if (v.dateRealized) {
      realizedTotalCount++
      realizedTotalSum += v.sum
      const r = monthRow(v.dateRealized.slice(0, 7))
      r.realizedCount++
      r.realizedSum += v.sum
    }
  }

  outstanding.sort((a, b) => (a.datePay! < b.datePay! ? -1 : 1)) // старые сверху

  // последние 12 месяцев включая текущий
  const now = new Date()
  const byMonth: VoucherMonthRow[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    byMonth.push(months.get(m) ?? monthRow(m))
  }

  return {
    paidTotalCount,
    paidTotalSum,
    realizedTotalCount,
    realizedTotalSum,
    outstandingCount: outstanding.length,
    outstandingSum: outstanding.reduce((a, v) => a + v.sum, 0),
    outstanding,
    byMonth,
  }
}
