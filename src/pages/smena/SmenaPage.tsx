// «Směna» (s263, Фаза 1 плана ADMIN_SHIFT_NEXT_SESSION_PROMPT.md): один экран конца смены вместо
// панели Strapi. Вкладка «Směna» — Pokladna (поток денег + пересчёт кассы), Moje hodiny (свои
// часы), Úkoly dnes (задачи s262 теми же карточками) и статус дня; вкладка «Úkoly» — полный
// список задач администраторки (бывшая страница `/ukoly`, s262). Обе смонтированы, скрытая —
// `hidden` (черновик формы не теряется, паттерн s253).
// Адрес: `?date=` (окно записи — сегодня и 2 дня назад), `?tab=ukoly`, `?task=<id>` (push s262 —
// вкладка задач с раскрытой задачей). Руководство: касса и часы администраторек дня (только
// чтение чужих часов), без вкладки задач — свои задачи у него в «Команде»/«Výkaz».
// s265 (Фаза 2, «Předání směny»): вверху — «Vzkaz z minulé směny» (сегодня, мне), внизу — «Předání
// směny» (сообщение коллеге + задачи ей + передача своих); статус «Předáno → …».
// s266 (Фаза 3): «Kontrola směny» под кассой и часами (порт виджета панели Strapi, перечитывается
// после сохранения); руководство листает любой прошедший день и пишет/правит часы каждой
// администраторки (карточка на человека), у старого сервера — прежний список только для чтения.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { RefreshButton } from '../../components/RefreshButton'
import { badgeMutedCls, badgeNegCls, badgePosCls, badgeWarnCls, btnNeutralCls, cardPadCls, cardTitleCls, hintCls, iconBtnCls, kickerCls, mutedCls, pageShellCls, pillCls } from '../../ui/kit'
import { getSessionRole } from '../../services/auth'
import { WEEKDAYS_CS, addDaysYmd, dowOfYmd, fmtCsDate, todayYmd } from '../../utils/date'
import { NotificationButton } from '../calendar/NotificationButton'
import { Notice } from '../vykaz/components/ReportParts'
import { UkolyList } from '../ukoly/UkolyList'
import { HandoverCard } from './components/HandoverCard'
import { HandoverInbox } from './components/HandoverInbox'
import { HoursCard } from './components/HoursCard'
import { KontrolaCard } from './components/KontrolaCard'
import { PokladnaCard } from './components/PokladnaCard'
import { TodayTasks } from './components/TodayTasks'
import { fetchSmenaDay, fmtHours, type Handover, type SmenaDay, type WorkTimeDay } from './fetch/smena'

type Tab = 'smena' | 'ukoly'
const TASKS_TAB = 'ukoly'
const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Параметры перехода (push, кабинет): день (не будущий), вкладка, задача. */
const readBoot = (search: string) => {
  const p = new URLSearchParams(search)
  const d = p.get('date') || ''
  const t = p.get('task') || ''
  const task = /^[a-z0-9]{10,40}$/.test(t) ? t : null
  return {
    date: YMD.test(d) && d <= todayYmd() ? d : null,
    task,
    tab: (task || p.get('tab') === TASKS_TAB ? 'ukoly' : 'smena') as Tab,
  }
}

const searchOf = (date: string, tab: Tab) => {
  const p = new URLSearchParams()
  if (date !== todayYmd()) p.set('date', date)
  if (tab === 'ukoly') p.set('tab', TASKS_TAB)
  const s = p.toString()
  return s ? `?${s}` : ''
}

const dayTitle = (date: string) => `${WEEKDAYS_CS[dowOfYmd(date)]} ${fmtCsDate(date)}`

