import axios from 'axios'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:1350'
const strapiToken = import.meta.env.VITE_STRAPI_TOKEN as string | undefined

const StrapiAdmin = axios.create({ baseURL: apiUrl })
StrapiAdmin.interceptors.request.use(
  (config) => {
    if (strapiToken) config.headers.Authorization = `Bearer ${strapiToken}`
    return config
  },
  (e) => Promise.reject(e),
)

export interface OfferingInput {
  title: string
  price: number
}

export interface SaveOfferingsResult {
  created: number
  skipped: number
  errors: number
}

export const saveOfferings = async (offerings: OfferingInput[]): Promise<SaveOfferingsResult> => {
  let created = 0
  let skipped = 0
  let errors = 0

  for (const offering of offerings) {
    try {
      await StrapiAdmin.post('/api/offerings', {
        data: {
          title: offering.title,
          price: offering.price,
          publishedAt: new Date().toISOString(),
        },
      })
      created++
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } }
      // 400 = likely unique constraint (title already exists) — skip silently
      if (e?.response?.status === 400) {
        skipped++
      } else {
        errors++
      }
    }
  }

  return { created, skipped, errors }
}
