import { useState, useEffect, useCallback } from 'react'
import { Container } from '../../components/Container'
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
      <section className="pb-20 min-h-screen">
        <Container size="lg">
          <div className="mt-8 mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Google Reviews</h1>
            <p className="text-sm text-gray-500 mt-1">
              Synchronize reviews from Google Places API. Reviews are stored in Strapi and shown on the website.
            </p>
          </div>

          <div className="mb-6 flex items-center gap-4">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Sync from Google'}
            </button>
            <span className="text-sm text-gray-500">{reviews.length} reviews total</span>
          </div>

          {syncResult && (
            <div
              className={`mb-6 p-4 rounded-lg text-sm ${
                syncResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
              }`}
            >
              {syncResult}
            </div>
          )}

          {loading ? (
            <div className="text-gray-500">Loading...</div>
          ) : reviews.length === 0 ? (
            <div className="text-gray-500">No reviews yet. Click "Sync from Google" to fetch them.</div>
          ) : (
            <div className="grid gap-4">
              {reviews.map((review) => (
                <div key={review.documentId} className="bg-white rounded-lg p-5 shadow-sm border flex gap-4">
                  {review.reviewerPhoto && (
                    <img
                      src={review.reviewerPhoto}
                      alt={review.reviewerName}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-gray-800">{review.reviewerName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-yellow-500">
                          {'★'.repeat(review.rating)}
                          {'☆'.repeat(5 - review.rating)}
                        </span>
                        <button
                          onClick={() => handleDelete(review.documentId)}
                          className="text-xs text-red-400 hover:text-red-600 ml-2"
                          title="Delete review"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {review.reviewDate && (
                      <p className="text-xs text-gray-400 mb-1">{review.reviewDate}</p>
                    )}
                    <p className="text-sm text-gray-600 line-clamp-2">{review.comment}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Container>
      </section>
    </OwnerProtection>
  )
}
