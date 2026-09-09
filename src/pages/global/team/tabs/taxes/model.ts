// Модель строки калькулятора налогов. Вынесено из TaxesTab.tsx в этапе 6
// аудита — ПЕРЕНОС без изменений: и форма строки, и newRow дословно те же.
import type { ContractType } from '../../fetch/czechTax'

// Одна карточка = один сотрудник за месяц. Живёт только в state —
// калькулятор, ничего не сохраняется (решение владельца).
export interface Row {
  id: string
  name: string
  contract: ContractType
  prohlaseni: boolean
  healthMinimum: boolean
  dppAboveLimit: boolean
  net: string
  sickDays: string
  vacationPaidDays: string
  vacationUnpaidDays: string
}

export const newRow = (name = ''): Row => ({
  id: crypto.randomUUID(),
  name,
  contract: 'hpp',
  prohlaseni: true,
  healthMinimum: true,
  dppAboveLimit: false,
  net: '',
  sickDays: '0',
  vacationPaidDays: '0',
  vacationUnpaidDays: '0',
})
