// Категории услуг и классификация по названию. Перенесено из windowCrossSell.ts
// (этап 6) дословно.

export type Bucket = 'manicure' | 'brows' | 'lashes'
export const ALL_BUCKETS: Bucket[] = ['manicure', 'brows', 'lashes']

export const BUCKET_LABEL: Record<Bucket, string> = {
  manicure: 'Маникюр',
  brows: 'Брови',
  lashes: 'Ресницы',
}
// Для текста письма (чешский, в нижнем регистре — встраивается в предложение)
export const BUCKET_LABEL_CS: Record<Bucket, string> = {
  manicure: 'manikúra',
  brows: 'obočí',
  lashes: 'řasy',
}

// Классификация по названию услуги/категории каталога. Покрывает и снапшоты услуг
// в бронях (services[].title). Порядок важен: «řas» (ресницы) проверяем до «obočí»,
// маникюр — последним. ⚠️ При новых категориях каталога — дополнить ключевые слова.
export const classifyTitle = (raw: string): Bucket | null => {
  const t = raw.toLowerCase()
  if (t.includes('řas') || t.includes('rias') || t.includes('lash')) return 'lashes'
  // Брови: многие услуги БЕЗ слова «obočí» (Laminace, Úprava tvaru, Korekce…).
  // «laminace»/«úprava tvaru» здесь безопасны — ресничные ловятся выше по «řas».
  if (
    t.includes('obočí') ||
    t.includes('oboci') ||
    t.includes('brow') ||
    t.includes('barvení a péče') ||
    t.includes('laminace') ||
    t.includes('úprava tvaru') ||
    t.includes('uprava tvaru')
  )
    return 'brows'
  const nailKeys = [
    'nehty',
    'manikúra',
    'manikura',
    'gel lak',
    'prodloužení neht',
    'nano',
    'sundání',
    'hygienick',
    'ibx',
  ]
  if (nailKeys.some((k) => t.includes(k))) return 'manicure'
  return null
}

// НЕ предлагаем для дозаписи не-базовые услуги: снятия/удаления (Sundání,
// Odstranění) и доливы/коррекции (Doplnění, Korekce — делаются поверх существующей
// работы, не подходят как самостоятельное предложение). Фильтр применяется только
// к ПРЕДЛАГАЕМЫМ услугам, не к классификации текущей брони клиента.
export const NON_BASE_KEYWORDS = [
  'sundání',
  'sundani',
  'odstranění',
  'odstraneni',
  'doplnění',
  'doplneni',
  'korekce',
]
export const isExcludedOfferService = (title: string): boolean => {
  const t = title.toLowerCase()
  return NON_BASE_KEYWORDS.some((k) => t.includes(k))
}
