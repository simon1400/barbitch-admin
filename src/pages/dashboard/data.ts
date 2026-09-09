import { kcNum } from '../../utils/money'
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

// «Výsledek za měsíc» показывается отдельным градиентным блоком в OptimizedWorks, не плиткой
export const blockStatsItems = (
  salary: number,
  length: number,
  extraProfit: number,
  payrolls: number,
  penalty: number,
  tipSum: number,
) => [
  {
    title: 'Vyděláno za klienty',
    value: `${kcNum(salary)} Kč`,
  },
  {
    title: 'Spropitné',
    value: `${kcNum(tipSum)} Kč`,
  },
  {
    title: 'Přídavný výdělek',
    value: `${kcNum(extraProfit)} Kč`,
  },
  {
    title: 'Pokuty',
    value: `-${kcNum(penalty)} Kč`,
  },
  {
    title: 'Odpis za služby',
    value: `-${kcNum(payrolls)} Kč`,
  },
  {
    title: 'Počet klientů',
    value: length,
  },
]
