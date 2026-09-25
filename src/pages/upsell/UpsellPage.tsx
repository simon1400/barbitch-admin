// Модуль «Дозаписи администраторов» (/upsell, owner + administrator), s197; редизайн s198.
//
// Администратор видит клиентов дня — кто сейчас в салоне и кто придёт позже — и
// варианты дозаписи услуги другой категории «сразу после» или «сразу перед» их
// визитом. Клиенту −10 %, администратору 5 % от полной цены: комиссия создаётся
// черновиком «Доп. заработка», владелец подтверждает её на закрытии смены.
// Пуш мастеру и Telegram салону шлёт сервер; письма клиенту нет — он рядом.
//
// s199: по каждому клиенту, который сегодня уже пришёл, администратор закрывает
// результат — дозаписан / отказ / не предлагали (+ причина). Ушедшие без отметки
// остаются в группе «Уже ушли». Владелец видит «Контроль предложений» за месяц.
import { Fragment, useCallback, useEffect, useState } from 'react'

import { errMsg } from '../../lib/errMsg'
import { getSessionRole } from '../../services/auth'
import { isManagement } from '../../types/admin'
import {
  btnNeutralCls,
  cardCls,
  countBadgeCls,
  h1Cls,
  headMicroCls,
  hintCls,
  iconBtnCls,
  mutedCls,
  pageShellCls,
  pillCls,
} from '../../ui/kit'
import { WEEKDAYS_CS, addDaysYmd, dowOfYmd, fmtCsDate, todayYmd } from '../../utils/date'
import { kc } from '../../utils/money'
import { ClientCard } from './components/ClientCard'
import { ChevronDown, ChevronLeft, ChevronRight, RefreshIcon } from './components/icons'
import { MineSection } from './components/MineSection'
import { ReportSection } from './components/ReportSection'
import {
  createUpsell,
  fetchUpsellDay,
  fetchUpsellMine,
  fetchUpsellReport,
  saveUpsellResult,
  type UpsellClient,
  type UpsellDay,
  type UpsellManualOutcome,
  type UpsellMine,
  type UpsellOffer,
  type UpsellReport,
  type UpsellService,
} from './fetch/upsellApi'
import { MINE_SECTION_ID, confirmText, plural, upsellCountLabel } from './labels'

const sepCls = 'text-ink-disabled'
const stripLabelCls = `${headMicroCls} text-ink-muted`
const tabCountCls = 'text-[11px] font-bold rounded-full px-1.5 py-px leading-[16px] min-w-[20px] text-center'

/** Вкладки клиентов дня (только сегодня). */
type DayTab = 'in-salon' | 'later' | 'left'

