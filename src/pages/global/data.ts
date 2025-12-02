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
) => [
  {
    title: 'За услуги',
    value: `${globalFlow.toLocaleString()} Kč`,
  },
  {
    title: 'Результат за месяц',
    value: `${(
      cashMoney +
      (cardMoney + qrMoney + cardExtraIncome) / 1.21 -
      sumMasters -
      sumAdmins -
      noDphCosts
    ).toLocaleString('cz-CZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    addValue: `${(cashMoney + cardMoney + qrMoney + cardExtraIncome - sumMasters - sumAdmins - dphCosts).toLocaleString(
      'cz-CZ',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    )} - s DPH`,
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
]

export const blockReservationsItems = (
  clientsAll: number,
  clientsPayed: number,
  clientsNoshow: number,
  clientsCanceled: number,
  clientsFree: number,
  clientsFixed: number,
  clientsPersonal: number,
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
  {
    title: 'Бесплатные',
    value: clientsFree,
  },
  {
    title: 'Оправа',
    value: clientsFixed,
  },
  {
    title: 'Персонал',
    value: clientsPersonal,
  },
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
