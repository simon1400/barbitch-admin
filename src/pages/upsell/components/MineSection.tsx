// «Мои дозаписи за месяц»: две суммы ОТДЕЛЬНО — «Ожидается» (визит впереди или
// смена ещё не закрыта) и «Подтверждено» (владелец опубликовал на закрытии смены).
// Владелец видит всех администраторов и разбивку по людям.
import {
  badgeFaintCls,
  badgeNegCls,
  badgeNeutralCls,
  badgePosCls,
  badgeWarnCls,
  cardPadCls,
  cardTitleCls,
  colHeadCls,
  hintCls,
  inputCls,
  mutedCls,
  tileAccentCls,
  tileCls,
  tileLabelAccentCls,
  tileLabelCls,
  tileValueAccentCls,
  tileValueCls,
} from '../../../ui/kit'
import { fmtCsDate } from '../../../utils/date'
import { kc } from '../../../utils/money'
import type { UpsellMine, UpsellState } from '../fetch/upsellApi'
import { STATE_LABEL } from '../labels'

const STATE_CLS: Record<UpsellState, string> = {
  awaiting_visit: badgeWarnCls,
  awaiting_confirmation: badgeNeutralCls,
  confirmed: badgePosCls,
  cancelled: badgeNegCls,
  no_commission: badgeFaintCls,
}

interface Props {
  month: string
  onMonth: (m: string) => void
  data: UpsellMine | null
  loading: boolean
  error: string | null
  isOwner: boolean
}

export function MineSection({ month, onMonth, data, loading, error, isOwner }: Props) {
  return (
    <section className={cardPadCls}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className={cardTitleCls}>{isOwner ? 'Дозаписи администраторов за месяц' : 'Мои дозаписи за месяц'}</h2>
        <input
          type="month"
          className={`${inputCls} w-auto`}
          value={month}
          onChange={(e) => e.target.value && onMonth(e.target.value)}
          aria-label="Месяц"
        />
      </div>
      {error && <div className={`${hintCls} text-neg mb-2`}>{error}</div>}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className={tileCls} data-tile="expected">
          <div className={tileLabelCls}>Ожидается</div>
          <div className={tileValueCls}>{data ? kc(data.expectedKc) : '—'}</div>
        </div>
        <div className={tileAccentCls} data-tile="confirmed">
          <div className={tileLabelAccentCls}>Подтверждено</div>
          <div className={tileValueAccentCls}>{data ? kc(data.confirmedKc) : '—'}</div>
        </div>
      </div>
      {isOwner && data?.byAdmin && data.byAdmin.length > 0 && (
        <table className="w-full mb-3 text-[13px]" data-table="by-admin">
          <thead>
            <tr>
              <th className={`${colHeadCls} text-left`}>Администратор</th>
              <th className={`${colHeadCls} text-right`}>Дозаписей</th>
              <th className={`${colHeadCls} text-right`}>Ожидается</th>
              <th className={`${colHeadCls} text-right`}>Подтверждено</th>
            </tr>
          </thead>
          <tbody>
            {data.byAdmin.map((a) => (
              <tr key={a.adminUsername}>
                <td className="font-bold">{a.adminUsername}</td>
                <td className="text-right">{a.count}</td>
                <td className="text-right">{kc(a.expectedKc)}</td>
                <td className="text-right">{kc(a.confirmedKc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {loading && !data && <div className={mutedCls}>Загрузка…</div>}
      {data && data.rows.length === 0 && <div className={hintCls}>В этом месяце дозаписей нет.</div>}
      {data && data.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]" data-table="rows">
            <thead>
              <tr>
                <th className={`${colHeadCls} text-left`}>Дата</th>
                {isOwner && <th className={`${colHeadCls} text-left`}>Администратор</th>}
                <th className={`${colHeadCls} text-left`}>Клиент</th>
                <th className={`${colHeadCls} text-left`}>Услуга · мастер</th>
                <th className={`${colHeadCls} text-right`}>Цена</th>
                <th className={`${colHeadCls} text-right`}>Комиссия</th>
                <th className={`${colHeadCls} text-right`}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.bookingDocId} className="border-t border-line">
                  <td className="py-1.5 whitespace-nowrap">
                    {fmtCsDate(r.date)} {r.time}
                  </td>
                  {isOwner && <td>{r.adminUsername}</td>}
                  <td>{r.clientName}</td>
                  <td>
                    {r.serviceTitle} · {r.employeeName}
                  </td>
                  <td className="text-right whitespace-nowrap">{r.totalPrice != null ? kc(r.totalPrice) : '—'}</td>
                  <td className="text-right whitespace-nowrap">{kc(r.commissionKc)}</td>
                  <td className="text-right">
                    <span className={STATE_CLS[r.state]}>{STATE_LABEL[r.state]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
