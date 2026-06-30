import { toLocalStringDigits } from "../../utils/toLocalString"

// Единый источник формулы «Результат за месяц» (без DPH) — используется и в
// blockStateItems (главная), и в помесячной разбивке «Глобальной статистики».
export const computeMonthResult = (args: {
  cashMoney: number
  cardExtraIncome: number
  cardMoney: number
  qrMoney: number
  sumMasters: number
  sumAdmins: number
  sumCombined: number
  noDphCosts: number
  taxesSum: number
}): number =>
  args.cashMoney +
  args.cardExtraIncome +
  (args.cardMoney + args.qrMoney) / 1.21 -
  args.sumMasters -
  args.sumAdmins -
  args.sumCombined -
  args.noDphCosts -
  args.taxesSum

export const blockStateItems = (
  noDphCosts: number,
  globalFlow: number,
  cashMoney: number,
  cardMoney: number,
  cardExtraIncome: number,
  sumMasters: number,
  sumAdmins: number,
  payrollSum: number,
  voucherRealized: number,
  voucherPayed: number,
  qrMoney: number,
  extraMoney: number,
  dphCosts: number,
  salonSalariesCash: number,
  salonSalariesCard: number,
  taxesSum: number,
  // Совместители (мастер+администратор) — их полная зарплата. Инвариант splitTeam:
  // sumMasters + sumAdmins + sumCombined === старый (sumMasters + sumAdmins), поэтому
  // итог «Результат за месяц» численно не меняется. combinedAdminEarnings — только
  // админ-часы совместителей (для «Результат по услугам», как и обычные админы).
  sumCombined = 0,
  combinedAdminEarnings = 0,
) => {
  const items = [
    {
      title: 'Оборот',
      value: `${globalFlow.toLocaleString()} Kč`,
    },
    {
      title: 'Результат за месяц',
      value: `${toLocalStringDigits(
        computeMonthResult({
          cashMoney,
          cardExtraIncome,
          cardMoney,
          qrMoney,
          sumMasters,
          sumAdmins,
          sumCombined,
          noDphCosts,
          taxesSum,
        })
      )}`,
      addValue: `${toLocalStringDigits(cashMoney + cardMoney + qrMoney + cardExtraIncome - sumMasters - sumAdmins - sumCombined - dphCosts - taxesSum)} - s DPH`,
    },
    {
      title: 'Разниця',
      value: `${(cardMoney + cardExtraIncome + cashMoney + payrollSum + voucherRealized + qrMoney - globalFlow - extraMoney - voucherPayed).toLocaleString()} Kč`,
    },
    {
      title: 'Затраты на салон',
      value: `${noDphCosts.toLocaleString()}`,
    },
    {
      title: 'Зарплаты мастерам',
      value: `${sumMasters.toLocaleString()}`,
    },
    {
      title: 'Зарплаты админам',
      value: `${sumAdmins.toLocaleString()}`,
    },
    ...(sumCombined !== 0
      ? [{ title: 'Зарплаты совместителям', value: `${sumCombined.toLocaleString()}` }]
      : []),
    {
      title: 'Налоги',
      value: `${taxesSum.toLocaleString()}`,
    },
    {
      title: 'Результат по услугам',
      value: `${toLocalStringDigits(salonSalariesCash + cardExtraIncome + salonSalariesCard - sumAdmins - combinedAdminEarnings - noDphCosts)}`,
    },
  ]

  return items
}

export const blockReservationsItems = (
  clientsAll: number,
  clientsPayed: number,
  clientsNoshow: number,
  clientsCanceled: number,
  // clientsFree: number,
  clientsFixed: number,
  // clientsPersonal: number,
  sumClientsDone: number,
  clientsPastPayed: number,
  countCreatedMonthReservation: number,
  countCreatedTodayReservation: number,
  monthReservationIndex: number,
) => [
  {
    title: 'Резервации все',
    value: clientsAll,
  },
  {
    title: 'Реалз. / Все Платные',
    value: `${clientsPastPayed} / ${clientsPayed}`,
  },
  {
    title: 'Осталось платных',
    value: `${clientsPayed - clientsPastPayed}`,
  },
  {
    title: 'Все проведенные',
    value: sumClientsDone,
  },
  {
    title: 'Не пришли',
    value: clientsNoshow,
  },
  {
    title: 'Отменили',
    value: clientsCanceled,
  },
  // {
  //   title: 'Бесплатные',
  //   value: clientsFree,
  // },
  {
    title: 'Оправа',
    value: clientsFixed,
  },
  // {
  //   title: 'Персонал',
  //   value: clientsPersonal,
  // },
  {
    title: 'Зарезерв. за месяц',
    value: countCreatedMonthReservation,
  },
  {
    title: 'Сегодня зарезерв.',
    value: countCreatedTodayReservation,
  },
  {
    title: 'Индекс резерваций',
    value: monthReservationIndex,
  },
]
