import { useState, useEffect, useCallback } from 'react'
import {
  btnPinkCls,
  cardCls,
  h1Cls,
  hintCls,
  kickerCls,
  mutedCls,
  pageShellCls,
  tileCls,
  tileLabelCls,
  tileSubCls,
  tileValueCls,
  toolbarCardCls,
} from '../../ui/kit'
import { Cell } from '../dashboard/components/Cell'
import { OwnerProtection } from './components/OwnerProtection'
import { StatSection } from './components/StatSection'
import { TableWrapper } from './components/TableWrapper'
import type { GoogleReview } from './fetch/reviewSync'
import { fetchGoogleReviews, syncReviews, deleteReview } from './fetch/reviewSync'
import type { ReviewRequestLog } from './fetch/reviewRequests'
import { fetchReviewRequestLogs, statsFromLogs } from './fetch/reviewRequests'

// Дата+время отправки письма как «23.08 14:05»
const fmtSent = (iso: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString(
    'ru-RU',
    { hour: '2-digit', minute: '2-digit' },
  )}`
}

const fmtDay = (ymd: string): string =>
  ymd ? new Date(`${ymd}T12:00:00Z`).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : '—'

// Секция журнала автописем «оставьте отзыв». Данные пишет крон Strapi
// (api::review-request), админка их только показывает — кнопок отправки тут нет
// намеренно: ручная рассылка легко даёт всплеск отзывов, а это флаг для Google.
function ReviewRequestsSection({ logs, failed }: { logs: ReviewRequestLog[]; failed: boolean }) {
  const stats = statsFromLogs(logs)

  return (
    <StatSection title={'Žádosti o recenzi (automatické e-maily)'} id={'review-requests'} count={stats.total}>
      {failed ? (
        <p className={hintCls}>
          Журнал недоступен. Обычно это значит, что модуль ещё не задеплоен на Strapi
          или у API-токена нет прав на коллекцию «Review request logs».
        </p>
      ) : logs.length === 0 ? (
        <p className={hintCls}>
          Писем пока не отправлено. Рассылка включается переменной REVIEW_REQUEST_ENABLED=true
          в .env Strapi — до этого крон молчит. Письмо уходит вечером после визита клиенткам
          с 2+ посещениями, не чаще раза в год на человека.
        </p>
      ) : (
        <>
          <div className={'grid gap-2.5 mb-4 grid-cols-2 md:grid-cols-4'}>
            <div className={tileCls}>
              <div className={tileLabelCls}>Всего</div>
              <div className={tileValueCls}>{stats.total}</div>
              <div className={tileSubCls}>писем отправлено</div>
            </div>
            <div className={tileCls}>
              <div className={tileLabelCls}>За 30 дней</div>
              <div className={tileValueCls}>{stats.last30}</div>
              <div className={tileSubCls}>≈ {(stats.last30 / 30).toFixed(1)} в день</div>
            </div>
            <div className={tileCls}>
              <div className={tileLabelCls}>За 7 дней</div>
              <div className={tileValueCls}>{stats.last7}</div>
              <div className={tileSubCls}>последняя неделя</div>
            </div>
            <div className={tileCls}>
              <div className={tileLabelCls}>Визитов у адресатов</div>
              <div className={tileValueCls}>
                {stats.avgVisits == null ? '—' : stats.avgVisits.toFixed(1)}
              </div>
              <div className={tileSubCls}>в среднем на клиента</div>
            </div>
          </div>

          <TableWrapper
            additionalInfo={
              'Сколько из этих писем превратилось в отзывы, Google не сообщает — связь «отзыв → клиент» он не отдаёт. Ориентир — рост числа отзывов на профиле.'
            }
          >
            <table className={'w-full border-collapse min-w-[560px]'}>
              <thead>
                <tr>
                  <Cell asHeader title={'Отправлено'} />
                  <Cell asHeader title={'Клиент'} />
                  <Cell asHeader title={'Визит'} />
                  <Cell asHeader title={'Визитов'} className={'w-px'} />
                  <Cell asHeader title={'Услуга'} />
                  <Cell asHeader title={'Мастер'} />
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.documentId}>
                    <Cell title={fmtSent(l.sentAt)} className={'whitespace-nowrap'} />
                    <Cell title={l.clientName || l.email || '—'} />
                    <Cell title={fmtDay(l.visitDate)} className={'whitespace-nowrap'} />
                    <Cell title={String(l.visitCount ?? '—')} className={'text-right'} />
                    <Cell title={l.serviceTitle || '—'} className={'break-words'} />
                    <Cell title={l.employeeName || '—'} />
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
        </>
      )}
    </StatSection>
  )
}

export default function ReviewSyncPage() {
  const [reviews, setReviews] = useState<GoogleReview[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  // журнал автописем «оставьте отзыв» (s175) — пишет крон Strapi, тут только чтение
  const [requests, setRequests] = useState<ReviewRequestLog[]>([])
  const [requestsErr, setRequestsErr] = useState(false)

  const loadReviews = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchGoogleReviews()
      setReviews(data)
    } catch {
      setReviews([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRequests = useCallback(async () => {
    try {
      setRequests(await fetchReviewRequestLogs())
      setRequestsErr(false)
    } catch {
      // модуль ещё не задеплоен / нет прав на коллекцию — секция скажет об этом
      setRequests([])
      setRequestsErr(true)
    }
  }, [])

  useEffect(() => {
    loadReviews()
    loadRequests()
  }, [loadReviews, loadRequests])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await syncReviews()
      setSyncResult(`Synced: ${result.created} new, ${result.skipped} already exist, ${result.filtered || 0} filtered (${result.total} from Google)`)
      await loadReviews()
    } catch (err: unknown) {
      setSyncResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async (documentId: string) => {
    if (!window.confirm('Delete this review?')) return
    try {
      await deleteReview(documentId)
      setReviews((prev) => prev.filter((r) => r.documentId !== documentId))
    } catch (err: unknown) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <OwnerProtection>
      <div className={pageShellCls}>
        <div className={kickerCls}>Barbitch Admin</div>
        <h1 className={h1Cls}>Google Reviews</h1>

        <div className={toolbarCardCls}>
          <button onClick={handleSync} disabled={syncing} className={btnPinkCls}>
            {syncing ? 'Syncing...' : 'Sync from Google'}
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={mutedCls}>{reviews.length} reviews total</span>
            <span className={`${hintCls} max-w-[380px]`}>
              Synchronize reviews from Google Places API. Reviews are stored in Strapi and
              shown on the website.
            </span>
          </div>
        </div>

        {syncResult && (
          <div
            className={`mb-3.5 rounded-lg px-4 py-2.5 text-[13px] font-semibold ${
              syncResult.startsWith('Error')
                ? 'bg-neg-bg text-neg'
                : 'bg-pos-bg text-pos'
            }`}
          >
            {syncResult}
          </div>
        )}

        <ReviewRequestsSection logs={requests} failed={requestsErr} />

        {loading ? (
          <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">
            Loading...
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-12 text-center text-[13px] font-semibold text-ink-faint">
            No reviews yet. Click "Sync from Google" to fetch them.
          </div>
        ) : (
          <div className="grid gap-2.5">
            {reviews.map((review) => (
              <div key={review.documentId} className={`${cardCls} px-5 py-4 flex gap-4`}>
                {review.reviewerPhoto && (
                  <img
                    src={review.reviewerPhoto}
                    alt={review.reviewerName}
                    className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[14px] font-bold text-ink">
                      {review.reviewerName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-star">
                        {'★'.repeat(review.rating)}
                        {'☆'.repeat(5 - review.rating)}
                      </span>
                      <button
                        onClick={() => handleDelete(review.documentId)}
                        className="w-7 h-7 rounded-[7px] text-ink-icon text-[12px] transition-colors hover:bg-brand-wash hover:text-brand-alert"
                        title="Delete review"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {review.reviewDate && (
                    <p className={`m-0 mb-1 ${mutedCls}`}>{review.reviewDate}</p>
                  )}
                  <p className="m-0 text-[13px] leading-[1.55] font-medium text-ink-body line-clamp-2">
                    {review.comment}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </OwnerProtection>
  )
}
