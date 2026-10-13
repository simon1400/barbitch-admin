// QR-код ссылки (s251, ярлыки склада): рисуется в браузере, внешних сервисов нет.
// Модули — один <path> в SVG (чёрное на белом: печатается на любом принтере и
// читается обычной камерой телефона). Уровень коррекции M — ярлык переживёт помятость.
import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

export function QrCode({ text, size, label }: { text: string; size: string | number; label?: string }) {
  const { n, d } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text, 'Byte')
    qr.make()
    const count = qr.getModuleCount()
    let path = ''
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`
    }
    return { n: count, d: path }
  }, [text])
  return (
    <svg
      viewBox={`-2 -2 ${n + 4} ${n + 4}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label || text}
      data-qr={text}
    >
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  )
}
