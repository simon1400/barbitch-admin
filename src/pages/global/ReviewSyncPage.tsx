import { useState, useEffect, useCallback } from 'react'
import {
  btnPinkCls,
  cardCls,
  h1Cls,
  hintCls,
  kickerCls,
  mutedCls,
  pageShellCls,
  toolbarCardCls,
} from '../../ui/kit'
import { OwnerProtection } from './components/OwnerProtection'
import type { GoogleReview } from './fetch/reviewSync'
import { fetchGoogleReviews, syncReviews, deleteReview } from './fetch/reviewSync'

export default function ReviewSyncPage() {
  const [reviews, setReviews] = useState<GoogleReview[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

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

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

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
