import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { badgeFaintCls, badgeMutedCls, badgeWarnCls, btnNeutralCls, hintCls, mutedCls } from '../../../../../ui/kit'
import { fmtCsDate } from '../../../../../utils/date'
import {
  ACCEPT_PHOTO,
  FLAG_LABEL,
  HISTORY_LABEL,
  MAX_FILE_BYTES,
  TIME_OFF_LABEL,
  fetchStaffCard,
  fmtWhen,
  positionLabel,
  uploadStaffFile,
  type StaffCard,
  type StaffHistoryItem,
  type StaffPrivate,
} from '../../fetch/staff'
import { AccountSection } from './AccountSection'
import { BasicSection } from './BasicSection'
import { BookingSection } from './BookingSection'
import { ContractSection } from './ContractSection'
import { OnboardingSection } from './OnboardingSection'
import { LeaveSection } from './LeaveSection'
import { StaffMetricsSection } from './StaffMetricsSection'
import { NotesSection } from './NotesSection'
import { PaySection } from './PaySection'
import { PrivateSection } from './PrivateSection'
import { ErrorLine, PasswordBox, SectionCard, StaffAvatar } from './ui'

const linkCls = 'font-semibold text-brand-dark underline'

// Карточка сотрудника `/global/team/staff/:docId` (s226). Каждая секция сохраняется
// отдельно и возвращает свежую карточку; личные данные — отдельной ручкой при раскрытии.
export default function StaffCardPage() {
  const { docId = '' } = useParams()
  const [card, setCard] = useState<StaffCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // пароль после создания учётки / сброса — показывается один раз (в базе только хэш)
  const [password, setPassword] = useState<{ documentId: string; username: string; password: string } | null>(null)
  const seq = useRef(0)

  const load = useCallback(async () => {
    const my = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const res = await fetchStaffCard(docId)
      if (my === seq.current) setCard(res)
    } catch (e) {
      if (my === seq.current) setError((e as Error).message)
    } finally {
      if (my === seq.current) setLoading(false)
    }
  }, [docId])

  useEffect(() => {
    load()
  }, [load])

  // ответ секции — карточка; запоздалый ответ после ухода на другую карточку не применяется.
  // Сверка — с ТЕКУЩЕЙ карточкой адреса (ref), а не с docId замыкания: при переходе A → B
  // страница не пересоздаётся, и колбэк, взятый секцией A, пропустил бы ответ A поверх B.
  const currentDocId = useRef(docId)
  currentDocId.current = docId
  // номер последнего изменения карточки на странице: тихое перечитывание применяется,
  // только если после его старта карточку никто не менял (иначе старый ответ откатил бы
  // свежий ответ секции вместе с updatedAt → ложный 409 на следующей правке)
  const version = useRef(0)
  const onCard = useCallback((c: StaffCard) => {
    if (c.documentId !== currentDocId.current) return
    version.current++
    setCard(c)
  }, [])
  // частичные обновления — только своей карточке
  const patchCard = (id: string, patch: Partial<StaffCard>) => {
    version.current++
    setCard((c) => (c && c.documentId === id && id === currentDocId.current ? { ...c, ...patch } : c))
  }

  // чек-лист считает сервер (фаза 2): после личных данных, документов и каталога пунктов —
  // перечитать карточку тихо (без «Обновляю…»); ответ чужой карточки не применяется (onCard)
  const reloadQuiet = useCallback(() => {
    const at = version.current
    fetchStaffCard(currentDocId.current)
      .then((c) => {
        if (version.current === at) onCard(c)
      })
      .catch(() => {})
  }, [onCard])

  const onPrivateSaved = (p: StaffPrivate) => {
    patchCard(p.documentId, { updatedAt: p.updatedAt, privateMissing: p.missing })
    reloadQuiet()
  }

  const back = (
    <Link to="/global/team/staff" className={`${mutedCls} hover:text-ink`}>
      ← Все сотрудники
    </Link>
  )

  if (!card) {
    return (
      <>
        {back}
        <div className="py-12 text-center text-[13px] font-semibold">
          {loading ? (
            <span className="text-ink-faint">Načítání…</span>
          ) : (
            <span role="alert" className="text-neg">
              {error}
            </span>
          )}
        </div>
      </>
    )
  }

  const master = card.position === 'master'

  return (
    <div data-testid="staff-card">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        {back}
        <button type="button" className={`${btnNeutralCls} !px-3 !py-1.5`} onClick={load} disabled={loading}>
          {loading ? 'Обновляю…' : 'Обновить'}
        </button>
      </div>
      <ErrorLine text={error} />

      {password?.documentId === card.documentId && <PasswordBox username={password.username} password={password.password} onClose={() => setPassword(null)} />}

      <HeaderCard card={card} onCard={onCard} />

      <OnboardingSection key={`onboarding-${card.documentId}`} card={card} onCard={onCard} onReload={reloadQuiet} />
      <BasicSection key={`basic-${card.documentId}`} card={card} onCard={onCard} />
      {master && <BookingSection key={`booking-${card.documentId}`} card={card} onCard={onCard} />}
      <PaySection key={`pay-${card.documentId}`} card={card} onCard={onCard} />
      <ContractSection key={`contract-${card.documentId}`} card={card} onCard={onCard} />
      <PrivateSection
        key={`private-${card.documentId}`}
        card={card}
        onPrivateSaved={onPrivateSaved}
        onDocsCount={(n) => {
          patchCard(card.documentId, { documentsCount: n })
          // документы (их тип и срок) закрывают пункты чек-листа: паспорт, zdravotní průkaz, скан договора
          reloadQuiet()
        }}
      />
      <NotesSection key={`notes-${card.documentId}`} card={card} onNotes={(notes) => patchCard(card.documentId, { notes })} />
      <AccountSection key={`account-${card.documentId}`} card={card} onCard={onCard} onPassword={(username, pw) => setPassword({ documentId: card.documentId, username, password: pw })} />
      <SummarySection card={card} />
      <StaffMetricsSection key={`metrics-${card.documentId}`} card={card} />
      <HistorySection items={card.history} />
      <LeaveSection key={`leave-${card.documentId}-${card.left}`} card={card} onCard={onCard} />
    </div>
  )
}

