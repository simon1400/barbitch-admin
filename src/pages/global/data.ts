import { fmtCsDate } from '../../utils/date'
import { kc, kcExact, kcNum } from '../../utils/money'
import type { OwnerOverview } from './fetch/ownerOverview'

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
  // s258: число проведённых услуг — для среднего чека (оборот / услуги)
  sumClientsDone = 0,
) => {
  const items = [
    {
      title: 'Оборот',
      value: `${kcNum(globalFlow)} Kč`,
      tone: 'accent' as const,
      // s258: нал / безнал (карта + QR) по записям закрытия смен
      addValue: `нал ${kcNum(cashMoney)} · безнал ${kcNum(cardMoney + qrMoney)}`,
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
    {
      title: 'Средний чек',
      value: `${kcNum(sumClientsDone > 0 ? globalFlow / sumClientsDone : 0)} Kč`,
      addValue: `${sumClientsDone} услуг`,
    },
  ]

  return items
}

// s258: «Коррекции» — бесплатные «Korekce do 5 dnů» (брони с флагом `korekce`), раньше
// плитка «Оправа» всегда показывала 0 (цвет Noona, которого больше нет). «Платные» — без
// них. «Не пришли» и «Отменили» — с долей от всех броней месяца, чтобы видеть тенденцию.
const pct = (part: number, whole: number): string => (whole > 0 ? `${Math.round((part / whole) * 100)} % от всех` : '')

export const blockReservationsItems = (
  clientsAll: number,
  clientsPayed: number,
  clientsNoshow: number,
  clientsCanceled: number,
  clientsFixed: number,
  sumClientsDone: number,
  clientsPastPayed: number,
  countCreatedMonthReservation: number,
  monthReservationIndex: number,
) => [
  {
    title: 'Резервации все',
    value: clientsAll,
    tone: 'accent' as const,
    addValue: 'без интерных',
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
    addValue: 'записей об услугах',
  },
  {
    title: 'Не пришли',
    value: clientsNoshow,
    addValue: pct(clientsNoshow, clientsAll),
  },
  {
    title: 'Отменили',
    value: clientsCanceled,
    addValue: pct(clientsCanceled, clientsAll),
  },
  {
    title: 'Коррекции',
    value: clientsFixed,
    addValue: 'бесплатные, Korekce do 5 dnů',
  },
  {
    title: 'Зарезерв. за месяц',
    value: countCreatedMonthReservation,
    addValue: 'создано броней',
  },
  {
    title: 'Броней в день',
    value: monthReservationIndex,
    addValue: 'создано за месяц / дней',
  },
]

const signed = (v: number): string => `${v > 0 ? '+' : ''}${kcNum(v)} Kč`

// s258: «Сейчас» — касса и последняя закрытая смена по ответу `/engine/admin/overview`.
export const blockNowItems = (o: OwnerOverview | null) => {
  const cash = o?.cash ?? null
  const shift = o?.lastShift ?? null
  return [
    {
      title: 'В кассе',
      value: cash ? kc(cash.balance) : '—',
      tone: 'accent' as const,
      addValue: cash
        ? `по записи ${fmtCsDate(cash.date)} · ${cash.closed ? 'смена закрыта' : 'смена ещё не закрыта'}`
        : 'записей кассы пока нет',
    },
    {
      title: 'Наличными за смену',
      value: cash ? signed(cash.income) : '—',
      addValue: cash ? `расход ${kcNum(cash.outflow)} Kč · ${fmtCsDate(cash.date)}${cash.name ? ` · ${cash.name}` : ''}` : '',
    },
    {
      title: 'Результат последней смены',
      value: shift?.result ? signed(shift.result.after - shift.result.before) : '—',
      addValue: !shift
        ? 'закрытий смен в журнале пока нет'
        : shift.result
          ? `${fmtCsDate(shift.date)} · закрыл(а) ${shift.by}`
          : `${fmtCsDate(shift.date)} · результат появится после следующего закрытия`,
    },
  ]
}
