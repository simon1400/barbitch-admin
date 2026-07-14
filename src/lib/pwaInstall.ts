// Перехват beforeinstallprompt для PWA-установки (кнопка «Instalovat» в календаре).
// ⚠️ Событие прилетает ОДИН раз вскоре после загрузки страницы (обычно на /login) —
// раньше, чем юзер дойдёт до /calendar по SPA-навигации. Поэтому модуль импортируется
// из main.tsx (основной бандл), а НЕ из lazy-чанка календаря — иначе событие упущено.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  listeners.forEach((fn) => fn())
})
window.addEventListener('appinstalled', () => {
  deferred = null
  listeners.forEach((fn) => fn())
})

export const hasInstallPrompt = () => deferred !== null

// prompt() одноразовый; при отказе Chrome позже пришлёт новое beforeinstallprompt
export const promptInstall = () => {
  const p = deferred
  deferred = null
  listeners.forEach((fn) => fn())
  p?.prompt().catch(() => {})
}

export const subscribeInstallPrompt = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
