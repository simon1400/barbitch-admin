import { useState, useEffect, useCallback, useMemo } from 'react'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import {
  getComebackReport,
  searchClientsForOptOut,
  setReminderOptOut,
  dayKeyPrague,
  fmtDay,
  type ClientBrief,
  type ComebackDay,
  type ComebackReport,
  type ComebackRow,
} from '../fetch/comebackReminders'

const PAGE = 50

const fmtDayTime = (iso: string): string => {
  const d = new Date(iso)
  const day = fmtDay(dayKeyPrague(iso))
  const hm = d.toLocaleTimeString('cs-CZ', {
    timeZone: 'Europe/Prague',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${day} ${hm}`
}

const Card = ({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint?: string
  accent?: string
}) => (
  <div className={'bg-white rounded-lg shadow-sm px-4 py-3 min-w-[150px]'}>
    <div className={'text-xs text-ink-faint'}>{label}</div>
    <div className={`text-2xl font-bold ${accent || 'text-ink'}`}>{value}</div>
    {hint && <div className={'text-xs text-ink-faint mt-1'}>{hint}</div>}
  </div>
)

const DayBars = ({ days }: { days: ComebackDay[] }) => {
  const max = days.reduce((m, d) => Math.max(m, d.sent), 0) || 1
  return (
    <div className={'bg-white rounded-xl shadow-md p-4 flex flex-col gap-2'}>
      {days.map((d) => (
        <div key={d.day} className={'flex items-center gap-3'}>
          <span className={'text-xs text-ink-soft w-20 shrink-0'}>{fmtDay(d.day)}</span>
          <div className={'flex-1 bg-line-soft rounded h-5 overflow-hidden'}>
            <div
              // прозрачность у токена палитры работает (в отличие от старого primary, s103/s166)
              className={'h-full bg-brand/80 rounded'}
              style={{ width: `${Math.round((d.sent / max) * 100)}%` }}
            />
          </div>
          <span className={'text-xs font-semibold text-ink w-8 text-right'}>{d.sent}</span>
          <span className={'text-xs text-pos w-20 text-right'}>
            {d.converted ? `+${d.converted} зап.` : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

const SendsTable = ({
  rows,
  busyId,
  onOptOut,
}: {
  rows: ComebackRow[]
  busyId: string | null
  onOptOut: (c: { documentId: string; name: string }) => void
}) => (
  <TableWrapper additionalInfo={`Показано ${rows.length} писем`}>
    <table className={'w-full text-left min-w-[620px]'}>
      <thead>
        <tr>
          <Cell title={'Письмо'} asHeader />
          <Cell title={'Клиент'} asHeader />
          <Cell title={'E-mail'} asHeader />
          <Cell title={'Последний визит'} asHeader />
          <Cell title={'Услуга'} asHeader />
          <Cell title={'Результат'} asHeader />
          <Cell title={''} asHeader />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.documentId} className={'hover:bg-surface-hover'}>
            <Cell title={fmtDayTime(r.sentAt)} />
            <Cell title={r.clientName || '—'} />
            <Cell title={r.email || '—'} className={'text-ink-muted'} />
            <Cell title={fmtDay(r.lastVisitDate)} />
            <Cell title={r.serviceTitle || '—'} className={'text-ink-muted'} />
            <td className={'p-4 border-b border-line-soft'}>
              {r.bookedDate ? (
                <span className={'text-sm font-semibold text-pos'}>
                  ✓ записалась на {fmtDay(r.bookedDate)}
                </span>
              ) : (
                <span className={'text-sm text-ink-faint'}>—</span>
              )}
            </td>
            <td className={'p-4 border-b border-line-soft'}>
              {r.optedOut ? (
                <span className={'text-xs font-semibold text-warn'}>отписана</span>
              ) : (
                <button
                  type={'button'}
                  disabled={busyId === r.clientDocId}
                  onClick={() => onOptOut({ documentId: r.clientDocId, name: r.clientName || '' })}
                  className={
                    'text-xs px-2 py-1 rounded border border-line-btn text-ink-muted hover:bg-line-soft disabled:opacity-50'
                  }
                >
                  {busyId === r.clientDocId ? '…' : 'Отписать'}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </TableWrapper>
)

const OptOutTable = ({
  list,
  busyId,
  onReturn,
}: {
  list: ClientBrief[]
  busyId: string | null
  onReturn: (c: ClientBrief) => void
}) => (
  <TableWrapper additionalInfo={`Отписано: ${list.length}`}>
    <table className={'w-full text-left min-w-[620px]'}>
      <thead>
        <tr>
          <Cell title={'Клиент'} asHeader />
          <Cell title={'E-mail'} asHeader />
          <Cell title={'Телефон'} asHeader />
          <Cell title={''} asHeader />
        </tr>
      </thead>
      <tbody>
        {list.map((c) => (
          <tr key={c.documentId} className={'hover:bg-surface-hover'}>
            <Cell title={c.name} />
            <Cell title={c.email || '—'} className={'text-ink-muted'} />
            <Cell title={c.phone || '—'} className={'text-ink-muted'} />
            <td className={'p-4 border-b border-line-soft'}>
              <button
                type={'button'}
                disabled={busyId === c.documentId}
                onClick={() => onReturn(c)}
                className={
                  'text-xs px-2 py-1 rounded border border-line-btn text-ink-muted hover:bg-line-soft disabled:opacity-50'
                }
              >
                {busyId === c.documentId ? '…' : 'Вернуть рассылку'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </TableWrapper>
)

export default function ComebackTab() {
  const [data, setData] = useState<ComebackReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const [optQuery, setOptQuery] = useState('')
  const [candidates, setCandidates] = useState<ClientBrief[] | null>(null)
  const [searching, setSearching] = useState(false)

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      setData(await getComebackReport(force))
    } catch {
      setError('Не удалось загрузить лог напоминаний (проверь права токена на comeback-reminder-log)')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    if (!q) return data.rows
    return data.rows.filter(
      (r) =>
        (r.clientName || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.serviceTitle || '').toLowerCase().includes(q),
    )
  }, [data, search])

  const applyOptOut = async (clientDocId: string, name: string, optOut: boolean) => {
    const question = optOut
      ? `Отписать ${name || 'клиента'} от напоминаний? Письма «Čas na další návštěvu» ей больше не уйдут.`
      : `Вернуть ${name || 'клиента'} в рассылку напоминаний?`
    if (!globalThis.confirm(question)) return
    setBusyId(clientDocId)
    setFlash(null)
    try {
      await setReminderOptOut(clientDocId, optOut)
      setCandidates(null)
      setOptQuery('')
      setFlash(optOut ? `✓ ${name || 'Клиент'} отписан(а)` : `✓ ${name || 'Клиент'} снова в рассылке`)
      await load(true)
    } catch {
      setFlash('Не удалось сохранить — проверь права токена на изменение клиента')
    } finally {
      setBusyId(null)
    }
  }

  const runSearch = async () => {
    setSearching(true)
    setFlash(null)
    try {
      setCandidates(await searchClientsForOptOut(optQuery))
    } catch {
      setFlash('Поиск не удался')
    } finally {
      setSearching(false)
    }
  }

  if (loading && !data) return <div className={'text-ink-soft py-8 text-center'}>Načítání…</div>
  if (error && !data) return <div className={'text-neg py-8 text-center'}>{error}</div>
  if (!data) return null

  const t = data.totals

  return (
    <>
      <div className={'flex items-center justify-between flex-wrap gap-3 mb-4'}>
        <p className={'text-sm text-ink-soft max-w-3xl'}>
          Автоматическое письмо «Čas na další návštěvu» уходит клиенту через ~25 дней после
          последнего визита (крон в 11:00). Одно письмо на визит, кулдаун 20 дней, дневной лимит.
          Клиент, ответивший «NEZASÍLAT», добавляется сюда в отписки — сервер проверяет этот флаг
          перед каждой отправкой.
        </p>
        <button
          type={'button'}
          onClick={() => load(true)}
          disabled={loading}
          className={
            'px-3 py-2 rounded-lg text-sm font-semibold border border-line-btn bg-white shadow-sm hover:bg-surface-hover disabled:opacity-50'
          }
        >
          {loading ? 'Обновление…' : '↻ Обновить'}
        </button>
      </div>

      {flash && (
        <div className={'mb-4 p-3 rounded-lg bg-pos-bg text-pos text-sm'}>{flash}</div>
      )}

      <div className={'flex gap-4 flex-wrap mb-6'}>
        <Card label={'Писем всего'} value={String(t.sent)} hint={`клиентов: ${t.clients}`} />
        <Card label={'За 7 дней'} value={String(t.last7)} />
        <Card
          label={'Записались после письма'}
          value={String(t.converted)}
          hint={`${t.convRate}% получателей`}
          accent={'text-pos'}
        />
        <Card label={'Отписок (NEZASÍLAT)'} value={String(t.optOut)} accent={'text-warn'} />
      </div>

      <StatSection title={'Отправки по дням'} id={'comeback-days'}>
        {data.byDay.length ? (
          <DayBars days={[...data.byDay].reverse()} />
        ) : (
          <p className={'text-sm text-ink-faint'}>Пока ни одного письма</p>
        )}
      </StatSection>

      <StatSection title={'Кому уходили письма'} id={'comeback-sends'}>
        <div className={'mb-3'}>
          <input
            type={'text'}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setLimit(PAGE)
            }}
            placeholder={'Поиск: имя, e-mail, услуга'}
            className={'w-full md:w-80 px-3 py-2 border border-line-btn rounded-lg text-sm'}
          />
        </div>
        <SendsTable
          rows={filtered.slice(0, limit)}
          busyId={busyId}
          onOptOut={(c) => applyOptOut(c.documentId, c.name, true)}
        />
        {filtered.length > limit && (
          <button
            type={'button'}
            onClick={() => setLimit(limit + PAGE)}
            className={
              'mt-3 px-3 py-2 rounded-lg text-sm font-semibold border border-line-btn bg-white shadow-sm hover:bg-surface-hover'
            }
          >
            Показать ещё ({filtered.length - limit})
          </button>
        )}
        <p className={'mt-3 text-xs text-ink-faint'}>
          «Записалась» = у клиента появилась активная бронь, созданная после письма. Атрибуция
          приблизительная — считается любая новая бронь, независимо от канала.
        </p>
      </StatSection>

      <StatSection title={'Отписки от напоминаний (NEZASÍLAT)'} id={'comeback-optout'}>
        <div className={'bg-white rounded-xl shadow-md p-4 mb-4'}>
          <p className={'text-sm text-ink-muted mb-2'}>
            Пришёл ответ «NEZASÍLAT» — найди клиента по e-mail (или имени) и отпиши.
          </p>
          <div className={'flex gap-2 flex-wrap'}>
            <input
              type={'text'}
              value={optQuery}
              onChange={(e) => setOptQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && optQuery.trim().length >= 3) runSearch()
              }}
              placeholder={'napr. helena.hrabalova2006@seznam.cz'}
              className={'flex-1 min-w-[260px] px-3 py-2 border border-line-btn rounded-lg text-sm'}
            />
            <button
              type={'button'}
              onClick={runSearch}
              disabled={searching || optQuery.trim().length < 3}
              className={
                'px-4 py-2 rounded-lg text-sm font-semibold bg-brand text-white shadow-sm disabled:opacity-50'
              }
            >
              {searching ? 'Поиск…' : 'Найти'}
            </button>
          </div>

          {candidates && candidates.length === 0 && (
            <p className={'mt-3 text-sm text-neg'}>
              Клиент с таким e-mail не найден. Проверь написание — адрес должен совпадать с тем, что
              записан в карточке клиента.
            </p>
          )}

          {candidates && candidates.length > 0 && (
            <div className={'mt-3 flex flex-col gap-2'}>
              {candidates.map((c) => (
                <div
                  key={c.documentId}
                  className={'flex items-center justify-between gap-3 p-2 rounded border border-line'}
                >
                  <div className={'text-sm'}>
                    <span className={'font-semibold text-ink'}>{c.name}</span>
                    <span className={'text-ink-soft'}> · {c.email || 'без e-mail'}</span>
                  </div>
                  {c.reminderOptOut ? (
                    <span className={'text-xs font-semibold text-warn'}>уже отписан(а)</span>
                  ) : (
                    <button
                      type={'button'}
                      disabled={busyId === c.documentId}
                      onClick={() => applyOptOut(c.documentId, c.name, true)}
                      className={
                        'text-xs px-3 py-1.5 rounded border border-amber-400 text-warn hover:bg-warn-bg disabled:opacity-50'
                      }
                    >
                      {busyId === c.documentId ? '…' : 'Отписать'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {data.optOuts.length ? (
          <OptOutTable
            list={data.optOuts}
            busyId={busyId}
            onReturn={(c) => applyOptOut(c.documentId, c.name, false)}
          />
        ) : (
          <p className={'text-sm text-ink-faint'}>Отписок пока нет</p>
        )}
      </StatSection>
    </>
  )
}
