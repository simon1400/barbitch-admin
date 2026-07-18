// Admin-таб «Лояльность» (bitchcard, К3), owner-only: аккаунты (баланс/наклейки/
// визиты/последний вход в кабинет + развёртка транзакций), ручная корректировка
// ±Kč, CRUD наград (трек), список активных redemption.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Container } from '../../components/Container'
import { Cell } from '../dashboard/components/Cell'
import { OwnerProtection } from './components/OwnerProtection'
import { TableWrapper } from './components/TableWrapper'
import type { ClientHit, LoyaltyAccount, Redemption, Reward, RewardInput } from './fetch/loyalty'
import {
  createManualTransaction,
  createReward,
  deleteReward,
  fetchLoyaltyAccounts,
  fetchRedemptions,
  fetchRewards,
  markRedemptionUsed,
  searchLoyaltyClients,
  updateReward,
} from './fetch/loyalty'

const REASON_LABELS: Record<string, string> = {
  visit: 'визит',
  manual: 'корректировка',
  signup: 'регистрация',
  referral: 'рефералка',
}

const DISCOUNT_LABEL = (r: Reward) =>
  r.discountType === 'percent' ? `−${r.discountValue} %` : `−${r.discountValue} Kč`

const fmtKc = (n: number) => `${Math.round(n).toLocaleString('cs-CZ')} Kč`

