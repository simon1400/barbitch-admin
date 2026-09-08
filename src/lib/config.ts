// Единственный источник адреса Strapi для админки.
//
// Раньше строка `import.meta.env.VITE_API_URL || 'http://localhost:…'` была
// скопирована в 13 файлов, причём двенадцать из них подставляли порт 1337
// (сток Strapi), а наш backend слушает 1350 — и в `strapi/config/server.ts`,
// и в `strapi/.env`. На проде расхождение не проявлялось (VITE_API_URL задан
// в admin/.env), но разработчик без своего .env.local молча стучался в
// несуществующий порт. Дефолт здесь один и совпадает с реальным портом.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1350'
