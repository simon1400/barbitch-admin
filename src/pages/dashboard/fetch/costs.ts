/* eslint-disable @typescript-eslint/no-explicit-any */
import { getMonthRange } from '../../../utils/getMonthRange'

import { Axios } from '../../../lib/api'

import { buildQueryCost, fetchDayDrafts } from './fetchHelpers'

// Preview a shift close without saving: merge a day's drafts + use the entered card values.
export interface ShiftPreview {
  day: string // YYYY-MM-DD
  cardSum: number
  extraIncome: number
}

export interface IDataCosts {
  sum: number
  noDph?: number
}

export interface IDataCash {
  profit: string
}

export interface ICombineData {
  sumCosts: number
  sumNoDphCosts: number
  cardMoney: number
  cardExtraIncome: number
  cashMoney: number
  payrollSum: number
  voucherRealizedSum: number
  voucherPayedSum: number
  extraMoneySum: number
  qrMoney: number
  taxesSum: number
}

export const getMoney = async (
  month: number,
  year: number,
  preview?: ShiftPreview,
): Promise<ICombineData> => {
  const { firstDay, lastDay } = getMonthRange(year, month)

  const [
    dataCosts,
    dataCard,
    dataExtra,
    dataCash,
    dataPayroll,
    dataVouchersRealized,
    dataVouchersPayed,
    dataQrMoney,
    dataTaxes,
  ] = await Promise.all([
    Axios.get<IDataCosts[]>(
      `/api/costs?${buildQueryCost(['sum', 'noDph'], 'date', firstDay, lastDay)}`,
    ),
    Axios.get<IDataCosts[]>(
      `/api/card-profits?${buildQueryCost(['sum', 'extraIncome'], 'date', firstDay, lastDay)}`,
    ),
    Axios.get<IDataCosts[]>(
      `/api/extra-profits?${buildQueryCost(['sum'], 'date', firstDay, lastDay)}`,
    ),
    Axios.get<IDataCash[]>(`/api/cashs?${buildQueryCost(['profit'], 'date', firstDay, lastDay)}`),
    Axios.get<IDataCosts[]>(`/api/payrolls?${buildQueryCost(['sum'], 'date', firstDay, lastDay)}`),
    Axios.get<IDataCosts[]>(
      `/api/vouchers?${buildQueryCost(['sum'], 'dateRealized', firstDay, lastDay)}`,
    ),
    Axios.get<IDataCosts[]>(
      `/api/vouchers?${buildQueryCost(['sum'], 'datePay', firstDay, lastDay)}`,
    ),
    Axios.get<IDataCosts[]>(`/api/qr-pays?${buildQueryCost(['sum'], 'date', firstDay, lastDay)}`),
    Axios.get<IDataCosts[]>(`/api/taxes?${buildQueryCost(['sum'], 'date', firstDay, lastDay)}`),
  ])

  const sumReducer = (arr: { sum: number }[]) =>
    arr.reduce((acc, item) => acc + Number(item.sum), 0)
  const noDphReducer = (arr: IDataCosts[]) =>
    arr.reduce((acc, item) => acc + (Number(item.noDph) || 0), 0)

  // Preview: fold in the day's drafts that publishing would make visible. Only the
  // collections the shift close actually publishes/changes are merged here; everything
  // else (costs, qr, extra-profits, taxes, paid vouchers) is untouched by a close.
  let cashArr: any[] = dataCash as any
  let payrollArr: any[] = dataPayroll as any
  let realizedArr: any[] = dataVouchersRealized as any
  if (preview) {
    const [draftCash, draftPayroll, draftServices] = await Promise.all([
      fetchDayDrafts<IDataCash>('/api/cashs', ['profit'], 'date', preview.day),
      fetchDayDrafts<IDataCosts>('/api/payrolls', ['sum'], 'date', preview.day),
      fetchDayDrafts<any>('/api/services-provided', ['id'], 'date', preview.day, {
        voucher: { fields: ['sum'] },
      }),
    ])
    cashArr = [...cashArr, ...draftCash]
    payrollArr = [...payrollArr, ...draftPayroll]
    // Vouchers attached to the day's services get dateRealized = day on close → they
    // would join this month's realized vouchers. Dedup (one voucher may cover several).
    const seen = new Set<any>()
    const addRealized: { sum: number }[] = []
    for (const s of draftServices) {
      const v = s?.voucher
      const key = v?.documentId ?? v?.id ?? (v ? JSON.stringify(v) : null)
      if (v && key != null && !seen.has(key)) {
        seen.add(key)
        addRealized.push({ sum: Number(v.sum) || 0 })
      }
    }
    realizedArr = [...realizedArr, ...addRealized]
  }

  const maxProfit = cashArr.reduce((max: number, item: { profit: number }) => {
    const profit = Number(item.profit) || 0
    return Math.max(max, profit)
  }, 0)

  return {
    sumCosts: sumReducer(dataCosts as any),
    sumNoDphCosts: noDphReducer(dataCosts as any),
    // Card-profit is the single monthly cumulative record the close overwrites — in
    // preview we use the entered values directly instead of the saved ones.
    cardMoney: preview ? preview.cardSum : sumReducer(dataCard as any),
    cardExtraIncome: preview
      ? preview.extraIncome
      : (dataCard as any).reduce((acc: number, item: any) => acc + Number(item.extraIncome || 0), 0),
    cashMoney: maxProfit,
    payrollSum: sumReducer(payrollArr),
    voucherRealizedSum: sumReducer(realizedArr),
    voucherPayedSum: sumReducer(dataVouchersPayed as any),
    extraMoneySum: sumReducer(dataExtra as any),
    qrMoney: sumReducer(dataQrMoney as any),
    taxesSum: sumReducer(dataTaxes as any),
  }
}