const fmtDate = (s: string | null) =>
  s
    ? new Date(s).toLocaleString('cs-CZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

const fmtDay = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const EMPTY_REWARD: RewardInput = {
  title: '',
  thresholdKc: 0,
  discountType: 'percent',
  discountValue: 0,
  active: true,
  order: 0,
}

// ── ручная корректировка ──

function ManualAdjustment({ cardYear, onDone }: { cardYear: number; onDone: () => void }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ClientHit[]>([])
  const [selected, setSelected] = useState<ClientHit | null>(null)
  const [delta, setDelta] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onQuery = (v: string) => {
    setQuery(v)
    setSelected(null)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        setHits(v.trim().length >= 2 ? await searchLoyaltyClients(v) : [])
      } catch {
        setHits([])
      }
    }, 300)
  }

  const submit = async () => {
    const value = Number(delta)
    if (!selected || !value || !comment.trim()) return
    if (!window.confirm(`${selected.name}: ${value > 0 ? '+' : ''}${value} Kč — записать?`)) return
    setBusy(true)
    setMsg(null)
    try {
      await createManualTransaction({
        clientDocId: selected.documentId,
        delta: value,
        cardYear,
        comment: comment.trim(),
      })
      setMsg(`✓ ${selected.name}: ${value > 0 ? '+' : ''}${value} Kč записано`)
      setQuery('')
      setHits([])
      setSelected(null)
      setDelta('')
      setComment('')
      onDone()
    } catch (e) {
      setMsg(`Ошибка: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={'bg-white shadow-md rounded-xl p-4 mb-6'}>
      <h3 className={'text-2xl font-bold mb-3'}>Ручная корректировка ± Kč</h3>
      <div className={'flex flex-col gap-2 md:flex-row md:items-start'}>
        <div className={'relative md:w-72'}>
          <input
            className={'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'}
            placeholder={'Клиент: имя / e-mail / телефон'}
            value={selected ? selected.name : query}
            onChange={(e) => onQuery(e.target.value)}
          />
          {!selected && hits.length > 0 && (
            <div
              className={
                'absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto'
              }
            >
              {hits.map((h) => (
                <button
                  key={h.documentId}
                  type={'button'}
                  className={'block w-full text-left px-3 py-2 text-sm hover:bg-pink-50'}
                  onClick={() => {
                    setSelected(h)
                    setHits([])
                  }}
                >
                  <span className={'font-medium'}>{h.name}</span>
                  <span className={'text-gray-500'}> · {h.email || h.phone || '—'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          className={'border border-gray-300 rounded-lg px-3 py-2 text-sm md:w-32'}
          placeholder={'±Kč (напр. -500)'}
          value={delta}
          onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, ''))}
        />
        <input
          className={'border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1'}
          placeholder={'Комментарий (обязателен)'}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button
          type={'button'}
          disabled={busy || !selected || !Number(delta) || !comment.trim()}
          onClick={submit}
          className={
            'px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary disabled:opacity-40'
          }
        >
          {busy ? 'Записываю…' : 'Записать'}
        </button>
      </div>
      {msg && <p className={'mt-2 text-sm text-gray-700'}>{msg}</p>}
      <p className={'mt-2 text-xs text-gray-500'}>
        Создаёт транзакцию reason=manual за {cardYear} год; пересечение порога сразу создаёт награду.
      </p>
    </div>
  )
}

// ── CRUD наград ──

function RewardsSection({ rewards, onChanged }: { rewards: Reward[]; onChanged: () => void }) {
  const [draft, setDraft] = useState<RewardInput>(EMPTY_REWARD)
  const [busy, setBusy] = useState(false)

  const save = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      onChanged()
    } catch (e) {
      window.alert(`Ошибка: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={'mb-6'}>
      <h3 className={'text-2xl font-bold mb-3'}>Награды (трек bitchcard)</h3>
      <TableWrapper>
        <table className={'w-full text-left table-auto min-w-max'}>
          <thead>
            <tr>
              <Cell title={'Название'} asHeader />
              <Cell title={'Порог Kč'} asHeader />
              <Cell title={'Скидка'} asHeader />
              <Cell title={'Активна'} asHeader />
              <Cell title={''} asHeader />
            </tr>
          </thead>
          <tbody>
            {rewards.map((r) => (
              <tr key={r.documentId} className={'hover:bg-gray-50'}>
                <Cell title={r.title} className={!r.active ? 'line-through opacity-50' : ''} />
                <Cell title={String(r.thresholdKc)} />
                <Cell title={DISCOUNT_LABEL(r)} className={'text-primary'} />
                <td className={'p-4 border-b border-blue-gray-50'}>
                  <button
                    type={'button'}
                    disabled={busy}
                    className={`text-sm px-2 py-1 rounded-lg border ${r.active ? 'border-emerald-300 text-emerald-700' : 'border-gray-300 text-gray-500'}`}
                    onClick={() => save(() => updateReward(r.documentId, { active: !r.active }))}
                  >
                    {r.active ? 'ANO' : 'NE'}
                  </button>
                </td>
                <td className={'p-4 border-b border-blue-gray-50'}>
                  <button
                    type={'button'}
                    disabled={busy}
                    className={'text-sm text-red-600 hover:underline'}
                    onClick={() => {
                      if (window.confirm(`Удалить награду «${r.title}»?`))
                        void save(() => deleteReward(r.documentId))
                    }}
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrapper>
      <div className={'mt-3 flex flex-wrap gap-2 items-center'}>
        <input
          className={'border border-gray-300 rounded-lg px-3 py-2 text-sm w-44'}
          placeholder={'Название'}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <input
          className={'border border-gray-300 rounded-lg px-3 py-2 text-sm w-28'}
          placeholder={'Порог Kč'}
          value={draft.thresholdKc || ''}
          onChange={(e) => setDraft({ ...draft, thresholdKc: Number(e.target.value.replace(/\D/g, '')) })}
        />
        <select
          className={'border border-gray-300 rounded-lg px-2 py-2 text-sm'}
          value={draft.discountType}
          onChange={(e) => setDraft({ ...draft, discountType: e.target.value as Reward['discountType'] })}
        >
          <option value={'percent'}>% скидка</option>
          <option value={'fixed'}>Kč скидка</option>
        </select>
        <input
          className={'border border-gray-300 rounded-lg px-3 py-2 text-sm w-28'}
          placeholder={draft.discountType === 'percent' ? '%' : 'Kč'}
          value={draft.discountValue || ''}
          onChange={(e) => setDraft({ ...draft, discountValue: Number(e.target.value.replace(/\D/g, '')) })}
        />
        <button
          type={'button'}
          disabled={busy || !draft.title.trim() || !draft.thresholdKc || !draft.discountValue}
          className={'px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary disabled:opacity-40'}
          onClick={() =>
            save(async () => {
              await createReward({ ...draft, order: rewards.length + 1 })
              setDraft(EMPTY_REWARD)
            })
          }
        >
          + Награда
        </button>
      </div>
    </div>
  )
}

// ── страница ──

export default function LoyaltyPage() {
  const cardYear = new Date().getFullYear()
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [acc, rw, rd] = await Promise.all([
        fetchLoyaltyAccounts(cardYear),
        fetchRewards(),
        fetchRedemptions('available'),
      ])
      setAccounts(acc)
      setRewards(rw)
      setRedemptions(rd)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [cardYear])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter(
      (a) => a.name.toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q),
    )
  }, [accounts, search])

  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + a.balanceKc, 0), [accounts])

  const markUsed = async (r: Redemption) => {
    if (!window.confirm(`Отметить награду «${r.reward?.title}» (${r.client?.name}) использованной?`))
      return
    setBusy(true)
    try {
      await markRedemptionUsed(r.documentId)
      await load()
    } catch (e) {
      window.alert(`Ошибка: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <OwnerProtection>
      <div className={'py-6'}>
        <Container size={'lg'}>
          <div className={'flex items-center justify-between mb-4'}>
            <h2 className={'text-3xl font-bold'}>Лояльность — bitchcard {cardYear}</h2>
            <button
              type={'button'}
              onClick={() => void load()}
              disabled={loading}
              className={'px-4 py-2 rounded-lg text-sm border border-gray-300 bg-white shadow-sm'}
            >
              {loading ? 'Загрузка…' : 'Обновить'}
            </button>
          </div>

          {error && (
            <div className={'mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm'}>
              Ошибка загрузки: {error}
            </div>
          )}

          <div className={'flex flex-wrap gap-2 mb-6'}>
            <span className={'px-3 py-1.5 rounded-lg bg-white shadow-sm text-sm'}>
              Аккаунтов с копилкой: <b>{accounts.length}</b>
            </span>
            <span className={'px-3 py-1.5 rounded-lg bg-white shadow-sm text-sm'}>
              Σ копилок: <b>{fmtKc(totalBalance)}</b>
            </span>
            <span className={'px-3 py-1.5 rounded-lg bg-white shadow-sm text-sm'}>
              Активных наград: <b>{redemptions.length}</b>
            </span>
          </div>

          <ManualAdjustment cardYear={cardYear} onDone={() => void load()} />

          <RewardsSection rewards={rewards} onChanged={() => void load()} />

          <div className={'mb-6'}>
            <h3 className={'text-2xl font-bold mb-3'}>Активные награды (доступны к погашению)</h3>
            {redemptions.length === 0 ? (
              <p className={'text-sm text-gray-500'}>Нет активных наград.</p>
            ) : (
              <TableWrapper>
                <table className={'w-full text-left table-auto min-w-max'}>
                  <thead>
                    <tr>
                      <Cell title={'Клиент'} asHeader />
                      <Cell title={'Награда'} asHeader />
                      <Cell title={'Код'} asHeader />
                      <Cell title={'Действует до'} asHeader />
                      <Cell title={''} asHeader />
                    </tr>
                  </thead>
                  <tbody>
                    {redemptions.map((r) => (
                      <tr key={r.documentId} className={'hover:bg-gray-50'}>
                        <Cell title={r.client?.name || '—'} />
                        <Cell
                          title={`${r.reward?.title || '—'} (от ${r.reward?.thresholdKc ?? '?'} Kč)`}
                        />
                        <Cell title={r.code || '—'} className={'font-mono text-primary'} />
                        <Cell title={fmtDay(r.expiresAt)} />
                        <td className={'p-4 border-b border-blue-gray-50'}>
                          <button
                            type={'button'}
                            disabled={busy}
                            className={'text-sm px-2 py-1 rounded-lg border border-gray-300 hover:bg-pink-50'}
                            onClick={() => void markUsed(r)}
                          >
                            Отметить использованной
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrapper>
            )}
          </div>

          <div className={'mb-2 flex items-center justify-between'}>
            <h3 className={'text-2xl font-bold'}>Аккаунты ({cardYear})</h3>
            <input
              className={'border border-gray-300 rounded-lg px-3 py-2 text-sm w-64'}
              placeholder={'Поиск: имя / e-mail'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {loading && accounts.length === 0 ? (
            <p className={'text-sm text-gray-500'}>Загрузка…</p>
          ) : (
            <TableWrapper additionalInfo={`Показано ${filtered.length} из ${accounts.length}`}>
              <table className={'w-full text-left table-auto min-w-max'}>
                <thead>
                  <tr>
                    <Cell title={'Клиент'} asHeader />
                    <Cell title={'Копилка'} asHeader />
                    <Cell title={'Наклейки'} asHeader />
                    <Cell title={'Визитов'} asHeader />
                    <Cell title={'Вход в кабинет'} asHeader />
                    <Cell title={'Последняя транзакция'} asHeader />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <Fragment key={a.clientDocId}>
                      <tr
                        className={'hover:bg-gray-50 cursor-pointer'}
                        onClick={() =>
                          setExpanded(expanded === a.clientDocId ? null : a.clientDocId)
                        }
                      >
                        <Cell title={a.name} className={'text-primary'} />
                        <Cell title={fmtKc(a.balanceKc)} className={'font-bold'} />
                        <Cell title={'●'.repeat(Math.min(a.stamps, 8)) || '—'} />
                        <Cell title={String(a.visits)} />
                        <Cell title={a.cabinetLastLoginAt ? fmtDay(a.cabinetLastLoginAt) : '—'} />
                        <Cell title={fmtDay(a.lastTxAt)} />
                      </tr>
                      {expanded === a.clientDocId && (
                        <tr>
                          <td colSpan={6} className={'p-4 bg-gray-50 border-b border-blue-gray-50'}>
                            <div className={'flex flex-col gap-1'}>
                              {a.transactions.map((tx) => (
                                <div key={tx.documentId} className={'flex gap-3 text-sm'}>
                                  <span className={'text-gray-500 w-36'}>{fmtDate(tx.createdAt)}</span>
                                  <span
                                    className={`w-20 font-medium ${tx.delta < 0 ? 'text-red-600' : 'text-emerald-600'}`}
                                  >
                                    {tx.delta > 0 ? '+' : ''}
                                    {tx.delta} Kč
                                  </span>
                                  <span className={'w-28 text-gray-600'}>
                                    {REASON_LABELS[tx.reason] || tx.reason}
                                  </span>
                                  {tx.comment && <span className={'text-gray-600'}>{tx.comment}</span>}
                                  {tx.createdByName && tx.reason === 'manual' && (
                                    <span className={'text-gray-400'}>({tx.createdByName})</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </TableWrapper>
          )}
        </Container>
      </div>
    </OwnerProtection>
  )
}
