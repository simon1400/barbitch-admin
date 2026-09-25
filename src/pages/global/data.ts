import { kcExact, kcNum } from "../../utils/money"

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
  // управляющие (s213): оклад + корректировки; нет — 0
  sumManagers?: number
  noDphCosts: number
  taxesSum: number
}): number =>
  args.cashMoney +
  args.cardExtraIncome +
  (args.cardMoney + args.qrMoney) / 1.21 -
  args.sumMasters -
  args.sumAdmins -
  args.sumCombined -
  (args.sumManagers ?? 0) -
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
  // управляющие (s213) — зарплата целиком (оклад + корректировки); это расход салона,
  // поэтому вычитается и из «Результат по услугам», как зарплаты админов
  sumManagers = 0,
) => {
  const items = [
    {
      title: 'Оборот',
      value: `${kcNum(globalFlow)} Kč`,
      tone: 'accent' as const,
    },
    {
      title: 'Результат за месяц',
      value: `${kcExact(
        computeMonthResult({
          cashMoney,
          cardExtraIncome,
          cardMoney,
          qrMoney,
          sumMasters,
          sumAdmins,
          sumCombined,
          sumManagers,
          noDphCosts,
          taxesSum,
        })
      )}`,
      addValue: `${kcExact(cashMoney + cardMoney + qrMoney + cardExtraIncome - sumMasters - sumAdmins - sumCombined - sumManagers - dphCosts - taxesSum)} - s DPH`,
    },
    {
      title: 'Разниця',
      value: `${kcNum(cardMoney + cardExtraIncome + cashMoney + payrollSum + voucherRealized + qrMoney - globalFlow - extraMoney - voucherPayed)} Kč`,
    },
    {
      title: 'Затраты на салон',
      value: `${kcNum(noDphCosts)}`,
    },
    {
      title: 'Зарплаты мастерам',
      value: `${kcNum(sumMasters)}`,
    },
    {
      title: 'Зарплаты админам',
      value: `${kcNum(sumAdmins)}`,
    },
    ...(sumCombined !== 0
      ? [{ title: 'Зарплаты совместителям', value: `${kcNum(sumCombined)}` }]
      : []),
    ...(sumManagers !== 0
      ? [{ title: 'Зарплата управляющей', value: `${kcNum(sumManagers)}` }]
      : []),
    {
      title: 'Налоги',
      value: `${kcNum(taxesSum)}`,
    },
    {
      title: 'Результат по услугам',
      value: `${kcExact(salonSalariesCash + cardExtraIncome + salonSalariesCard - sumAdmins - combinedAdminEarnings - sumManagers - noDphCosts)}`,
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
    tone: 'accent' as const,
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
