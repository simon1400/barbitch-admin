// Web Push подписка (PWA мастеров): регистрирует service worker sw.js, спрашивает
// разрешение, подписывается через VAPID и шлёт подписку в движок (/engine/push/*).
// Всё gated: если браузер не поддерживает или VAPID-ключа нет — тихо ничего не делает.

import { getToken } from '../services/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1350'

export type PushState =
  | 'unsupported' // нет serviceWorker/PushManager/Notification
  | 'denied' // пользователь запретил уведомления
  | 'default' // ещё не спрашивали
  | 'subscribed' // подписан
  | 'unsubscribed' // поддерживается, разрешено, но подписки нет

export const isPushSupported = (): boolean =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const urlBase64ToUint8Array = (base64: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const buf = new ArrayBuffer(raw.length)
  const arr = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

const registerSw = async (): Promise<ServiceWorkerRegistration> => {
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  return reg
}

export const getPushState = async (): Promise<PushState> => {
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'default') return 'default'
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = reg ? await reg.pushManager.getSubscription() : null
    return sub ? 'subscribed' : 'unsubscribed'
  } catch {
    return 'unsubscribed'
  }
}

const fetchVapidKey = async (): Promise<string | null> => {
  try {
    const res = await fetch(`${API_URL}/api/engine/push/vapid`)
    const json = await res.json().catch(() => null)
    return json?.publicKey || null
  } catch {
    return null
  }
}

// Полный флоу включения: разрешение → SW → VAPID → subscribe → отправка в движок
export const enablePush = async (): Promise<{ ok: boolean; error?: string }> => {
  if (!isPushSupported()) return { ok: false, error: 'Prohlížeč nepodporuje upozornění.' }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, error: 'Upozornění nebyla povolena.' }

  const vapid = await fetchVapidKey()
  if (!vapid) return { ok: false, error: 'Upozornění nejsou na serveru nastavena.' }

  try {
    const reg = await registerSw()
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      })
    }
    const res = await fetch(`${API_URL}/api/engine/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` },
      body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
    })
    if (!res.ok) return { ok: false, error: 'Přihlášení k odběru se nezdařilo.' }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'Chyba při zapínání upozornění.' }
  }
}

export const disablePush = async (): Promise<void> => {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = reg ? await reg.pushManager.getSubscription() : null
    if (sub) {
      await fetch(`${API_URL}/api/engine/push/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {})
      await sub.unsubscribe().catch(() => {})
    }
  } catch {
    /* ignore */
  }
}
