// Модуль «Дозаписи администраторов» (/upsell, owner + administrator), s197.
//
// Администратор видит клиентов дня — кто сейчас в салоне и кто придёт позже — и
// варианты дозаписи услуги другой категории «сразу после» или «сразу перед» их
// визитом. Клиенту −10 %, администратору 5 % от полной цены: комиссия создаётся
// черновиком «Доп. заработка», владелец подтверждает её на закрытии смены.
// Пуш мастеру и Telegram салону шлёт сервер; письма клиенту нет — он рядом.
import { useCallback, useEffect, useState } from 'react'

import { errMsg } from '../../lib/errMsg'
import { getSessionRole } from '../../services/auth'
import {
  btnNeutralCls,
  h1Cls,
  hintCls,
  iconBtnCls,
  kickerCls,
  mutedCls,
  pageShellCls,
  pinkCardCls,
  toolbarCardCls,
} from '../../ui/kit'
import { addDaysYmd, fmtCsDate, todayYmd } from '../../utils/date'
import { ClientCard } from './components/ClientCard'
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
import { confirmText } from './labels'

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

  const renderGroup = (title: string, list: UpsellClient[], key: string) =>
    list.length > 0 && (
      <section data-group={key} className="mb-2">
        <div className={kickerCls}>
          {title} · {list.length}
        </div>
        {list.map((c) => (
          <ClientCard key={c.clientDocId} client={c} busyKey={busyKey} onBook={book} />
        ))}
      </section>
    )

  return (
    <div className={pageShellCls}>
      <h1 className={h1Cls}>Дозаписи</h1>

      <div className={pinkCardCls}>
        <div className={hintCls}>
          Клиенту −{day?.discountPercent ?? 10} %, вам {day?.commissionPercent ?? 5} % от полной цены услуги. Комиссия
          попадает в «Ожидается» и становится «Подтверждено», когда владелец закрывает смену. Отмена или неявка дозаписи
          комиссию снимает.
        </div>
      </div>

      <div className={toolbarCardCls}>
        <div className="flex items-center gap-2">
          <button type="button" className={iconBtnCls} onClick={() => setDate(addDaysYmd(date, -1))} aria-label="Предыдущий день">
            ←
          </button>
          <span className="text-[14px] font-extrabold text-ink min-w-[96px] text-center" data-date={date}>
            {fmtCsDate(date)}
          </span>
          <button type="button" className={iconBtnCls} onClick={() => setDate(addDaysYmd(date, 1))} aria-label="Следующий день">
            →
          </button>
          {!isToday && (
            <button type="button" className={btnNeutralCls} onClick={() => setDate(today)}>
              Сегодня
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {day?.now && <span className={mutedCls}>сейчас {day.now}</span>}
          <button type="button" className={btnNeutralCls} disabled={dayLoading} onClick={() => loadDay(date)}>
            Обновить
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`${pinkCardCls} ${notice.ok ? '' : '!bg-neg-bg !border-neg-line text-neg'}`}
          data-notice={notice.ok ? 'ok' : 'error'}
        >
          <div className="text-[13px] font-bold">{notice.text}</div>
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
          {renderGroup('Сейчас в салоне', inSalon, 'in-salon')}
          {renderGroup('Позже сегодня', later, 'later')}
        </>
      ) : (
        renderGroup('Клиенты дня', clients, 'day')
      )}

      <MineSection month={month} onMonth={setMonth} data={mine} loading={mineLoading} error={mineError} isOwner={isOwner} />
    </div>
  )
}