/** s266: чьи часы показывать руководству — работающие администраторки + все, у кого есть запись дня. */
const teamOf = (d: SmenaDay): { person: { documentId: string; name: string }; workTime: WorkTimeDay | null }[] => {
  const people = new Map<string, { documentId: string; name: string }>()
  for (const c of d.colleagues ?? []) people.set(c.documentId, c)
  for (const w of d.others) if (w.personal && !people.has(w.personal)) people.set(w.personal, { documentId: w.personal, name: w.name })
  return [...people.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
    .map((person) => ({ person, workTime: d.others.find((w) => w.personal === person.documentId) ?? null }))
}

export default function SmenaPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const boot = useRef<ReturnType<typeof readBoot> | null>(null)
  if (boot.current === null) boot.current = readBoot(location.search)
  const [date, setDate] = useState(() => boot.current?.date ?? todayYmd())
  const [tab, setTabState] = useState<Tab>(() => boot.current?.tab ?? 'smena')
  const [data, setData] = useState<SmenaDay | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [activeTasks, setActiveTasks] = useState<number | null>(null)
  // действие с задачей в одной вкладке → перечитать другую
  const [tasksKey, setTasksKey] = useState(0)
  const [todayKey, setTodayKey] = useState(0)
  // s266: «Kontrola směny» перечитывается после сохранения кассы/часов и по кнопке обновления
  const [checkKey, setCheckKey] = useState(0)
  const seq = useRef(0)

  const load = useCallback(async (d: string) => {
    const my = ++seq.current
    setLoading(true)
    try {
      const res = await fetchSmenaDay(d)
      if (my !== seq.current) return
      setData(res)
      setUpdatedAt(Date.now())
      setError(null)
    } catch (e) {
      if (my === seq.current) {
        setError((e as Error).message)
        setData(null)
      }
    } finally {
      if (my === seq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(date)
  }, [load, date])

  // задача из push — в адресе не держим (повторное открытие страницы не должно прыгать к ней)
  useEffect(() => {
    const keep = searchOf(date, tab)
    if (location.search !== keep) navigate(`${location.pathname}${keep}`, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const go = (d: string, t: Tab) => navigate(`${location.pathname}${searchOf(d, t)}`, { replace: true })
  const setTab = (t: Tab) => {
    setTabState(t)
    go(date, t)
  }
  const pickDate = (d: string) => {
    setDate(d)
    go(d, tab)
  }
  const saved = (d: SmenaDay) => {
    setData(d)
    setUpdatedAt(Date.now())
    setCheckKey((k) => k + 1)
  }
  // s265: «Přečteno» — заменить сообщение в ответе дня
  const readDone = (h: Handover) => setData((d) => (d ? { ...d, handoverIn: (d.handoverIn ?? []).map((x) => (x.documentId === h.documentId ? h : x)) } : d))
  // передача смены поменяла задачи — перечитать обе вкладки
  const handedOver = (d: SmenaDay) => {
    saved(d)
    setTodayKey((k) => k + 1)
    setTasksKey((k) => k + 1)
  }

  // роль — из сессии, не из ответа: сбой ручки смены не должен прятать вкладку задач
  const isAdmin = getSessionRole() === 'administrator'
  const today = data?.today ?? todayYmd()
  const minDate = data && isAdmin ? data.editableFrom : null
  const canPrev = !minDate || date > minDate
  const canNext = date < today
  const tasksDone = data?.tasksDone.length ?? 0
  const sentTo = [...new Set((data?.handoverOut ?? []).map((h) => h.toName).filter(Boolean))]

  return (
    <div className={pageShellCls} data-testid="smena-page">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={kickerCls}>Barbitch Admin</div>
          <h1 className="m-0 text-[24px] leading-[1.2] font-extrabold text-ink">Směna</h1>
          <div className={`${hintCls} mt-1 ${tab === 'smena' ? '' : 'hidden'}`}>
            Pokladna a hodiny za den — vyplňujte průběžně během směny. Po uzavření směny vedením už změny nejdou.
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* push: nové úkoly, později připomenutí směny (§7 plánu) */}
          <NotificationButton popup="down-end" menuItem className={`${btnNeutralCls} inline-flex items-center !px-3`} />
          <RefreshButton
            onClick={() => {
              void load(date)
              setTodayKey((k) => k + 1)
              setTasksKey((k) => k + 1)
              setCheckKey((k) => k + 1)
            }}
            loading={loading}
            updatedAt={updatedAt}
            lang="cs"
          />
        </div>
      </div>

      {isAdmin && (
        <div className="flex gap-1.5 flex-wrap mb-4" role="tablist" data-testid="smena-tabs">
          <button type="button" role="tab" aria-selected={tab === 'smena'} className={pillCls(tab === 'smena')} onClick={() => setTab('smena')} data-tab="smena">
            Směna
          </button>
          <button type="button" role="tab" aria-selected={tab === 'ukoly'} className={pillCls(tab === 'ukoly')} onClick={() => setTab('ukoly')} data-tab="ukoly">
            Úkoly{activeTasks ? ` · ${activeTasks}` : ''}
          </button>
        </div>
      )}

      {isAdmin && (
        <div className={tab === 'ukoly' ? '' : 'hidden'} data-testid="smena-tab-ukoly">
          <UkolyList focus={boot.current?.task ?? null} reloadKey={tasksKey} onActiveCount={setActiveTasks} onChanged={() => setTodayKey((k) => k + 1)} />
        </div>
      )}

      <div className={tab === 'smena' || !isAdmin ? '' : 'hidden'} data-testid="smena-tab-smena">
        <div className="flex items-center gap-2 mb-3" data-testid="smena-date">
          <button type="button" className={iconBtnCls} aria-label="Předchozí den" disabled={!canPrev} onClick={() => pickDate(addDaysYmd(date, -1))} data-day="prev">
            ‹
          </button>
          <div className="text-[17px] font-extrabold text-ink min-w-[150px] text-center">{dayTitle(date)}</div>
          <button type="button" className={iconBtnCls} aria-label="Další den" disabled={!canNext} onClick={() => pickDate(addDaysYmd(date, 1))} data-day="next">
            ›
          </button>
          {date !== today && (
            <button type="button" className="text-[13px] font-bold text-brand-dark ml-1" onClick={() => pickDate(today)}>
              Dnes
            </button>
          )}
        </div>

        {!data ? (
          <div className="py-12 text-center text-[13px] font-semibold">{loading ? <span className="text-ink-faint">Načítání…</span> : <Notice error={error} />}</div>
        ) : (
          <>
            <div className="flex gap-1.5 flex-wrap mb-3.5" data-testid="smena-status">
              <span className={data.cash ? badgePosCls : badgeNegCls} data-status="cash">
                Pokladna {data.cash ? '✓' : '—'}
              </span>
              {data.canWriteHours && (
                <span className={data.workTime ? badgePosCls : badgeNegCls} data-status="hours">
                  Hodiny {data.workTime ? '✓' : '—'}
                </span>
              )}
              {isAdmin && (
                <span className={badgeMutedCls} data-status="tasks">
                  Úkoly: {tasksDone} hotovo{activeTasks != null ? ` · ${activeTasks} otevřené` : ''}
                </span>
              )}
              {data.check.visitsOpen != null && data.check.visitsOpen > 0 && (
                <Link to={`/calendar?date=${date}`} className={badgeWarnCls} data-status="visits">
                  Návštěvy: {data.check.visitsOpen} neuzavřené →
                </Link>
              )}
              {isAdmin && sentTo.length > 0 && (
                <span className={badgePosCls} data-status="handover">
                  Předáno → {sentTo.join(', ')}
                </span>
              )}
              {(data.cash?.closed || data.workTime?.closed) && <span className={badgeMutedCls}>Směna uzavřena vedením</span>}
              {!data.editable && <span className={badgeMutedCls}>Jen ke čtení — starší den opraví vedení</span>}
            </div>

            {isAdmin && date === today && <HandoverInbox items={data.handoverIn ?? []} onRead={readDone} onOpenTasks={() => setTab('ukoly')} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3.5 items-start">
              <div className="min-w-0">
                <PokladnaCard key={`cash-${data.date}-${data.cash?.updatedAt ?? 'new'}`} day={data} onSaved={saved} onReload={() => void load(date)} />
              </div>
              <div className="min-w-0">
                {data.canWriteHours && (
                  <HoursCard key={`hours-${data.date}-${data.workTime?.updatedAt ?? 'none'}`} day={data} workTime={data.workTime} onSaved={saved} onReload={() => void load(date)} />
                )}
                {/* s266: руководство пишет и правит часы каждой администраторки */}
                {!isAdmin && data.canEditTeamHours && (
                  <div data-testid="smena-team-hours">
                    {teamOf(data).map(({ person, workTime }) => (
                      <HoursCard
                        key={`team-${data.date}-${person.documentId}-${workTime?.updatedAt ?? 'none'}`}
                        day={data}
                        workTime={workTime}
                        person={person}
                        onSaved={saved}
                        onReload={() => void load(date)}
                      />
                    ))}
                    {teamOf(data).length === 0 && <div className={`${cardPadCls} ${hintCls}`}>Žádná administrátorka.</div>}
                  </div>
                )}
                {!isAdmin && !data.canEditTeamHours && (
                  <section className={cardPadCls} data-card="hodiny-tymu" data-testid="smena-others">
                    <h2 className={`${cardTitleCls} mb-2`}>Hodiny administrátorek</h2>
                    {data.others.length === 0 ? (
                      <div className={hintCls}>Za tento den zatím nikdo hodiny nezapsal.</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {data.others.map((w) => (
                          <div key={w.documentId} className="text-[13.5px]">
                            <div className="flex justify-between gap-3">
                              <b className="text-ink">{w.name || '—'}</b>
                              <span className="font-bold text-ink-body whitespace-nowrap">
                                {w.startTime}–{w.endTime} · {fmtHours(w.hours)}
                              </span>
                            </div>
                            {w.comment && <div className={`${mutedCls} whitespace-pre-line break-words`}>{w.comment}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
                {isAdmin && date === today && <TodayTasks reloadKey={todayKey} onChanged={() => setTasksKey((k) => k + 1)} onShowAll={() => setTab('ukoly')} />}
              </div>
            </div>
            {/* s266: порт виджета «Kontrola směny» панели Strapi */}
            <KontrolaCard date={data.date} reloadKey={checkKey} />
            {/* у старого сервера полей передачи нет — карточки нет */}
            {isAdmin && data.colleagues && <HandoverCard key={`handover-${data.date}`} day={data} reloadKey={todayKey} onDone={handedOver} />}
          </>
        )}
      </div>
    </div>
  )
}
