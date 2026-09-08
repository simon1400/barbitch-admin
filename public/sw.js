// Service worker ТОЛЬКО для Web Push (без кэширования — чтобы не ловить устаревшие
// чанки SPA после деплоя, как отмечено в s109). Показывает уведомление о брони и
// открывает календарь по клику.
/* eslint-disable no-restricted-globals */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'Bar.Bitch', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Bar.Bitch'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/calendar' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // target несёт query (?date=…&highlight=…) → уже открытое окно ФОКУСИРУЕМ И
  // НАВИГИРУЕМ на него (полная перезагрузка SPA — календарь прочитает параметры
  // на старте и подсветит бронь); закрытое — открываем сразу с параметрами
  // URL приходит из payload push-сообщения — открываем только СВОЙ origin,
  // иначе чужой push увёл бы мастера на постороннюю страницу (s181, п. 1.7).
  const raw = (event.notification.data && event.notification.data.url) || '/calendar'
  let target = '/calendar'
  try {
    const u = new URL(raw, self.location.origin)
    if (u.origin === self.location.origin) target = u.pathname + u.search + u.hash
  } catch (e) {
    target = '/calendar'
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const c = list.find((w) => 'focus' in w)
      if (c) {
        return c.focus().then((fc) => (fc && 'navigate' in fc ? fc.navigate(target) : undefined))
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
      return undefined
    }),
  )
})
