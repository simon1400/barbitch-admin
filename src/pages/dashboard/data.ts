// Měsíce
export const monthLabels = [
  'Leden',
  'Únor',
  'Březen',
  'Duben',
  'Květen',
  'Červen',
  'Červenec',
  'Srpen',
  'Září',
  'Říjen',
  'Listopad',
  'Prosinec',
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
    title: 'Vyděláno za klienty',
    value: `${salary.toLocaleString()} Kč`,
  },
  {
    title: 'Spropitné',
    value: `${tipSum.toLocaleString()} Kč`,
  },
  {
    title: 'Přídavný výdělek',
    value: `${extraProfit.toLocaleString()} Kč`,
  },
  {
    title: 'Pokuty',
    value: `-${penalty.toLocaleString()} Kč`,
  },
  {
    title: 'Odpis za služby',
    value: `-${payrolls.toLocaleString()} Kč`,
  },
  {
    title: 'Počet klientů',
    value: length,
  },
  {
    title: 'Výsledek za měsíc',
    value: `${result.toLocaleString()} Kč`,
  },
]
