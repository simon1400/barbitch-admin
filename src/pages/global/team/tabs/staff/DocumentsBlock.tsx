import { useState } from 'react'
import {
  badgeMutedCls,
  badgeNegCls,
  badgeWarnCls,
  btnDangerCls,
  btnNeutralCls,
  btnPinkCls,
  hintCls,
  inputCls,
  labelCls,
} from '../../../../../ui/kit'
import { fmtCsDate, todayYmd } from '../../../../../utils/date'
import {
  ACCEPT_DOC,
  DOC_KINDS,
  DOC_KIND_LABEL,
  MAX_FILE_BYTES,
  deleteStaffDocument,
  downloadStaffFile,
  fmtSize,
  updateStaffDocument,
  uploadStaffFile,
  validity,
  type DocKind,
  type StaffCard,
  type StaffDocument,
  type StaffPrivate,
} from '../../fetch/staff'
import { ErrorLine } from './ui'

/** Бейдж срока документа: просрочен / истекает в 30 дней. */
export function ValidityBadge({ validUntil, today }: { validUntil: string | null; today: string }) {
  const v = validity(validUntil, today)
  if (v.state === 'none') return null
  if (v.state === 'expired') return <span className={badgeNegCls}>просрочен {fmtCsDate(validUntil)}</span>
  if (v.state === 'soon') return <span className={badgeWarnCls}>до {fmtCsDate(validUntil)} (через {v.days} дн.)</span>
  return <span className={badgeMutedCls}>до {fmtCsDate(validUntil)}</span>
}

