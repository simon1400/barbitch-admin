// Firemní poptávky voucherů (s274): ručky /api/engine/admin/firm-inquiries (jen vedení).
// Zápis přichází z webu /firemni-vouchery; tady seznam, stav, interní poznámka a logo.
import { ApiError, makeApiFetch } from '../../lib/apiFetch'
import { API_URL } from '../../lib/config'
import { getToken } from '../../services/auth'

export type InquiryStatus = 'new' | 'contacted' | 'offer' | 'won' | 'lost'

export const STATUS_LABEL: Record<InquiryStatus, string> = {
  new: 'Nová',
  contacted: 'Kontaktováno',
  offer: 'Nabídka odeslána',
  won: 'Objednáno',
  lost: 'Zrušeno',
}
export const STATUS_ORDER = Object.keys(STATUS_LABEL) as InquiryStatus[]
export const OPEN_STATUSES: InquiryStatus[] = ['new', 'contacted', 'offer']

export interface FirmInquiry {
  id: string
  createdAt: string
  updatedAt: string
  company: string
  ico: string
  count: number
  value: string
  person: string
  phone: string
  email: string
  note: string
  status: InquiryStatus
  adminNote: string
  updatedByName: string
  logo: { name: string; mime: string; size: number } | null
}

const CODE_MESSAGES: Record<string, string> = {
  owner_only: 'Poptávky vidí jen vedení salonu',
  not_found: 'Poptávka nenalezena',
  nothing_to_update: 'Není co uložit',
  no_logo: 'Poptávka nemá logo',
  logo_only_in_email: 'Logo je jen v e-mailu salonu (na serveru není nastaveno úložiště)',
}

const api = makeApiFetch('/api/engine/admin', CODE_MESSAGES, (s) => `Chyba ${s}`)
const enc = encodeURIComponent

export const fetchFirmInquiries = async (): Promise<FirmInquiry[]> =>
  (await api<{ items: FirmInquiry[] }>('GET', '/firm-inquiries')).items

export const updateFirmInquiry = async (
  id: string,
  patch: { status?: InquiryStatus; adminNote?: string },
): Promise<FirmInquiry> =>
  (await api<{ item: FirmInquiry }>('PUT', `/firm-inquiries/${enc(id)}`, patch)).item

/** Logo — jen fetch s Bearer (odkaz hlavičku nemá). objectURL uvolnit přes revokeObjectURL. */
export const downloadInquiryLogo = async (id: string): Promise<string> => {
  const res = await fetch(`${API_URL}/api/engine/admin/firm-inquiries/${enc(id)}/logo`, {
    headers: { Authorization: `Bearer ${getToken() || ''}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const json = await res.json().catch(() => null)
    const code = json?.error?.code || 'internal'
    throw new ApiError(res.status, code, CODE_MESSAGES[code] || json?.error?.message || `Chyba ${res.status}`)
  }
  return URL.createObjectURL(await res.blob())
}
