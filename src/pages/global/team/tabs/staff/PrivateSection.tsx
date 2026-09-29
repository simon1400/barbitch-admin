import { useEffect, useRef, useState } from 'react'
import {
  badgeMutedCls,
  badgeNegCls,
  badgeWarnCls,
  btnNeutralCls,
  btnPinkCls,
  cardPadCls,
  cardTitleCls,
  countBadgeCls,
  hintCls,
  inputCls,
  labelCls,
} from '../../../../../ui/kit'
import { fmtCsDate } from '../../../../../utils/date'
import {
  PRIVATE_KEYS,
  PRIVATE_LABEL,
  fetchStaffPrivate,
  patchStaffPrivate,
  privateDiff,
  ymdToBirth,
  type PrivateValues,
  type StaffCard,
  type StaffPrivate,
} from '../../fetch/staff'
import { DocumentsBlock } from './DocumentsBlock'
import { OPEN_PRIVATE_EVENT, type OpenPrivateTarget } from './openPrivate'
import { EditButton, ErrorLine, Field } from './ui'

// Поля формы по строкам (адреса — на всю ширину).
const WIDE = new Set(['addressInCz', 'addressInHome'])

const valuesOf = (p: StaffPrivate): PrivateValues =>
  Object.fromEntries(PRIVATE_KEYS.map((k) => [k, p.private[k] ?? ''])) as PrivateValues

// Секция «Личные данные и документы». 🟥 Свёрнута и НЕ грузится, пока её не раскрыли:
// паспортные данные не едут в браузер при открытии карточки. Данные — ручкой `/private`.
export function PrivateSection({
  card,
  onPrivateSaved,
  onDocsCount,
}: {
  card: StaffCard
  onPrivateSaved: (p: StaffPrivate) => void
  onDocsCount: (n: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<StaffPrivate | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetchStaffPrivate(card.documentId)
      if (alive.current) setData(res)
    } catch (e) {
      if (alive.current) setLoadError((e as Error).message)
    } finally {
      if (alive.current) setLoading(false)
    }
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !data && !loading) load()
  }

  // «заполнить» / «загрузить скан» в онбординге: раскрыть секцию и прокрутить к полям или
  // к документам (прокрутка — после загрузки, когда блок уже в DOM)
  const [scrollTo, setScrollTo] = useState<OpenPrivateTarget | null>(null)
  const loadRef = useRef(load)
  loadRef.current = load
  const stateRef = useRef({ data, loading })
  stateRef.current = { data, loading }
  useEffect(() => {
    const onOpen = (e: Event) => {
      const target = (e as CustomEvent<OpenPrivateTarget>).detail === 'documents' ? 'documents' : 'private'
      setOpen(true)
      setScrollTo(target)
      if (!stateRef.current.data && !stateRef.current.loading) loadRef.current()
    }
    window.addEventListener(OPEN_PRIVATE_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_PRIVATE_EVENT, onOpen)
  }, [])
  useEffect(() => {
    if (!scrollTo || !open || !data) return
    const id = scrollTo === 'documents' ? 'staff-documents' : 'staff-private'
    document.querySelector(`[data-testid="${id}"]`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    setScrollTo(null)
  }, [scrollTo, open, data])

  const missing = card.privateMissing.length
  return (
    <section className={cardPadCls} data-testid="staff-private">
      <div className="flex items-center justify-between gap-3 cursor-pointer select-none" onClick={toggle}>
        <h2 className={`${cardTitleCls} flex items-center gap-2 flex-wrap`}>
          Личные данные и документы
          {missing > 0 && !card.erase?.erasedAt && <span className={badgeWarnCls}>данные не заполнены</span>}
          {card.erase?.erasedAt && <span className={badgeMutedCls}>стёрты {fmtCsDate(card.erase.erasedAt.slice(0, 10))}</span>}
          {card.documentsCount > 0 && <span className={countBadgeCls}>{card.documentsCount}</span>}
        </h2>
        <button type="button" className={`${btnNeutralCls} !px-3 !py-1.5`} aria-expanded={open}>
          {open ? 'Скрыть' : 'Показать'}
        </button>
      </div>
      {!open && (
        <div className={`mt-1.5 ${hintCls}`} data-testid="staff-private-hint">
          Здесь личные данные и сканы: паспорт, вид на жительство, zdravotní průkaz, договор. Нажмите «Показать».
        </div>
      )}
      {open && (
        <div className="pt-4">
          {loading && !data ? (
            <div className="py-6 text-[13px] font-semibold text-ink-faint">Načítání…</div>
          ) : loadError ? (
            <div role="alert" className="py-4 text-[13px] font-semibold text-neg">
              {loadError}{' '}
              <button type="button" className="underline" onClick={load}>
                Повторить
              </button>
            </div>
          ) : data ? (
            <>
              <PrivateFields
                card={card}
                data={data}
                onSaved={(res) => {
                  setData(res)
                  onPrivateSaved(res)
                }}
              />
              <DocumentsBlock
                card={card}
                docs={data.documents}
                onDocs={(docs) => {
                  setData((d) => (d ? { ...d, documents: docs } : d))
                  onDocsCount(docs.length)
                }}
              />
            </>
          ) : null}
        </div>
      )}
    </section>
  )
}

