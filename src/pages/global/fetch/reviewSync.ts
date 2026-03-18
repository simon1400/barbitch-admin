import { Axios } from '../../../lib/api'

const strapiUrl = import.meta.env.VITE_API_URL || 'http://localhost:1337'

export interface GoogleReview {
  id: number
  documentId: string
  reviewerName: string
  reviewerPhoto: string
  rating: number
  comment: string
  googleReviewId: string
  reviewDate: string
  createdAt: string
}

export async function fetchGoogleReviews(): Promise<GoogleReview[]> {
  const res: GoogleReview[] = await Axios.get('/api/google-reviews?sort=createdAt:desc&pagination[pageSize]=100')
  return res
}

export async function syncReviews(): Promise<{ created: number; skipped: number; filtered: number; total: number }> {
  const res = await fetch(`${strapiUrl}/api/review-sync/sync`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Sync failed')
  return data
}

export async function deleteReview(documentId: string): Promise<void> {
  await Axios.delete(`/api/google-reviews/${documentId}`)
}
