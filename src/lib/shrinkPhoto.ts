// Ужатие фото в браузере перед загрузкой (s237, чеки затрат): фото с телефона —
// 4–8 МБ и 4000+ px, а чеку хватает ~2 500 px. Длинная сторона → MAX_SIDE, JPEG.
// PDF и маленькие картинки уходят как есть. Любой сбой (нет canvas, битый файл,
// старый браузер) — тоже как есть: сервер сам проверит тип и размер.
// Ориентацию EXIF учитывает createImageBitmap (`imageOrientation: 'from-image'`).

export const MAX_SIDE = 2500
const QUALITY = 0.85
/** Меньше этого и в пределах MAX_SIDE — не трогаем. */
const SMALL_BYTES = 1.5 * 1024 * 1024

const jpegName = (name: string) => `${name.replace(/\.[^.]+$/, '') || 'doklad'}.jpg`

/** Размер после ужатия: длинная сторона не больше max, пропорции сохраняются. */
export const fitSize = (w: number, h: number, max = MAX_SIDE): { w: number; h: number } => {
  const k = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

export async function shrinkPhoto(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const { w, h } = fitSize(bmp.width, bmp.height)
    if (w === bmp.width && h === bmp.height && file.size <= SMALL_BYTES) {
      bmp.close()
      return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bmp.close()
      return file
    }
    // прозрачный PNG → белый фон (в JPEG прозрачность чёрная)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], jpegName(file.name), { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return file
  }
}