// export const getMoneyByDateRange = async (
//   startDate: Date,
//   endDate: Date,
// ): Promise<ICombineData> => {
//   const [
//     dataCosts,
//     dataCard,
//     dataExtra,
//     dataCash,
//     dataPayroll,
//     dataVouchersRealized,
//     dataVouchersPayed,
//     dataQrMoney,
//   ] = await Promise.all([
//     Axios.get<IDataCosts[]>(
//       `/api/costs?${buildQueryCost(['sum', 'noDph'], 'date', startDate, endDate)}`,
//     ),
//     Axios.get<IDataCosts[]>(
//       `/api/card-profits?${buildQueryCost(['sum', 'extraIncome'], 'date', startDate, endDate)}`,
//     ),
//     Axios.get<IDataCosts[]>(
//       `/api/extra-profits?${buildQueryCost(['sum'], 'date', startDate, endDate)}`,
//     ),
//     Axios.get<IDataCash[]>(
//       `/api/cashs?${buildQueryCost(['profit'], 'date', startDate, endDate)}`,
//     ),
//     Axios.get<IDataCosts[]>(
//       `/api/payrolls?${buildQueryCost(['sum'], 'date', startDate, endDate)}`,
//     ),
//     Axios.get<IDataCosts[]>(
//       `/api/vouchers?${buildQueryCost(['sum'], 'dateRealized', startDate, endDate)}`,
//     ),
//     Axios.get<IDataCosts[]>(
//       `/api/vouchers?${buildQueryCost(['sum'], 'datePay', startDate, endDate)}`,
//     ),
//     Axios.get<IDataCosts[]>(
//       `/api/qr-pays?${buildQueryCost(['sum'], 'date', startDate, endDate)}`,
//     ),
//   ])

//   const sumReducer = (arr: { sum: number }[]) =>
//     arr.reduce((acc, item) => acc + Number(item.sum), 0)
//   const noDphReducer = (arr: IDataCosts[]) =>
//     arr.reduce((acc, item) => acc + (Number(item.noDph) || 0), 0)

//   const maxProfit = (dataCash as any).reduce((max: number, item: { profit: number }) => {
//     const profit = Number(item.profit) || 0
//     return Math.max(max, profit)
//   }, 0)

//   return {
//     sumCosts: sumReducer(dataCosts as any),
//     sumNoDphCosts: noDphReducer(dataCosts as any),
//     cardMoney: Number((dataCard as any)?.[0]?.sum || 0),
//     cardExtraIncome: Number((dataCard as any)?.[0]?.extraIncome || 0),
//     cashMoney: maxProfit,
//     payrollSum: sumReducer(dataPayroll as any),
//     voucherRealizedSum: sumReducer(dataVouchersRealized as any),
//     voucherPayedSum: sumReducer(dataVouchersPayed as any),
//     extraMoneySum: sumReducer(dataExtra as any),
//     qrMoney: sumReducer(dataQrMoney as any),
//   }
// }
