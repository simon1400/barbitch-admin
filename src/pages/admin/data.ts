// Месяцы
export const monthLabels = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

export const blockStatsItems = (
  salary: number,
  length: number,
  extraProfit: number,
  payrolls: number,
  penalty: number,
  result: number,
  tipSum: number,
) => [
  {
    title: 'Заработано за кл.',
    value: `${salary.toLocaleString()} Kč`,
  },
  {
    title: 'Чаевые',
    value: `${tipSum.toLocaleString()} Kč`,
  },
  {
    title: 'Доп. зароботок',
    value: `${extraProfit.toLocaleString()} Kč`,
  },
  {
    title: 'Штрафы',
    value: `-${penalty.toLocaleString()} Kč`,
  },
  {
    title: 'Списывание за усл.',
    value: `-${payrolls.toLocaleString()} Kč`,
  },
  {
    title: 'Кол. клиентов',
    value: length,
  },
  {
    title: 'Результат за месяц',
    value: `${result.toLocaleString()} Kč`,
  },
]
