// Кнопка «Upozornění» (Web Push) в тулбаре календаря. Мастер (и админ) включает
// пуш-уведомления о бронях к нему. iOS: работает ТОЛЬКО в установленном PWA
// (Přidat na plochu) — если открыто в обычном Safari, показываем подсказку.
import { useEffect, useState } from 'react'

import { disablePush, enablePush, getPushState, isPushSupported, type PushState } from '../../lib/push'
import { IconBell, IconBellOff } from './icons'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export function NotificationButton({
  className,
  popup = 'down',
  menuItem = false,
}: {
  className?: string
  popup?: 'down' | 'up'
  // пункт меню «⋯» (мобила): подпись видна всегда, не только на md+
  menuItem?: boolean
}) {
  const [state, setState] = useState<PushState>('default')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')

  useEffect(() => {
    getPushState().then(setState)
  }, [])

  if (!isPushSupported()) return null
  // iOS вне установленного PWA push невозможен — подсказываем установить
  const iosNotInstalled = isIos() && !isStandalone()

  const onClick = async () => {
    if (iosNotInstalled) {
      setHint((h) => (h ? '' : 'ios'))
      return
    }
    setBusy(true)
    setHint('')
    try {
      if (state === 'subscribed') {
        await disablePush()
        setState('unsubscribed')
      } else {
        const r = await enablePush()
        if (r.ok) setState('subscribed')
        else setHint(r.error || 'Chyba')
      }
    } finally {
      setBusy(false)
    }
  }

  const label = state === 'subscribed' ? 'Upozornění zap.' : 'Upozornění'
  const bell = state === 'subscribed' ? <IconBell /> : <IconBellOff />

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-label="Zapnout upozornění"
        title={label}
        className={className}
      >
        {bell}
        {/* десктоп/мобила: только иконка; в пункте меню «⋯» — с подписью */}
        {menuItem && <span className="ml-1.5">{label}</span>}
      </button>
      {hint && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => setHint('')}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            className={`absolute z-50 w-64 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg ${
              popup === 'up' ? 'bottom-full right-0 mb-1' : 'left-0 mt-1'
            }`}
          >
            {hint === 'ios' ? (
              <>
                <p className="text-sm font-semibold text-gray-800">Nejdřív nainstalovat</p>
                <p className="mt-1 text-xss leading-snug text-gray-600">
                  Na iPhonu fungují upozornění jen v nainstalované aplikaci. Přidejte stránku přes
                  <b> Sdílet → „Přidat na plochu“</b>, otevřete ji z plochy a pak zapněte upozornění.
                </p>
              </>
            ) : (
              <p className="text-sm leading-snug text-red-600">{hint}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
