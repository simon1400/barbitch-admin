// Запись уплаченных налогов из калькулятора в «Корректировки» (s285, просьба
// владельца): посчитал месяц, сверил с выписками — и одной кнопкой заводит за
// сотрудника три записи типа «Налоги» (zdravotní / sociální / daň FÚ) за месяц
// расчёта (`period`), датой сегодняшнего дня (реальный день уплаты).
import {
  createCorrection,
  fetchCorrections,
  monthKey,
  type CorrectionRow,
  type TaxType,
} from '../../fetch/corrections'
import type { EmployeeTaxResult } from '../../fetch/czechTax'

export interface TaxEntry {
  taxType: Exclude<TaxType, 'all'>
  sum: number
  label: string
}

/** Три платежа из расчёта; нулевые (DPP под лимитом, без daně) не пишутся. */
export const taxEntriesFor = (res: Pick<EmployeeTaxResult, 'healthTotal' | 'socialTotal' | 'tax'>): TaxEntry[] =>
  (
    [
      { taxType: 'health', sum: Math.round(res.healthTotal), label: 'zdravotní' },
      { taxType: 'social', sum: Math.round(res.socialTotal), label: 'sociální' },
      { taxType: 'income', sum: Math.round(res.tax), label: 'daň (FÚ)' },
    ] as TaxEntry[]
  ).filter((e) => e.sum > 0)

/** 'YYYY-MM' → '10/2026' (комментарий записи, как в журнале сервера). */
const ymSlash = (ym: string) => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`

/** Пишет записи по одной (сервер принимает по одной); при сбое возвращает уже записанные и ошибку. */
export const writeTaxCorrections = async (input: {
  personal: string
  period: string
  date: string
  entries: TaxEntry[]
}): Promise<{ rows: CorrectionRow[]; error: Error | null }> => {
  const rows: CorrectionRow[] = []
  for (const e of input.entries) {
    try {
      rows.push(
        await createCorrection({
          kind: 'tax',
          personal: input.personal,
          date: input.date,
          period: input.period,
          sum: e.sum,
          text: `Daně za ${ymSlash(input.period)} — ${e.label} (kalkulačka)`,
          taxType: e.taxType,
        }),
      )
    } catch (err) {
      return { rows, error: err as Error }
    }
  }
  return { rows, error: null }
}

/** Уже записанные налоги месяца по сотруднику (documentId → строки), чтобы не задвоить. */
export const fetchWrittenTaxes = async (month: number, year: number): Promise<Map<string, CorrectionRow[]>> => {
  const rows = await fetchCorrections(month, year)
  const map = new Map<string, CorrectionRow[]>()
  for (const r of rows) {
    if (r.kind !== 'tax' || !r.personal || r.draft) continue
    const list = map.get(r.personal.documentId) ?? []
    list.push(r)
    map.set(r.personal.documentId, list)
  }
  return map
}

export const periodOfTab = (month: number, year: number) => monthKey(month, year)
