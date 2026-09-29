import { useCallback, useEffect, useRef, useState } from 'react'
import { badgeMutedCls, badgeNegCls, badgeWarnCls, btnNeutralCls, hintCls, kickerCls, pageShellCls } from '../../ui/kit'
import { fmtCsDate } from '../../utils/date'
import {
  DOC_KIND_LABEL,
  PRIVATE_KEYS,
  PRIVATE_LABEL,
  contractText,
  positionLabel,
  rateText,
} from '../global/team/fetch/staff'
import { ErrorLine, Field, SectionCard, StaffAvatar } from '../global/team/tabs/staff/ui'
import { fetchMyCard, type MyCard, type MyDocument } from './fetch/myCard'

// «Мои данные» `/me` (фаза 2 карточки сотрудника): мастер, администратор и управляющая видят
// СВОЮ карточку — только чтение. Правок и просьб об исправлении здесь нет (решение
// владельца): если что-то неверно — сказать руководству устно. Сканы не скачиваются.
export default function MyCardPage() {
  const [card, setCard] = useState<MyCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  const load = useCallback(async () => {
    const my = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const res = await fetchMyCard()
      if (my === seq.current) setCard(res)
    } catch (e) {
      if (my === seq.current) setError((e as Error).message)
    } finally {
      if (my === seq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className={pageShellCls} data-testid="my-card">
      <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className={kickerCls}>Только просмотр</div>
          <h1 className="text-[24px] leading-[1.2] font-extrabold text-ink">Мои данные</h1>
        </div>
        <button type="button" className={`${btnNeutralCls} !px-3 !py-1.5`} onClick={load} disabled={loading}>
          {loading ? 'Обновляю…' : 'Обновить'}
        </button>
      </div>
      <div className={`mb-3.5 ${hintCls}`} data-testid="my-card-note">
        Если что-то неверно — скажите руководству салона, они исправят.
      </div>

      {!card ? (
        <div className="py-12 text-center text-[13px] font-semibold">
          {loading ? (
            <span className="text-ink-faint">Načítání…</span>
          ) : (
            <span role="alert" className="text-neg">
              {error}
            </span>
          )}
        </div>
      ) : (
        <>
          <ErrorLine text={error} />
          <SectionCard
            title={
              <span className="flex items-center gap-3">
                <StaffAvatar name={card.name} photo={card.photo} size={56} />
                <span>
                  <span className="block text-[20px] leading-[1.2] font-extrabold text-ink">{card.name}</span>
                  <span className="block mt-0.5 text-[13px] font-semibold text-ink-soft">
                    {positionLabel(card.position)}
                    {card.position === 'master' && card.tier === 'junior' ? ' · junior' : ''}
                    {card.hiredAt ? ` · работаете с ${fmtCsDate(card.hiredAt)}` : ''}
                  </span>
                </span>
              </span>
            }
            testId="my-card-header"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <Field label="Договор">{contractText(card.contracts.current)}</Field>
              {card.contracts.current?.type === 'hpp' && card.contracts.current.probationUntil && (
                <Field label="Испытательный срок">до {fmtCsDate(card.contracts.current.probationUntil)}</Field>
              )}
              {card.contracts.current?.type === 'ico' && <Field label="IČO">{card.contracts.current.ico || '—'}</Field>}
              {card.position === 'master' ? (
                <Field label="Доля от услуг">{card.pay.ratePercent == null ? '—' : `${card.pay.ratePercent} %`}</Field>
              ) : (
                <Field label="Ставка">{card.pay.currentRate ? rateText({ ...card.pay.currentRate, to: null }) : '—'}</Field>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Личные данные" testId="my-card-private">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {PRIVATE_KEYS.map((k) => (
                <Field key={k} label={PRIVATE_LABEL[k]}>
                  {card.private[k] ? card.private[k] : <span className="text-ink-faint">не указано</span>}
                </Field>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Документы" testId="my-card-documents">
            {card.documents.length === 0 ? (
              <div className="text-[13px] font-semibold text-ink-faint">Документов в карточке нет.</div>
            ) : (
              <ul className="m-0 p-0 list-none">
                {card.documents.map((d, i) => (
                  <li key={`${d.kind}-${d.title}-${i}`} className={`flex items-center gap-2 flex-wrap py-2 ${i ? 'border-t border-line-soft' : ''}`}>
                    <span className="text-[13.5px] font-bold text-ink">{d.title || DOC_KIND_LABEL[d.kind]}</span>
                    {d.title && d.title !== DOC_KIND_LABEL[d.kind] && <span className={hintCls}>{DOC_KIND_LABEL[d.kind] ?? d.kind}</span>}
                    <span className="flex-1" />
                    <DocValidity doc={d} />
                  </li>
                ))}
              </ul>
            )}
            <div className={`mt-2 ${hintCls}`}>Сканы хранятся у руководства; скачать их отсюда нельзя.</div>
          </SectionCard>

          <SectionCard title="История договоров" testId="my-card-contracts">
            {card.contracts.list.length === 0 ? (
              <div className="text-[13px] font-semibold text-ink-faint">Договоров не внесено.</div>
            ) : (
              <ul className="m-0 p-0 list-none">
                {[...card.contracts.list].reverse().map((c, i) => (
                  <li key={`${c.type}-${c.from}`} className={`py-2 ${i ? 'border-t border-line-soft' : ''}`}>
                    <span className="text-[13.5px] font-bold text-ink">{contractText(c)}</span>
                    {c.type === 'hpp' && c.probationUntil && (
                      <span className={`ml-2 ${hintCls}`}>испытательный до {fmtCsDate(c.probationUntil)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}

function DocValidity({ doc }: { doc: MyDocument }) {
  if (doc.state === 'none' || !doc.validUntil) return <span className={badgeMutedCls}>без срока</span>
  if (doc.state === 'expired') return <span className={badgeNegCls}>истёк {fmtCsDate(doc.validUntil)}</span>
  if (doc.state === 'soon') return <span className={badgeWarnCls}>до {fmtCsDate(doc.validUntil)} · осталось {doc.daysLeft} дн.</span>
  return <span className={badgeMutedCls}>до {fmtCsDate(doc.validUntil)}</span>
}
