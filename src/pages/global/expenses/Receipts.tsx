import { useRef, useState } from 'react'
import { btnDangerCls, btnNeutralCls, hintCls, labelCls } from '../../../ui/kit'
import { fmtSize } from '../../../utils/fileSize'
import {
  ACCEPT_RECEIPT,
  MAX_COST_FILES,
  deleteCostFile,
  requestCostFileDelete,
  uploadCostFile,
  type CostFile,
  type CostRow,
} from '../fetch/expenses'
import { openReceipt, prepareReceipts } from './receiptFiles'

const fileInputCls = 'block w-full text-[13px] font-semibold text-ink-body file:mr-3 file:rounded-md file:border-0 file:bg-surface-hover file:px-3 file:py-1.5 file:font-bold'

// Новая затрата: чеки выбираются заранее и грузятся сразу после создания.
export function ReceiptPicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const pick = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy(true)
    const res = await prepareReceipts([...list], MAX_COST_FILES - files.length)
    setBusy(false)
    setErrors(res.errors)
    onChange([...files, ...res.files])
    if (input.current) input.current.value = ''
  }

  return (
    <div className="sm:col-span-2" data-testid="receipt-picker">
      <span className={labelCls}>Чек — фото или PDF (необязательно)</span>
      {files.length < MAX_COST_FILES && (
        <input
          ref={input}
          name="receipt"
          type="file"
          accept={ACCEPT_RECEIPT}
          multiple
          className={`${fileInputCls} mt-1`}
          disabled={busy}
          onChange={(e) => void pick(e.target.files)}
        />
      )}
      {busy && <div className={`${hintCls} mt-1`}>Готовлю фото…</div>}
      {files.length > 0 && (
        <ul className="list-none m-0 mt-2 p-0 flex flex-col gap-1">
          {files.map((f, i) => (
            <li key={`${f.name}:${i}`} className="flex items-center gap-2 text-[13px] font-semibold text-ink-body">
              <span className="min-w-0 flex-1 break-words">
                📎 {f.name} <span className="text-ink-faint">· {fmtSize(f.size)}</span>
              </span>
              <button type="button" className={btnNeutralCls} onClick={() => onChange(files.filter((_, j) => j !== i))}>
                Убрать
              </button>
            </li>
          ))}
        </ul>
      )}
      {errors.map((e) => (
        <div key={e} role="alert" className="mt-1 text-[12px] font-semibold text-neg">
          {e}
        </div>
      ))}
    </div>
  )
}

// Чеки существующей затраты: открыть, приложить (обе роли сразу — деньги не меняются),
// удалить — владелец сразу, управляющая — запрос владельцу.
export function ReceiptList({
  row,
  isOwner,
  onFilesChanged,
  onRequested,
}: {
  row: CostRow
  isOwner: boolean
  /** чек приложен или удалён — странице перечитать месяц (📎 в таблице) */
  onFilesChanged: () => void
  /** управляющая запросила удаление чека */
  onRequested: () => void
}) {
  const [files, setFiles] = useState<CostFile[]>(row.files ?? [])
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const input = useRef<HTMLInputElement>(null)
  const hasRequest = row.pendingRequest !== null

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    setErrors([])
    try {
      await fn()
    } catch (e) {
      setErrors([(e as Error).message])
    } finally {
      setBusy(null)
    }
  }

  const add = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy('add')
    const prepared = await prepareReceipts([...list], MAX_COST_FILES - files.length)
    const errs = [...prepared.errors]
    const added: CostFile[] = []
    for (const f of prepared.files) {
      try {
        added.push(await uploadCostFile(row, f))
      } catch (e) {
        errs.push(`«${f.name}»: ${(e as Error).message}`)
      }
    }
    if (input.current) input.current.value = ''
    setFiles((cur) => [...cur, ...added])
    setErrors(errs)
    setBusy(null)
    if (added.length) onFilesChanged()
  }

  const remove = (f: CostFile) =>
    run(f.id, async () => {
      if (isOwner) {
        if (!window.confirm(`Удалить чек «${f.fileName}»? Файл будет удалён с сервера навсегда.`)) return
        await deleteCostFile(row, f.id)
        setFiles((cur) => cur.filter((x) => x.id !== f.id))
        onFilesChanged()
      } else {
        if (!window.confirm(`Отправить владельцу запрос на удаление чека «${f.fileName}»?`)) return
        await requestCostFileDelete(row, f.id)
        onRequested()
      }
    })

  return (
    <div className="mt-4" data-testid="receipt-list">
      <span className={labelCls}>Чеки ({files.length})</span>
      {files.length === 0 && <div className={`${hintCls} mt-1`}>Чек не приложен.</div>}
      {files.length > 0 && (
        <ul className="list-none m-0 mt-1 p-0 flex flex-col gap-1">
          {files.map((f) => {
            const asked = row.pendingRequest?.action === 'file_delete' && row.pendingRequest.fileId === f.id
            return (
              <li key={f.id} data-file={f.id} className="flex items-center gap-2 flex-wrap text-[13px] font-semibold text-ink-body">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left break-words bg-transparent border-0 p-0 font-semibold text-brand-dark hover:underline cursor-pointer"
                  disabled={busy !== null}
                  onClick={() => run(`open:${f.id}`, () => openReceipt(row, f))}
                >
                  📎 {f.fileName}
                </button>
                <span className="text-ink-faint">
                  {fmtSize(f.size)}
                  {f.uploadedBy ? ` · ${f.uploadedBy}` : ''}
                </span>
                {asked ? (
                  <span className="text-[12px] font-semibold text-warn">ждёт одобрения: удаление</span>
                ) : (
                  <button
                    type="button"
                    className={btnDangerCls}
                    disabled={busy !== null || (!isOwner && hasRequest)}
                    onClick={() => void remove(f)}
                  >
                    {busy === f.id ? '…' : isOwner ? 'Удалить' : 'Запросить удаление'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {files.length < MAX_COST_FILES && (
        <label className="block mt-2">
          <span className="sr-only">Приложить чек</span>
          <input
            ref={input}
            name="receiptAdd"
            type="file"
            accept={ACCEPT_RECEIPT}
            multiple
            className={fileInputCls}
            disabled={busy !== null}
            onChange={(e) => void add(e.target.files)}
          />
        </label>
      )}
      {busy === 'add' && <div className={`${hintCls} mt-1`}>Загружаю…</div>}
      {errors.map((e) => (
        <div key={e} role="alert" className="mt-1 text-[12px] font-semibold text-neg">
          {e}
        </div>
      ))}
    </div>
  )
}
