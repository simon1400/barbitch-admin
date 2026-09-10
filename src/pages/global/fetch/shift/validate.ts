/* eslint-disable @typescript-eslint/no-explicit-any */
// Пред-полётная проверка черновиков перед публикацией смены: обязательные поля
// каждой коллекции, человекочитаемая подпись записи и разбор ошибки Strapi.
// Вынесено из fetch/shiftClose.ts ДОСЛОВНО (этап 6 аудита).
//
// ⚠️ PublishFailure реэкспортируется из fetch/shiftClose.ts — его импортируют
// оттуда PublishSection и ShiftClosePage.
import { hasVisibleText } from '../../../../lib/htmlText'

export interface PublishFailure {
  collection: string  // human-readable section name
  label: string       // identifier of the record (client name, master+time, etc.)
  message: string     // Strapi validation message
  documentId?: string
}

// Parse Strapi error response into a readable message.
export const extractErrorMessage = (e: any): string => {
  const details = e?.response?.data?.error?.details?.errors
  if (Array.isArray(details) && details.length > 0) {
    return details
      .map((d: any) => {
        const path = Array.isArray(d?.path) ? d.path.join('.') : d?.path
        return path ? `${path}: ${d?.message ?? 'invalid'}` : (d?.message ?? 'invalid')
      })
      .join('; ')
  }
  return (
    e?.response?.data?.error?.message ||
    e?.message ||
    'Neznámá chyba'
  )
}

// Build a human label for each collection so the user can find the offending record.
export const buildLabel = (collectionKey: string, item: any): string => {
  switch (collectionKey) {
    case 'services-provided':
      return [item?.clientName, item?.personal?.name].filter(Boolean).join(' — ') || `ID ${item?.id ?? '?'}`
    case 'cashs': {
      const sum = item?.sum ?? item?.amount
      return sum != null ? `Cash ${sum} Kč` : `Cash ID ${item?.id ?? '?'}`
    }
    case 'work-times': {
      const name = item?.personal?.name
      return [name, item?.startTime].filter(Boolean).join(' ') || `Work-time ID ${item?.id ?? '?'}`
    }
    case 'payrolls': {
      const name = item?.personal?.name
      const sum = item?.sum ?? item?.amount
      return [name, sum != null ? `${sum} Kč` : null].filter(Boolean).join(' — ') || `Payroll ID ${item?.id ?? '?'}`
    }
    case 'card-profits':
      return `Card profit ${item?.date ?? ''}`.trim()
    case 'vouchers': {
      const idv = item?.idVoucher
      return [item?.name, idv ? `#${idv}` : null].filter(Boolean).join(' ') || `Voucher ID ${item?.id ?? '?'}`
    }
    default:
      return `ID ${item?.id ?? '?'}`
  }
}

export const COLLECTION_LABEL: Record<string, string> = {
  'cashs': 'Cash',
  'services-provided': 'Provedené služby',
  'work-times': 'Work-time',
  'payrolls': 'Payroll',
  'card-profits': 'Card profit',
  'vouchers': 'Voucher',
}

// Required-field map (mirrors strapi schema.json `required: true`).
// Used for pre-flight validation so we never half-publish a shift.
type FieldType = 'string' | 'html' | 'relation' | 'array' | 'date' | 'number' | 'boolean'
const REQUIRED_FIELDS: Record<string, { name: string; type: FieldType; alt?: string }[]> = {
  'cashs': [
    { name: 'date', type: 'date' },
    { name: 'sum', type: 'string' },
    { name: 'profit', type: 'string' },
    { name: 'flow', type: 'array' },
  ],
  'work-times': [
    { name: 'date', type: 'date' },
    { name: 'startTime', type: 'string' },
    { name: 'endTime', type: 'string' },
    { name: 'sum', type: 'number' },
    { name: 'comment', type: 'html' },
  ],
  'payrolls': [
    { name: 'date', type: 'date' },
    { name: 'sum', type: 'number' },
  ],
  'services-provided': [
    { name: 'clientName', type: 'string' },
    { name: 'staffSalaries', type: 'string' },
    { name: 'salonSalaries', type: 'string' },
    { name: 'date', type: 'date' },
    { name: 'cash', type: 'boolean' },
    { name: 'personal', type: 'relation' },
    // услуга: legacy-записи несут `offer`, записи чекаута из календаря (D2) — `booking`;
    // достаточно любой из двух связей
    { name: 'offer', type: 'relation', alt: 'booking' },
  ],
}

// ⚠️ Денежный путь: по этому «пусто» блокируется закрытие смены. Разбор HTML
// общий (lib/htmlText) — комментарий из одного «&nbsp;» теперь считается
// пустым, каким он и выглядит. На боевых данных таких записей нет (проверено).
const isEmptyHtml = (s: unknown): boolean => !hasVisibleText(s)

// Returns array of human-readable issues; empty array = record valid.
export const validateDraft = (collectionKey: string, item: any): string[] => {
  const fields = REQUIRED_FIELDS[collectionKey]
  if (!fields) return []
  const issues: string[] = []
  for (const f of fields) {
    const v = item?.[f.name]
    let issue: string | null = null
    switch (f.type) {
      case 'string':
        if (v == null || (typeof v === 'string' && v.trim() === '')) issue = `${f.name}: prázdné`
        break
      case 'html':
        if (isEmptyHtml(v)) issue = `${f.name}: prázdné`
        break
      case 'relation': {
        const hasRel = (r: any) => !!r && typeof r === 'object' && (r.id != null || r.documentId != null)
        if (!hasRel(v) && !(f.alt && hasRel(item?.[f.alt]))) {
          issue = `${f.alt ? `${f.name}/${f.alt}` : f.name}: chybí vazba`
        }
        break
      }
      case 'array':
        if (!Array.isArray(v) || v.length === 0) issue = `${f.name}: prázdný seznam`
        break
      case 'date':
        if (!v) issue = `${f.name}: chybí`
        break
      case 'number':
        if (v == null || v === '') issue = `${f.name}: chybí`
        else if (typeof v === 'number' && !Number.isFinite(v)) issue = `${f.name}: neplatné`
        break
      case 'boolean':
        if (v == null) issue = `${f.name}: chybí`
        break
    }
    if (issue) issues.push(issue)
  }
  return issues
}

// Publish all draft records for a specific date + save/update card profit
