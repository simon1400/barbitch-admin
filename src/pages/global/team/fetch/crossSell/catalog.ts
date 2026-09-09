// Каталог услуг, доступных для дозаписи. Перенесено из windowCrossSell.ts
// (этап 6) дословно.
import { fetchAllPagesStrapi } from '../../../../../lib/strapiRest'
import { type Bucket, classifyTitle, isExcludedOfferService } from './buckets'

// ─── Каталог: услуги + назначенные мастера (salon-service) ────────────────────
export interface CatalogSvc {
  docId: string
  title: string
  bucket: Bucket
  durationMin: number
  masterIds: Set<string> // noonaEmployeeId назначенных мастеров (personal.services)
}

export interface RawSalonService {
  documentId: string
  title?: string
  category?: string
  durationMin?: number
  active?: boolean
  onlineBookable?: boolean
  personals?: Array<{ documentId?: string; noonaEmployeeId?: string | null }>
}

// Активные онлайн-услуги каталога с назначенными мастерами. Категория каталога →
// bucket (фолбэк — по названию услуги). populate personals может отдать дубли
// (draft+published строки personal) — masterIds это Set, дубль безвреден.
export const fetchOfferableServices = async (): Promise<CatalogSvc[]> => {
  const raw = await fetchAllPagesStrapi<RawSalonService>(
    '/api/salon-services?fields[0]=title&fields[1]=category&fields[2]=durationMin' +
      '&fields[3]=active&fields[4]=onlineBookable&populate[personals][fields][0]=noonaEmployeeId',
    200,
  )
  const out: CatalogSvc[] = []
  for (const s of raw) {
    if (s.active === false || s.onlineBookable === false) continue
    const title = s.title ?? ''
    const durationMin = Number(s.durationMin ?? 0)
    if (!title || durationMin <= 0 || isExcludedOfferService(title)) continue
    const bucket = classifyTitle(s.category ?? '') ?? classifyTitle(title)
    if (!bucket) continue
    const masterIds = new Set<string>()
    for (const p of s.personals ?? []) {
      if (p?.noonaEmployeeId) masterIds.add(p.noonaEmployeeId)
    }
    out.push({ docId: s.documentId, title, bucket, durationMin, masterIds })
  }
  return out
}