export default function UpsellPage() {
  // руководство (владелец + управляющая, s213) видит всех администраторов и отчёт
  const isOwner = isManagement(getSessionRole())
  const today = todayYmd()

  const [date, setDate] = useState(today)
  const [tab, setTab] = useState<DayTab>('in-salon')
  const [day, setDay] = useState<UpsellDay | null>(null)
  const [dayLoading, setDayLoading] = useState(true)
  const [dayError, setDayError] = useState<string | null>(null)

  const [month, setMonth] = useState(today.slice(0, 7))
  const [mine, setMine] = useState<UpsellMine | null>(null)
  const [mineLoading, setMineLoading] = useState(true)
  const [mineError, setMineError] = useState<string | null>(null)

  const [report, setReport] = useState<UpsellReport | null>(null)
  const [reportLoading, setReportLoading] = useState(isOwner)
  const [reportError, setReportError] = useState<string | null>(null)

  const [savingClient, setSavingClient] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const loadDay = useCallback(async (d: string) => {
    setDayLoading(true)
    setDayError(null)
    try {
      setDay(await fetchUpsellDay(d))
    } catch (e) {
      setDay(null)
      setDayError(errMsg(e, 'Не удалось загрузить день'))
    } finally {
      setDayLoading(false)
    }
  }, [])

  const loadMine = useCallback(async (m: string) => {
    setMineLoading(true)
    setMineError(null)
    try {
      setMine(await fetchUpsellMine(m))
    } catch (e) {
      setMine(null)
      setMineError(errMsg(e, 'Не удалось загрузить дозаписи'))
    } finally {
      setMineLoading(false)
    }
  }, [])

  const loadReport = useCallback(async (m: string) => {
    setReportLoading(true)
    setReportError(null)
    try {
      setReport(await fetchUpsellReport(m))
    } catch (e) {
      setReport(null)
      setReportError(errMsg(e, 'Не удалось загрузить отчёт'))
    } finally {
      setReportLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDay(date)
  }, [date, loadDay])

  useEffect(() => {
    if (isOwner) loadReport(month)
  }, [isOwner, month, loadReport])

  useEffect(() => {
    loadMine(month)
  }, [month, loadMine])

  const book = async (client: UpsellClient, offer: UpsellOffer, svc: UpsellService) => {
    if (busyKey) return
    if (!window.confirm(confirmText(client.clientName, offer, svc))) return
    setBusyKey(`${client.clientDocId}:${offer.employeeDocId}:${svc.serviceDocId}`)
    setNotice(null)
    try {
      const res = await createUpsell({
        anchorBooking: offer.anchorBookingDocId,
        service: svc.serviceDocId,
        employee: offer.employeeDocId,
        mode: offer.mode,
      })
      const extra =
        res.commissionReason === 'no_personal' ? ' Bez karty administrátora — provize se nevytvořila.' : ''
      setNotice({
        ok: true,
        text: `Дозапись создана: ${res.clientName} · ${res.serviceTitle} · ${res.employee.name} · ${res.time}–${res.endTime}.${extra}`,
      })
      await Promise.all([loadDay(date), loadMine(month), isOwner ? loadReport(month) : null])
    } catch (e) {
      setNotice({ ok: false, text: errMsg(e, 'Не удалось создать дозапись') })
      await loadDay(date)
    } finally {
      setBusyKey(null)
    }
  }

  // результат по клиенту: сервер проверяет «уже пришёл» и пишет одну запись на клиента в день
  const saveResult = async (client: UpsellClient, outcome: UpsellManualOutcome, reason: string, comment: string) => {
    if (savingClient) return false
    setSavingClient(client.clientDocId)
    setNotice(null)
    try {
      const res = await saveUpsellResult({ client: client.clientDocId, outcome, reason, comment })
      const patch = (list: UpsellClient[]) =>
        list.map((c) => (c.clientDocId === res.clientDocId ? { ...c, result: res.result, needsResult: false } : c))
      setDay((d) => (d ? { ...d, clients: patch(d.clients), leftClients: patch(d.leftClients || []) } : d))
      if (isOwner) loadReport(month)
      return true
    } catch (e) {
      setNotice({ ok: false, text: errMsg(e, 'Не удалось сохранить результат') })
      await loadDay(date)
      return false
    } finally {
      setSavingClient(null)
    }
  }

  const clients = day?.clients || []
  const leftClients = day?.leftClients || []
  const pendingCount = [...clients, ...leftClients].filter((c) => c.needsResult).length
  const isToday = date === today
  const inSalon = clients.filter((c) => c.inSalon)
  const later = clients.filter((c) => !c.inSalon)

  // s206: сегодня клиенты разложены по вкладкам — в одном длинном списке администраторы терялись.
  // Вкладки показываются все три (место каждой предсказуемо), пустая — выключена. Активной остаётся
  // выбранная, пока в ней кто-то есть; опустела (клиент ушёл после «Обновить») — берём первую непустую.
  const groups: { key: DayTab; title: string; list: UpsellClient[]; dot: string }[] = [
    { key: 'in-salon', title: 'Сейчас в салоне', list: inSalon, dot: 'bg-pos' },
    { key: 'later', title: 'Позже сегодня', list: later, dot: 'bg-warn' },
    { key: 'left', title: 'Уже ушли', list: leftClients, dot: 'bg-ink-muted' },
  ]
  const activeTab = (groups.find((g) => g.key === tab && g.list.length > 0) || groups.find((g) => g.list.length > 0))?.key ?? null

  const renderCards = (list: UpsellClient[]) =>
    list.map((c) => (
      <ClientCard
        key={c.clientDocId}
        client={c}
        busyKey={busyKey}
        onBook={book}
        savingResult={savingClient === c.clientDocId}
        onSaveResult={saveResult}
      />
    ))

  const renderTabs = () => (
    <div role="tablist" aria-label="Клиенты дня" className="flex items-center gap-2 flex-wrap mb-4" data-tabs>
      {groups.map((g) => {
        const on = g.key === activeTab
        const pending = g.list.filter((c) => c.needsResult).length
        return (
          <button
            key={g.key}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={g.list.length === 0}
            data-tab={g.key}
            data-count={g.list.length}
            data-pending={pending > 0 ? pending : undefined}
            className={`${pillCls(on)} inline-flex items-center gap-2 !px-3.5 !py-2 !text-[12.5px] disabled:opacity-40 disabled:cursor-not-allowed`}
            onClick={() => setTab(g.key)}
            title={pending > 0 ? `Не отмечен результат: ${pending}` : undefined}
          >
            <span className={`w-2 h-2 rounded-full ${g.dot}`} />
            {g.title}
            <span className={`${tabCountCls} ${on ? 'bg-white/25 text-white' : 'bg-white text-ink'}`}>{g.list.length}</span>
            {pending > 0 && <span className={`${tabCountCls} bg-warn-bg text-warn !px-2`}>не отмечено: {pending}</span>}
          </button>
        )
      })}
    </div>
  )

  const renderPanel = (g: { key: string; list: UpsellClient[] }) => (
    <section role="tabpanel" data-group={g.key} data-count={g.list.length} className="mb-4">
      {renderCards(g.list)}
    </section>
  )

  // не сегодня — одна группа без вкладок, как раньше
  const renderDayGroup = () =>
    clients.length > 0 && (
      <section data-group="day" data-count={clients.length} className="mb-4">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="w-2 h-2 rounded-full bg-ink-muted" />
          <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-ink-muted">Клиенты дня</span>
          <span className={countBadgeCls}>{clients.length}</span>
        </div>
        {renderCards(clients)}
      </section>
    )

  return (
    <div className={pageShellCls}>
      {/* Голова: заголовок + правило одной строкой слева, навигация по дню справа */}
      <div className="flex items-end justify-between gap-6 flex-wrap mb-4">
        <div className="flex flex-col gap-1.5">
          <h1 className={`${h1Cls} !mb-0`}>Дозаписи</h1>
          <div className="text-[12.5px] font-semibold text-ink-muted flex items-center gap-2 flex-wrap">
            <span>
              Клиенту <b className="text-ink">−{day?.discountPercent ?? 10} %</b>
            </span>
            <span className={sepCls}>·</span>
            <span>
              вам <b className="text-pos">+{day?.commissionPercent ?? 5} %</b> от полной цены
            </span>
            <span className={sepCls}>·</span>
            <span>подтверждается при закрытии смены</span>
            <span className={sepCls}>·</span>
            <span>отмена или неявка снимает комиссию</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" className={iconBtnCls} onClick={() => setDate(addDaysYmd(date, -1))} aria-label="Предыдущий день">
            <ChevronLeft />
          </button>
          <div className="h-[34px] px-3.5 rounded-lg border border-line-btn bg-white inline-flex items-center gap-2" data-date={date}>
            <span className={`${headMicroCls} text-ink-muted`}>{WEEKDAYS_CS[dowOfYmd(date)]}</span>
            <span className="text-[14px] font-extrabold text-ink">{fmtCsDate(date)}</span>
            {isToday ? (
              <span className={countBadgeCls}>сегодня</span>
            ) : (
              <button type="button" className={`${countBadgeCls} border-0 cursor-pointer hover:bg-brand-wash`} onClick={() => setDate(today)}>
                Сегодня
              </button>
            )}
          </div>
          <button type="button" className={iconBtnCls} onClick={() => setDate(addDaysYmd(date, 1))} aria-label="Следующий день">
            <ChevronRight />
          </button>
          <span className="w-px h-[22px] bg-line-btn mx-1" />
          {day?.now && (
            <span className={mutedCls}>
              сейчас <b className="text-ink">{day.now}</b>
            </span>
          )}
          <button type="button" className={`${btnNeutralCls} !px-3 inline-flex items-center gap-1.5`} disabled={dayLoading} onClick={() => loadDay(date)}>
            <RefreshIcon />
            Обновить
          </button>
        </div>
      </div>

      {/* Полоса месяца: мои дозаписи одним взглядом, подробности — внизу */}
      <div className={`${cardCls} px-5 py-3 mb-6 flex items-center justify-between gap-4 flex-wrap`} data-strip>
        <span className={stripLabelCls}>{isOwner ? 'Дозаписи администраторов' : 'Мои дозаписи'}</span>
        <div className="flex items-center gap-7 flex-wrap">
          <span className="flex items-baseline gap-2">
            <span className={stripLabelCls}>Ожидается</span>
            <span className="text-[18px] font-extrabold text-ink">{mine ? kc(mine.expectedKc) : '—'}</span>
            {mine && mine.rows.length > 0 && <span className="text-[12px] font-semibold text-ink-muted">· {upsellCountLabel(mine.rows.length)}</span>}
          </span>
          <span className="flex items-baseline gap-2">
            <span className={`${headMicroCls} text-brand-dark`}>Подтверждено</span>
            <span className="text-[18px] font-extrabold text-brand-dark">{mine ? kc(mine.confirmedKc) : '—'}</span>
          </span>
          <a href={`#${MINE_SECTION_ID}`} className="text-[12.5px] font-bold text-brand-dark inline-flex items-center gap-1">
            Список
            <ChevronDown />
          </a>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`${cardCls} px-5 py-3 mb-4 text-[13px] font-bold ${
            notice.ok ? '!bg-pos-bg !border-pos-line text-pos' : '!bg-neg-bg !border-neg-line text-neg'
          }`}
          data-notice={notice.ok ? 'ok' : 'error'}
        >
          {notice.text}
        </div>
      )}

      {isToday && pendingCount > 0 && (
        <div className={`${cardCls} px-5 py-3 mb-4 !bg-warn-bg !border-warn-line text-[13px] font-bold text-warn`} data-pending-total={pendingCount}>
          Не отмечен результат у {pendingCount} {plural(pendingCount, ['клиента', 'клиентов', 'клиентов'])} — подойдите, предложите дозапись и
          отметьте, чем закончилось.
        </div>
      )}

      {dayError && <div className={`${hintCls} text-neg mb-3`}>{dayError}</div>}
      {dayLoading && !day && <div className={mutedCls}>Загрузка…</div>}
      {day?.past && <div className={`${hintCls} mb-3`}>День прошёл — дозаписывать некуда.</div>}
      {day && !day.past && clients.length === 0 && leftClients.length === 0 && (
        <div className={`${hintCls} mb-3`}>{isToday ? 'Сегодня больше клиентов не ждём.' : 'В этот день клиентов нет.'}</div>
      )}

      {isToday ? (
        <>
          {activeTab && renderTabs()}
          {groups.filter((g) => g.key === activeTab).map((g) => (
            <Fragment key={g.key}>{renderPanel(g)}</Fragment>
          ))}
        </>
      ) : (
        renderDayGroup()
      )}

      <MineSection month={month} onMonth={setMonth} data={mine} loading={mineLoading} error={mineError} isOwner={isOwner} />

      {isOwner && <ReportSection key={month} month={month} data={report} loading={reportLoading} error={reportError} />}
    </div>
  )
}
