import { useEffect } from 'react'

// Всплывающее подтверждение действия (s285): «Добавлено …», «Удалено …». Внизу
// экрана, само исчезает; `role="status"` — читалки объявляют текст без прерывания.
// Родитель передаёт `{ id, text, tone }`, а не строку: новое сообщение с тем же
// текстом (две выплаты подряд) тоже должно перезапустить таймер.
export interface ToastMessage {
  id: number
  text: string
  tone?: 'ok' | 'info'
}

const TONE_CLS: Record<NonNullable<ToastMessage['tone']>, string> = {
  ok: 'bg-ink text-white',
  info: 'bg-warn-bg text-warn',
}

export function Toast({
  message,
  onClose,
  ttlMs = 5000,
}: {
  message: ToastMessage | null
  onClose: () => void
  ttlMs?: number
}) {
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(onClose, ttlMs)
    return () => window.clearTimeout(t)
  }, [message, onClose, ttlMs])

  if (!message) return null
  return (
    <div
      key={message.id}
      role="status"
      aria-live="polite"
      data-testid="toast"
      data-tone={message.tone ?? 'ok'}
      className={`fixed left-1/2 bottom-6 z-[70] -translate-x-1/2 w-max max-w-[calc(100vw-32px)] md:max-w-[640px] flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg text-[13.5px] font-semibold leading-[1.45] motion-safe:animate-fade-up ${TONE_CLS[message.tone ?? 'ok']}`}
    >
      <span className="flex-1">{message.text}</span>
      <button
        type="button"
        aria-label="Закрыть"
        className="shrink-0 opacity-70 hover:opacity-100 text-[16px] leading-none"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  )
}
