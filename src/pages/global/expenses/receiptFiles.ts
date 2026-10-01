// Чеки затрат (s237): подготовка выбранных файлов и открытие чека — без React,
// общее у формы затраты и блока «Ждут одобрения».
import { shrinkPhoto } from '../../../lib/shrinkPhoto'
import {
  MAX_COST_FILES,
  MAX_COST_FILE_BYTES,
  RECEIPT_TYPES,
  downloadCostFile,
  type CostFile,
  type CostRow,
} from '../fetch/expenses'

/**
 * Выбранные файлы → готовые к загрузке: фото ужимаются, неподходящие отсеиваются
 * с причиной. `room` — сколько ещё можно приложить.
 */
export async function prepareReceipts(list: File[], room: number): Promise<{ files: File[]; errors: string[] }> {
  const files: File[] = []
  const errors: string[] = []
  for (const raw of list) {
    if (files.length >= room) {
      errors.push(`К затрате — не больше ${MAX_COST_FILES} чеков.`)
      break
    }
    const f = await shrinkPhoto(raw)
    if (!RECEIPT_TYPES.includes(f.type)) {
      errors.push(
        /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name)
          ? `«${f.name}»: HEIC не поддерживается — выберите фото как JPEG.`
          : `«${f.name}»: чек — фото (JPG, PNG, WEBP) или PDF.`,
      )
      continue
    }
    if (f.size > MAX_COST_FILE_BYTES) {
      errors.push(`«${f.name}»: больше 10 МБ.`)
      continue
    }
    files.push(f)
  }
  return { files, errors: [...new Set(errors)] }
}

/** Чек в новой вкладке: окно — синхронно по клику, иначе браузер заблокирует его после await. */
export async function openReceipt(row: Pick<CostRow, 'documentId'>, f: CostFile): Promise<void> {
  const win = window.open('', '_blank')
  try {
    const url = await downloadCostFile(row, f.id)
    if (win) win.location.href = url
    else {
      const a = document.createElement('a')
      a.href = url
      a.download = f.fileName || 'doklad'
      a.click()
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    win?.close()
    throw e
  }
}
