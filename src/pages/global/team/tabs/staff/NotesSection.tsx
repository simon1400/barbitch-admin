import { useState } from 'react'
import { btnDangerCls, btnNeutralCls, btnPinkCls, inputBaseCls, mutedCls } from '../../../../../ui/kit'
import { addStaffNote, deleteStaffNote, fmtWhen, updateStaffNote, type StaffCard, type StaffNote } from '../../fetch/staff'
import { ErrorLine, SectionCard } from './ui'

const MAX_NOTE = 2000
const textareaCls = `${inputBaseCls} w-full rounded-lg px-3 py-[9px] text-[14px] min-h-[76px] resize-y`


// Заметки руководства: новые сверху; правка и удаление — автор или владелец (решает сервер: canEdit).
export function NotesSection({ card, onNotes }: { card: StaffCard; onNotes: (n: StaffNote[]) => void }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)

  const run = async (fn: () => Promise<{ notes: StaffNote[] }>) => {
    setSaving(true)
    setError(null)
    try {
      onNotes((await fn()).notes)
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const add = async () => {
    if (!text.trim() || saving) return
    if (await run(() => addStaffNote(card.documentId, text))) setText('')
  }

  const saveEdit = async () => {
    if (!editing || !editing.text.trim() || saving) return
    if (await run(() => updateStaffNote(card.documentId, editing.id, editing.text))) setEditing(null)
  }

  const remove = async (n: StaffNote) => {
    if (!window.confirm('Удалить заметку?')) return
    await run(() => deleteStaffNote(card.documentId, n.documentId))
  }

  return (
    <SectionCard title="Заметки руководства" testId="staff-notes">
      {!card.erase?.erasedAt && (
        <div className="mb-3">
          <textarea
            name="note"
            className={textareaCls}
            value={text}
            maxLength={MAX_NOTE}
            placeholder="Договорённости, замечания…"
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-3">
            <button type="button" className={btnPinkCls} onClick={add} disabled={!text.trim() || saving}>
              {saving && !editing ? 'Сохраняю…' : 'Добавить заметку'}
            </button>
            <span className={mutedCls}>Видит только руководство.</span>
          </div>
        </div>
      )}
      <ErrorLine text={error} />
      {card.notes.length === 0 ? (
        <div className="text-[13px] font-semibold text-ink-faint">Заметок нет.</div>
      ) : (
        <ul className="m-0 p-0 list-none">
          {card.notes.map((n, i) => (
            <li key={n.documentId} className={`py-2.5 ${i ? 'border-t border-line-soft' : ''}`}>
              <div className={mutedCls}>
                {n.authorName || '—'} · {fmtWhen(n.createdAt)}
                {n.updatedAt && n.createdAt && n.updatedAt !== n.createdAt ? ' · изменено' : ''}
              </div>
              {editing?.id === n.documentId ? (
                <div className="mt-1.5">
                  <textarea
                    className={textareaCls}
                    value={editing.text}
                    maxLength={MAX_NOTE}
                    onChange={(e) => setEditing({ id: n.documentId, text: e.target.value })}
                  />
                  <div className="mt-2 flex gap-2">
                    <button type="button" className={btnPinkCls} onClick={saveEdit} disabled={!editing.text.trim() || saving}>
                      {saving ? 'Сохраняю…' : 'Сохранить'}
                    </button>
                    <button type="button" className={btnNeutralCls} onClick={() => setEditing(null)} disabled={saving}>
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-1 text-[13.5px] font-medium text-ink-body whitespace-pre-wrap break-words">{n.text}</div>
                  {n.canEdit && (
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        type="button"
                        className={`${btnNeutralCls} !px-2.5 !py-1`}
                        onClick={() => setEditing({ id: n.documentId, text: n.text })}
                        disabled={saving}
                      >
                        Изменить
                      </button>
                      <button type="button" className={`${btnDangerCls} !px-2.5 !py-1`} onClick={() => remove(n)} disabled={saving}>
                        Удалить
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
