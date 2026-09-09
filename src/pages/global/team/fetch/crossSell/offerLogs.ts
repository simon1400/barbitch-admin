// Журнал отправленных предложений (дедуп). Перенесено из windowCrossSell.ts
// (этап 6) дословно.
import { strapiQuery } from '../../../../../lib/strapiQuery'
import { fetchAllPagesAxios } from '../../../../../lib/strapiPaginate'

// ─── Лог предложений (дедуп) ────────────────────────────────────────────────
export interface WindowOfferLog {
  documentId: string
  bookingEventId: string
  offeredCategory: string
  customerId: string
  customerName: string
  email: string
  masterId: string
  masterName: string
  serviceTitle: string
  anchorDate: string
  windowTime: string
  discount: string
  sentAt: string
}

export const fetchOfferLogs = async (): Promise<WindowOfferLog[]> => {
  const buildQuery = (page: number) =>
    strapiQuery(
      {
        fields: [
          'bookingEventId',
          'offeredCategory',
          'customerId',
          'customerName',
          'email',
          'masterId',
          'masterName',
          'serviceTitle',
          'anchorDate',
          'windowTime',
          'discount',
          'sentAt',
        ],
        sort: ['sentAt:desc'],
        pagination: { page, pageSize: 200 },
      },
    )

  // 🟥 Сбой страницы НЕ должен молча прерывать сбор: журнал вернулся бы
  // НЕПОЛНЫМ, и клиент, которому предложение уже уходило, снова попал бы в
  // подборку — то есть получил бы второе письмо. Отказываем явно.
  const data = await fetchAllPagesAxios<Record<string, unknown>>(
    '/api/window-offer-logs',
    buildQuery,
    {
      pageSize: 200,
      onPageError: (e, page) => {
        console.error('fetchOfferLogs: страница', page, 'не загрузилась', e)
        throw new Error(
          'Nepodařilo se načíst historii nabídek — seznam by byl neúplný a někdo by dostal nabídku dvakrát.',
        )
      },
    },
  )

  const logs: WindowOfferLog[] = []
  for (const l of data) {
    logs.push({
      documentId: String(l.documentId ?? ''),
      bookingEventId: String(l.bookingEventId ?? ''),
      offeredCategory: String(l.offeredCategory ?? ''),
      customerId: String(l.customerId ?? ''),
      customerName: String(l.customerName ?? ''),
      email: String(l.email ?? ''),
      masterId: String(l.masterId ?? ''),
      masterName: String(l.masterName ?? ''),
      serviceTitle: String(l.serviceTitle ?? ''),
      anchorDate: String(l.anchorDate ?? ''),
      windowTime: String(l.windowTime ?? ''),
      discount: String(l.discount ?? ''),
      sentAt: String(l.sentAt ?? ''),
    })
  }
  return logs
}
