// Модуль «Дозаписи администраторов» (/upsell, owner + administrator), s197; редизайн s198.
//
// Администратор видит клиентов дня — кто сейчас в салоне и кто придёт позже — и
// варианты дозаписи услуги другой категории «сразу после» или «сразу перед» их
// визитом. Клиенту −10 %, администратору 5 % от полной цены: комиссия создаётся
// черновиком «Доп. заработка», владелец подтверждает её на закрытии смены.
// Пуш мастеру и Telegram салону шлёт сервер; письма клиенту нет — он рядом.
import { useCallback, useEffect, useState } from 'react'

import { errMsg } from '../../lib/errMsg'
import { getSessionRole } from '../../services/auth'
import { btnNeutralCls, cardCls, countBadgeCls, h1Cls, headMicroCls, hintCls, iconBtnCls, mutedCls, pageShellCls } from '../../ui/kit'
import { WEEKDAYS_CS, addDaysYmd, dowOfYmd, fmtCsDate, todayYmd } from '../../utils/date'
import { kc } from '../../utils/money'
import { ClientCard } from './components/ClientCard'
import { ChevronDown, ChevronLeft, ChevronRight, RefreshIcon } from './components/icons'
import { MineSection } from './components/MineSection'
import {
  createUpsell,
  fetchUpsellDay,
  fetchUpsellMine,
  type UpsellClient,
  type UpsellDay,
  type UpsellMine,
  type UpsellOffer,
  type UpsellService,
} from './fetch/upsellApi'
import { MINE_SECTION_ID, confirmText, upsellCountLabel } from './labels'

const sepCls = 'text-ink-disabled'
const stripLabelCls = `${headMicroCls} text-ink-muted`

export default function UpsellPage() {
  const isOwner = getSessionRole() === 'owner'
  const today = todayYmd()

  const [date, setDate] = useState(today)
  const [day, setDay] = useState<UpsellDay | null>(null)
  const [dayLoading, setDayLoading] = useState(true)
  const [dayError, setDayError] = useState<string | null>(null)

  const [month, setMonth] = useState(today.slice(0, 7))
  const [mine, setMine] = useState<UpsellMine | null>(null)
  const [mineLoading, setMineLoading] = useState(true)
  const [mineError, setMineError] = useState<string | null>(null)

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

  useEffect(() => {
    loadDay(date)
  }, [date, loadDay])

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
      await Promise.all([loadDay(date), loadMine(month)])
    } catch (e) {
      setNotice({ ok: false, text: errMsg(e, 'Не удалось создать дозапись') })
      await loadDay(date)
    } finally {
      setBusyKey(null)
    }
  }

  const clients = day?.clients || []
  const isToday = date === today
  const inSalon = clients.filter((c) => c.inSalon)
  const later = clients.filter((c) => !c.inSalon)

  const renderGroup = (title: string, list: UpsellClient[], key: string, dot: string) =>
    list.length > 0 && (
      <section data-group={key} data-count={list.length} className="mb-4">
        <div className="flex items-center gap-2 mb-2.5">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-ink-muted">{title}</span>
          <span className={countBadgeCls}>{list.length}</span>
        </div>
        {list.map((c) => (
          <ClientCard key={c.clientDocId} client={c} busyKey={busyKey} onBook={book} />
        ))}
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

      {dayError && <div className={`${hintCls} text-neg mb-3`}>{dayError}</div>}
      {dayLoading && !day && <div className={mutedCls}>Загрузка…</div>}
      {day?.past && <div className={`${hintCls} mb-3`}>День прошёл — дозаписывать некуда.</div>}
      {day && !day.past && clients.length === 0 && (
        <div className={`${hintCls} mb-3`}>{isToday ? 'Сегодня больше клиентов не ждём.' : 'В этот день клиентов нет.'}</div>
      )}

      {isToday ? (
        <>
          {renderGroup('Сейчас в салоне', inSalon, 'in-salon', 'bg-pos')}
          {renderGroup('Позже сегодня', later, 'later', 'bg-warn')}
        </>
      ) : (
        renderGroup('Клиенты дня', clients, 'day', 'bg-ink-muted')
      )}

      <MineSection month={month} onMonth={setMonth} data={mine} loading={mineLoading} error={mineError} isOwner={isOwner} />
    </div>
  )
}