function HeaderCard({ card, onCard }: { card: StaffCard; onCard: (c: StaffCard) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const upload = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setError('Файл больше 10 МБ.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const res = await uploadStaffFile(card.documentId, { target: 'photo', file })
      if (!('document' in res)) onCard(res)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-3">
          <StaffAvatar name={card.name} photo={card.photo} size={56} />
          <span>
            <span className="block text-[20px] leading-[1.2] font-extrabold text-ink" data-testid="staff-name">
              {card.name}
            </span>
            <span className="block mt-0.5 text-[13px] font-semibold text-ink-soft">
              {positionLabel(card.position)}
              {card.position === 'master' && card.tier === 'junior' ? ' · junior' : ''}
              {card.left
                ? ` · завершил(а) работу${card.leftAt ? ` ${fmtCsDate(card.leftAt)}` : ''}`
                : card.hiredAt
                  ? ` · работает с ${fmtCsDate(card.hiredAt)}`
                  : ''}
            </span>
          </span>
        </span>
      }
      action={
        !card.left && (
          <>
            <input
              ref={input}
              type="file"
              accept={ACCEPT_PHOTO}
              className="hidden"
              data-testid="staff-photo-input"
              onChange={(e) => upload(e.target.files?.[0])}
            />
            <button type="button" className={`${btnNeutralCls} !px-3 !py-1.5`} disabled={uploading} onClick={() => input.current?.click()}>
              {uploading ? 'Загружаю…' : card.photo ? 'Заменить фото' : 'Загрузить фото'}
            </button>
          </>
        )
      }
      testId="staff-header"
    >
      <div className="flex gap-1.5 flex-wrap">
        {card.left && <span className={badgeFaintCls}>ушёл(ла)</span>}
        {!card.published && <span className={badgeWarnCls}>не опубликована</span>}
        {card.self && <span className={badgeMutedCls}>это вы</span>}
        {card.flags.map((f) => (
          <span key={f} className={badgeWarnCls}>
            {FLAG_LABEL[f] ?? f}
          </span>
        ))}
        {card.checklist ? (
          <span className={card.checklist.open ? badgeWarnCls : badgeMutedCls} data-testid="staff-percent">
            заполнено {card.checklist.percent} %
          </span>
        ) : (
          !card.left && !card.flags.length && <span className={badgeMutedCls}>всё заполнено</span>
        )}
      </div>
      {!card.left && <div className={`mt-2 ${hintCls}`}>Фото публичное — его видят клиенты на сайте при выборе мастера.</div>}
      <ErrorLine text={error} />
    </SectionCard>
  )
}