function PrivateFields({ card, data, onSaved }: { card: StaffCard; data: StaffPrivate; onSaved: (p: StaffPrivate) => void }) {
  const saved = valuesOf(data)
  const [edit, setEdit] = useState(false)
  const [draft, setDraft] = useState<PrivateValues>(saved)
  const [birthYmd, setBirthYmd] = useState(data.private.dateBirthYmd ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const startEdit = () => {
    setDraft(valuesOf(data))
    setBirthYmd(data.private.dateBirthYmd ?? '')
    setError(null)
    setEdit(true)
  }

  // дата рождения — поле даты; в карточку пишется строкой ДД.ММ.ГГГГ (её читают «Дни рождения»).
  // Нераспознанная старая строка остаётся как была, пока поле даты не тронули.
  const birthTouched = birthYmd !== (data.private.dateBirthYmd ?? '')
  const full: PrivateValues = { ...draft, dateBirth: birthTouched ? ymdToBirth(birthYmd) : saved.dateBirth }
  const diff = privateDiff(saved, full)
  const dirty = Object.keys(diff).length > 0

  const save = async () => {
    if (!dirty || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await patchStaffPrivate(card.documentId, diff, card.updatedAt)
      onSaved(res)
      setEdit(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const copyBank = () => {
    navigator.clipboard
      ?.writeText(saved.bankAccount)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }

  if (!edit) {
    return (
      <div>
        <div className="flex justify-end mb-2">{!card.erase?.erasedAt && <EditButton onClick={startEdit} />}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" data-testid="staff-private-view">
          {PRIVATE_KEYS.map((k) => (
            <div key={k} className={WIDE.has(k) ? 'sm:col-span-2' : ''}>
              <Field label={PRIVATE_LABEL[k]}>
                {saved[k] ? (
                  <>
                    {saved[k]}
                    {k === 'bankAccount' && (
                      <button type="button" className={`${btnNeutralCls} !px-2 !py-0.5 ml-2 !text-[11.5px]`} onClick={copyBank}>
                        {copied ? 'скопировано' : 'копировать'}
                      </button>
                    )}
                  </>
                ) : data.missing.includes(k) ? (
                  <span className={badgeNegCls}>не заполнено</span>
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </Field>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div data-testid="staff-private-edit">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {PRIVATE_KEYS.map((k) =>
          k === 'dateBirth' ? (
            <label key={k} className="block">
              <span className={labelCls}>{PRIVATE_LABEL[k]}</span>
              <input name={k} type="date" className={`${inputCls} w-full`} value={birthYmd} onChange={(e) => setBirthYmd(e.target.value)} />
              {!data.private.dateBirthYmd && saved.dateBirth && (
                <span className={hintCls}>В карточке сейчас: «{saved.dateBirth}» — не распознано как дата.</span>
              )}
            </label>
          ) : (
            <label key={k} className={`block ${WIDE.has(k) ? 'sm:col-span-2' : ''}`}>
              <span className={labelCls}>{PRIVATE_LABEL[k]}</span>
              <input
                name={k}
                type={k === 'email' ? 'email' : k.toLowerCase().includes('phone') ? 'tel' : 'text'}
                className={`${inputCls} w-full`}
                value={draft[k]}
                maxLength={200}
                placeholder={k.toLowerCase().includes('phone') ? '+420 …' : undefined}
                onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
              />
            </label>
          ),
        )}
      </div>
      <div className={`mt-2 ${hintCls}`}>Пустое поле стирает значение. В журнал пишется только, какие поля изменены.</div>
      <ErrorLine text={error} />
      <div className="mt-4 flex gap-2">
        <button type="button" className={btnPinkCls} onClick={save} disabled={!dirty || saving}>
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
        <button type="button" className={btnNeutralCls} onClick={() => setEdit(false)} disabled={saving}>
          Отмена
        </button>
      </div>
    </div>
  )
}