// Документы сотрудника: закрытый каталог на сервере (не CDN). Открываются только
// через fetch с сессией → blob; прямой ссылки на скан нет.
export function DocumentsBlock({
  card,
  docs,
  legacy,
  onDocs,
}: {
  card: StaffCard
  docs: StaffDocument[]
  legacy: StaffPrivate['legacyFiles']
  onDocs: (docs: StaffDocument[]) => void
}) {
  const today = todayYmd()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const openDoc = async (d: StaffDocument) => {
    setError(null)
    // окно — синхронно по клику (иначе браузер заблокирует всплывающее окно после await)
    const win = window.open('', '_blank')
    setBusy(d.documentId)
    try {
      const url = await downloadStaffFile(card.documentId, d.documentId)
      if (win) win.location.href = url
      else {
        const a = document.createElement('a')
        a.href = url
        a.download = d.fileName || 'document'
        a.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      win?.close()
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const remove = async (d: StaffDocument) => {
    if (!window.confirm(`Удалить документ «${d.title}»? Файл будет удалён с сервера без возможности восстановления.`)) return
    setBusy(d.documentId)
    setError(null)
    try {
      await deleteStaffDocument(card.documentId, d.documentId)
      onDocs(docs.filter((x) => x.documentId !== d.documentId))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const erased = !!card.erase?.erasedAt

  return (
    <div className="mt-6" data-testid="staff-documents">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <span className={labelCls}>Документы</span>
        {!adding && !erased && (
          <button type="button" className={`${btnNeutralCls} !px-3 !py-1.5`} onClick={() => setAdding(true)}>
            + Добавить документ
          </button>
        )}
      </div>
      {adding && (
        <UploadForm
          card={card}
          onDone={(doc) => {
            onDocs([doc, ...docs])
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      {docs.length === 0 && !legacy.length ? (
        <div className="text-[13px] font-semibold text-ink-faint">Документов нет.</div>
      ) : (
        <ul className="m-0 p-0 list-none">
          {docs.map((d, i) =>
            editing === d.documentId ? (
              <li key={d.documentId} className={i ? 'border-t border-line-soft' : ''}>
                <MetaForm
                  card={card}
                  doc={d}
                  onDone={(next) => {
                    onDocs(docs.map((x) => (x.documentId === next.documentId ? next : x)))
                    setEditing(null)
                  }}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li
                key={d.documentId}
                data-doc={d.documentId}
                className={`flex items-center gap-2.5 flex-wrap py-2.5 ${i ? 'border-t border-line-soft' : ''}`}
              >
                <span className={badgeMutedCls}>{DOC_KIND_LABEL[d.kind] ?? d.kind}</span>
                <span className="text-[13.5px] font-bold text-ink">{d.title}</span>
                <ValidityBadge validUntil={d.validUntil} today={today} />
                <span className="text-[12px] font-semibold text-ink-faint">
                  {fmtSize(d.size)}
                  {d.createdAt ? ` · ${fmtCsDate(d.createdAt.slice(0, 10))}` : ''}
                  {d.uploadedBy ? ` · ${d.uploadedBy}` : ''}
                </span>
                <span className="ml-auto flex gap-1.5">
                  <button type="button" className={`${btnNeutralCls} !px-2.5 !py-1`} onClick={() => openDoc(d)} disabled={busy === d.documentId}>
                    {busy === d.documentId ? '…' : 'Открыть'}
                  </button>
                  <button type="button" className={`${btnNeutralCls} !px-2.5 !py-1`} onClick={() => setEditing(d.documentId)}>
                    Изменить
                  </button>
                  <button type="button" className={`${btnDangerCls} !px-2.5 !py-1`} onClick={() => remove(d)} disabled={busy === d.documentId}>
                    Удалить
                  </button>
                </span>
              </li>
            ),
          )}
          {legacy.map((f) => (
            <li key={`legacy-${f.id}`} className="flex items-center gap-2.5 flex-wrap py-2.5 border-t border-line-soft">
              <span className={badgeWarnCls}>старый скан</span>
              <span className="text-[13.5px] font-bold text-ink">{f.name}</span>
              <span className="text-[12px] font-semibold text-ink-faint">{fmtSize(f.size)}</span>
              {f.url && (
                <a href={f.url} target="_blank" rel="noreferrer" className={`${btnNeutralCls} !px-2.5 !py-1 ml-auto`}>
                  Открыть
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {legacy.length > 0 && (
        <div className={`mt-2 ${hintCls}`}>
          «Старый скан» загружен раньше через панель Strapi и лежит на CDN — будет перенесён в закрытое хранилище.
        </div>
      )}
      <ErrorLine text={error} />
    </div>
  )
}

function UploadForm({ card, onDone, onCancel }: { card: StaffCard; onDone: (d: StaffDocument) => void; onCancel: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<DocKind>('passport')
  const [title, setTitle] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tooBig = !!file && file.size > MAX_FILE_BYTES
  const canSave = !!file && !tooBig && !saving

  const save = async () => {
    if (!file || !canSave) return
    setSaving(true)
    setError(null)
    try {
      const res = await uploadStaffFile(card.documentId, {
        target: 'document',
        file,
        kind,
        title: title.trim() || undefined,
        validUntil: validUntil || undefined,
      })
      if ('document' in res) onDone(res.document)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-3 rounded-lg border border-line px-4 py-3" data-testid="staff-upload">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block sm:col-span-2">
          <span className={labelCls}>Файл (JPG, PNG, WEBP, PDF · до 10 МБ)</span>
          <input
            name="file"
            type="file"
            accept={ACCEPT_DOC}
            className="block text-[13px] font-semibold text-ink-body"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Тип</span>
          <select name="kind" className={`${inputCls} w-full`} value={kind} onChange={(e) => setKind(e.target.value as DocKind)}>
            {DOC_KINDS.map((k) => (
              <option key={k} value={k}>
                {DOC_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Действует до (необяз.)</span>
          <input name="validUntil" type="date" className={`${inputCls} w-full`} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelCls}>Название (необяз. — по имени файла)</span>
          <input name="title" className={`${inputCls} w-full`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </label>
      </div>
      {tooBig && <div className="mt-2 text-[12px] font-semibold text-neg">Файл больше 10 МБ.</div>}
      <ErrorLine text={error} />
      <div className="mt-3 flex gap-2">
        <button type="button" className={btnPinkCls} onClick={save} disabled={!canSave}>
          {saving ? 'Загружаю…' : 'Загрузить'}
        </button>
        <button type="button" className={btnNeutralCls} onClick={onCancel} disabled={saving}>
          Отмена
        </button>
      </div>
    </div>
  )
}

function MetaForm({
  card,
  doc,
  onDone,
  onCancel,
}: {
  card: StaffCard
  doc: StaffDocument
  onDone: (d: StaffDocument) => void
  onCancel: () => void
}) {
  const [kind, setKind] = useState<DocKind>(doc.kind)
  const [title, setTitle] = useState(doc.title)
  const [validUntil, setValidUntil] = useState(doc.validUntil ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const data: { kind?: DocKind; title?: string; validUntil?: string | null } = {}
  if (kind !== doc.kind) data.kind = kind
  if (title.trim() !== doc.title) data.title = title.trim()
  if ((validUntil || null) !== (doc.validUntil || null)) data.validUntil = validUntil || null
  const canSave = !saving && Object.keys(data).length > 0 && title.trim() !== ''

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      onDone((await updateStaffDocument(card.documentId, doc.documentId, data)).document)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="py-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className={labelCls}>Тип</span>
          <select className={`${inputCls} w-full`} value={kind} onChange={(e) => setKind(e.target.value as DocKind)}>
            {DOC_KINDS.map((k) => (
              <option key={k} value={k}>
                {DOC_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Название</span>
          <input className={`${inputCls} w-full`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Действует до</span>
          <input type="date" className={`${inputCls} w-full`} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </label>
      </div>
      <ErrorLine text={error} />
      <div className="mt-3 flex gap-2">
        <button type="button" className={btnPinkCls} onClick={save} disabled={!canSave}>
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
        <button type="button" className={btnNeutralCls} onClick={onCancel} disabled={saving}>
          Отмена
        </button>
      </div>
    </div>
  )
}