function SummarySection({ card }: { card: StaffCard }) {
  const t = card.nextTimeOff
  return (
    <SectionCard title="Сводка" testId="staff-summary">
      <div className="text-[13.5px] font-semibold text-ink-body">
        {t ? (
          <>
            Ближайшее отсутствие: {TIME_OFF_LABEL[t.type] ?? t.type} {fmtCsDate(t.startDate)}
            {t.endDate !== t.startDate ? ` — ${fmtCsDate(t.endDate)}` : ''}
          </>
        ) : (
          'Отсутствий впереди нет.'
        )}
      </div>
      <div className="mt-2 flex gap-x-4 gap-y-1 flex-wrap text-[13px]">
        <Link to="/global/team/salaries" className={linkCls}>
          Зарплаты
        </Link>
        <Link to="/global/team/corrections" className={linkCls}>
          Корректировки
        </Link>
        <Link to="/global/team/time-off" className={linkCls}>
          Отпуска
        </Link>
        {card.position === 'master' && (
          <Link to={`/schedule?master=${encodeURIComponent(card.documentId)}`} className={linkCls}>
            График
          </Link>
        )}
      </div>
    </SectionCard>
  )
}


/** «Nová sazba: Anna · DPP 180 Kč/h od 01.10.2026 · …» → части после имени. */
const historyParts = (summary: string): string[] => {
  const cut = summary.indexOf(': ')
  return (cut < 0 ? summary : summary.slice(cut + 2))
    .split(' · ')
    .slice(1)
    .map((s) => s.trim())
    .filter(Boolean)
}

function HistorySection({ items }: { items: StaffHistoryItem[] }) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, 8)
  return (
    <SectionCard title="История правок" testId="staff-history">
      {items.length === 0 ? (
        <div className="text-[13px] font-semibold text-ink-faint">Записей нет — правки из панели Strapi сюда не попадают.</div>
      ) : (
        <>
          <ul className="m-0 p-0 list-none">
            {shown.map((h, i) => (
              <li key={`${h.createdAt}-${i}`} className={`py-2 ${i ? 'border-t border-line-soft' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={badgeMutedCls}>{HISTORY_LABEL[h.action] ?? h.action}</span>
                  <span className={mutedCls}>
                    {fmtWhen(h.createdAt)} · {h.actorName || '—'}
                  </span>
                </div>
                {historyParts(h.summary).length > 0 && (
                  <div className="mt-1 text-[12.5px] font-medium text-ink-body">{historyParts(h.summary).join(' · ')}</div>
                )}
              </li>
            ))}
          </ul>
          {items.length > shown.length && (
            <button type="button" className={`${btnNeutralCls} !px-3 !py-1.5 mt-2`} onClick={() => setAll(true)}>
              Показать все ({items.length})
            </button>
          )}
        </>
      )}
    </SectionCard>
  )
}
