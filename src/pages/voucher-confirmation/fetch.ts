// Platby dárkových voucherů kartou (s275): ručky /api/engine/admin/voucher-payments.
// Seznam vidí vedení, vrátit peníze (Comgate refund) může jen majitel.
import { makeApiFetch } from '../../lib/apiFetch'

export type CardPaymentStatus = 'pending' | 'paid' | 'cancelled' | 'refunded'

export const CARD_STATUS_LABEL: Record<CardPaymentStatus, string> = {
  pending: 'Čeká na platbu',
  paid: 'Zaplaceno',
  cancelled: 'Nezaplaceno',
  refunded: 'Vráceno',
}

export interface CardPayment {
  id: string
  idVoucher: string
  catalogId: string
  serviceName: string | null
  price: number
  email: string
  buyerName: string
  forName: string
  status: CardPaymentStatus
  method: string | null
  test: boolean
  createdAt: string
  paidAt: string | null
  cancelledAt: string | null
  refundedAt: string | null
  refundedBy: string | null
  mailSentAt: string | null
  mailError: string | null
  failReason: string | null
  voucherUsed: boolean
  canRefund: boolean
}

const CODE_MESSAGES: Record<string, string> = {
  owner_only: 'Peníze může vrátit jen majitel',
  not_found: 'Platba nenalezena',
  payments_not_configured: 'Platby kartou nejsou na serveru nastavené (Comgate)',
  already_refunded: 'Peníze už byly vráceny',
  not_paid: 'Platba není zaplacená — není co vracet',
  voucher_used: 'Voucher už byl využit při návštěvě — peníze vrátit nejde',
}

const api = makeApiFetch('/api/engine/admin', CODE_MESSAGES, (s) => `Chyba ${s}`)

export const fetchCardPayments = async (
  days = 90,
): Promise<{ items: CardPayment[]; configured: boolean }> =>
  api('GET', `/voucher-payments?days=${days}`)

export const refundCardPayment = async (id: string): Promise<void> => {
  await api('POST', `/voucher-payments/${encodeURIComponent(id)}/refund`)
}
