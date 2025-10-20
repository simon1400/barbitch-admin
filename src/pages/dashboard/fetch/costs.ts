import { getMonthRange } from '../../../utils/getMonthRange'

import { Axios } from '../../../lib/api'

import { buildQueryCost } from './fetchHelpers'

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
  cashMoney: number
  payrollSum: number
  voucherRealizedSum: number
  voucherPayedSum: number
  extraMoneySum: number
  qrMoney: number
}

export const getMoney = async (month: number): Promise<ICombineData> => {
  const { firstDay, lastDay } = getMonthRange(2025, month)

  const [
    dataCosts,
    dataCard,
    dataExtra,
    dataCash,
    dataPayroll,
    dataVouchersRealized,
    dataVouchersPayed,
    dataQrMoney,
  ] = await Promise.all([
    Axios.get<IDataCosts[]>(
      `/api/costs?${buildQueryCost(['sum', 'noDph'], 'date', firstDay, lastDay)}`,
    ),
    Axios.get<IDataCosts[]>(
      `/api/card-profits?${buildQueryCost(['sum'], 'date', firstDay, lastDay)}`,
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
  ])

  const sumReducer = (arr: { sum: number }[]) =>
    arr.reduce((acc, item) => acc + Number(item.sum), 0)
  const noDphReducer = (arr: IDataCosts[]) =>
    arr.reduce((acc, item) => acc + (Number(item.noDph) || 0), 0)

  const maxProfit = (dataCash as any).reduce((max: number, item: { profit: number }) => {
    const profit = Number(item.profit) || 0
    return Math.max(max, profit)
  }, 0)

  return {
    sumCosts: sumReducer(dataCosts as any),
    sumNoDphCosts: noDphReducer(dataCosts as any),
    cardMoney: Number((dataCard as any)?.[0]?.sum || 0),
    cashMoney: maxProfit,
    payrollSum: sumReducer(dataPayroll as any),
    voucherRealizedSum: sumReducer(dataVouchersRealized as any),
    voucherPayedSum: sumReducer(dataVouchersPayed as any),
    extraMoneySum: sumReducer(dataExtra as any),
    qrMoney: sumReducer(dataQrMoney as any),
  }
}
