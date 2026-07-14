// Кнопка «Instalovat» (PWA) в тулбаре календаря. Манифест (start_url=/calendar)
// открывает установленное приложение сразу на календаре. Кнопка видна только когда
// установка реально доступна: Android/Chrome — нативный prompt (beforeinstallprompt,
// перехвачен в lib/pwaInstall при загрузке бандла), iOS Safari — события не существует,
// показываем подсказку «Sdílet → Přidat na plochu». Внутри установленного приложения
// (standalone) кнопка не рендерится.
import { useEffect, useState } from 'react'
import { hasInstallPrompt, promptInstall, subscribeInstallPrompt } from '../../lib/pwaInstall'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true

// iPadOS 13+ маскируется под Mac — отличаем по maxTouchPoints
const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export function InstallAppButton({ className }: { className?: string }) {
  const [, force] = useState(0)
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => subscribeInstallPrompt(() => force((v) => v + 1)), [])

  if (isStandalone()) return null
  const ios = isIos()
  if (!hasInstallPrompt() && !ios) return null

  const onClick = () => {
    if (hasInstallPrompt()) promptInstall()
    else setShowIosHint((v) => !v)
  }

  return (
    <div className="relative">
      <button type="button" onClick={onClick} aria-label="Nainstalovat aplikaci" className={className}>
        ⤓<span className="ml-1 hidden md:inline">Instalovat</span>
      </button>
      {showIosHint && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => setShowIosHint(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute left-0 z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg">
            <p className="text-sm font-semibold text-gray-800">Přidat na plochu</p>
            <p className="mt-1 text-xss leading-snug text-gray-600">
              Otevřete tuto stránku v Safari, klepněte na tlačítko <b>Sdílet</b> (čtvereček se
              šipkou) a zvolte <b>„Přidat na plochu“</b>. Aplikace se pak otevře rovnou na
              kalendáři.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
