// Admin-таб «Лояльность» (bitchcard, К3), owner-only: аккаунты (баланс/наклейки/
// визиты/последний вход в кабинет + развёртка транзакций), ручная корректировка
// ±Kč, CRUD наград (трек), список активных redemption.

import { todayDate } from '../../utils/date'
import { Pagination } from '../../components/Pagination'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { btnNeutralCls, h1Cls, kickerCls, pageShellCls } from '../../ui/kit'
import { Cell } from '../dashboard/components/Cell'
import { OwnerProtection } from './components/OwnerProtection'
import { TableWrapper } from './components/TableWrapper'
import type {
  CabinetAccount,
  LoyaltyAccount,
  LoyaltyMetrics,
  Redemption,
  Reward,
} from './fetch/loyalty'
import {
  fetchCabinetClients,
  fetchLoyaltyAccounts,
  fetchLoyaltyMetrics,
  fetchRedemptions,
  fetchRewards,
  markRedemptionUsed,
} from './fetch/loyalty'
import { CabinetSection } from './loyalty/CabinetSection'
import { REASON_LABELS, fmtDate, fmtDay, PAGE_SIZE } from './loyalty/format'
import { ManualAdjustment } from './loyalty/ManualAdjustment'
import { MetricsSection } from './loyalty/MetricsSection'
import { RewardsSection } from './loyalty/RewardsSection'

import { kc } from '../../utils/money'


// ── страница ──

type LoyaltyTab = 'accounts' | 'cabinet' | 'metrics' | 'rewards' | 'adjust'

const TABS: { id: LoyaltyTab; label: string }[] = [
  { id: 'accounts', label: 'Аккаунты' },
  { id: 'cabinet', label: 'Кабинет' },
  { id: 'metrics', label: 'Метрики' },
  { id: 'rewards', label: 'Награды и погашения' },
  { id: 'adjust', label: 'Корректировка' },
]

// Набор данных, который тянет вкладка сверх обязательного `core`.
type Bucket = 'core' | 'cabinet' | 'metrics' | 'rewards'
const TAB_NEEDS: Record<LoyaltyTab, Bucket[]> = {
  accounts: [],
  cabinet: ['cabinet'],
  metrics: ['metrics', 'rewards'],
  rewards: ['rewards'],
  adjust: [],
}

export default function LoyaltyPage() {
  const cardYear = todayDate().getFullYear()
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([])
  const [cabinetAccounts, setCabinetAccounts] = useState<CabinetAccount[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [metrics, setMetrics] = useState<LoyaltyMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [redSearch, setRedSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<LoyaltyTab>('accounts')
  const [accPage, setAccPage] = useState(1)
  const [redPage, setRedPage] = useState(1)

  // Загрузка по вкладкам (аудит s184). Раньше монтирование страницы тянуло ВСЕ
  // пять наборов — ~12 запросов, из которых семь нужны вкладкам, куда владелец
  // может и не зайти. `core` (аккаунты + активные награды) нужен всегда: обе
  // цифры стоят в плашках над вкладками.
  const fetchBucket = useCallback(
    async (b: Bucket) => {
      if (b === 'core') {
        const [acc, rd] = await Promise.all([
          fetchLoyaltyAccounts(cardYear),
          fetchRedemptions('available'),
        ])
        setAccounts(acc)
        setRedemptions(rd)
        setAccPage(1)
        setRedPage(1)
        return
      }
      if (b === 'cabinet') return setCabinetAccounts(await fetchCabinetClients())
      if (b === 'metrics') return setMetrics(await fetchLoyaltyMetrics(cardYear))
      if (b === 'rewards') return setRewards(await fetchRewards())
    },
    [cardYear],
  )

  const loadedRef = useRef<Set<Bucket>>(new Set())

  const load = useCallback(
    async (buckets: Bucket[], force = false) => {
      const need = [...new Set(buckets)].filter((b) => force || !loadedRef.current.has(b))
      if (!need.length) return
      setLoading(true)
      setError(null)
      try {
        await Promise.all(need.map(fetchBucket))
        for (const b of need) loadedRef.current.add(b)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [fetchBucket],
  )

  // Монтирование и переключение вкладки: уже загруженное не перезапрашивается.
  useEffect(() => {
    void load(['core', ...TAB_NEEDS[tab]])
  }, [load, tab])

  // Кнопка «Обновить» и записи (награда / ручная корректировка) перечитывают то,
  // что видно сейчас, а зависящие наборы помечают устаревшими — иначе владелец
  // открыл бы «Метрики» с цифрами, посчитанными до правки.
  const refresh = useCallback(
    (invalidate: Bucket[] = []) => {
      for (const b of invalidate) loadedRef.current.delete(b)
      void load(['core', ...TAB_NEEDS[tab]], true)
    },
    [load, tab],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter(
      (a) => a.name.toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q),
    )
  }, [accounts, search])

  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + a.balanceKc, 0), [accounts])

  const pagedAccounts = useMemo(
    () => filtered.slice((accPage - 1) * PAGE_SIZE, accPage * PAGE_SIZE),
    [filtered, accPage],
  )
  // Поиск по наградам: имя / e-mail / телефон (по цифрам) / код награды.
  const filteredRedemptions = useMemo(() => {
    const q = redSearch.trim().toLowerCase()
    if (!q) return redemptions
    const qDigits = q.replace(/[\s()+-]/g, '')
    const isPhoneQ = /^\d{3,}$/.test(qDigits)
    return redemptions.filter((r) => {
      if ((r.client?.name || '').toLowerCase().includes(q)) return true
      if ((r.client?.email || '').toLowerCase().includes(q)) return true
      if ((r.code || '').toLowerCase().includes(q)) return true
      if (isPhoneQ && (r.client?.phone || '').replace(/[\s()-]/g, '').includes(qDigits)) return true
      return false
    })
  }, [redemptions, redSearch])

  const pagedRedemptions = useMemo(
    () => filteredRedemptions.slice((redPage - 1) * PAGE_SIZE, redPage * PAGE_SIZE),
    [filteredRedemptions, redPage],
  )

  const markUsed = async (r: Redemption) => {
    if (!window.confirm(`Отметить награду «${r.reward?.title}» (${r.client?.name}) использованной?`))
      return
    setBusy(true)
    try {
      await markRedemptionUsed(r.documentId)
      // список активных наград поменялся; метрики (разбивка по статусам) — тоже
      loadedRef.current.delete('metrics')
      await load(['core'], true)
    } catch (e) {
      window.alert(`Ошибка: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <OwnerProtection>
      <div className={pageShellCls}>
          <div className={kickerCls}>Barbitch Admin</div>
          <div className={'flex items-center justify-between mb-4'}>
            <h1 className={h1Cls}>Лояльность — bitchcard {cardYear}</h1>
            <button
              type={'button'}
              onClick={() => refresh()}
              disabled={loading}
              className={`${btnNeutralCls} mb-[18px]`}
            >
              {loading ? 'Загрузка…' : 'Обновить'}
            </button>
          </div>

          {error && (
            <div className={'mb-4 p-3 rounded-lg bg-neg-bg text-neg text-sm'}>
              Ошибка загрузки: {error}
            </div>
          )}

          <div className={'flex flex-wrap gap-2 mb-4'}>
            <span className={'px-3 py-1.5 rounded-lg bg-white shadow-sm text-sm'}>
              Аккаунтов с копилкой: <b>{accounts.length}</b>
            </span>
            <span className={'px-3 py-1.5 rounded-lg bg-white shadow-sm text-sm'}>
              Σ копилок: <b>{kc(totalBalance)}</b>
            </span>
            <span className={'px-3 py-1.5 rounded-lg bg-white shadow-sm text-sm'}>
              Активных наград: <b>{redemptions.length}</b>
            </span>
          </div>

          <div className={'flex flex-wrap gap-2 mb-6'}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type={'button'}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  tab === t.id
                    ? 'bg-brand text-white shadow-sm'
                    : 'bg-white border border-line-btn text-ink-body shadow-sm hover:bg-pink-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'cabinet' && <CabinetSection accounts={cabinetAccounts} />}

          {tab === 'metrics' && (
            <MetricsSection metrics={metrics} accounts={accounts} rewards={rewards} />
          )}

          {tab === 'adjust' && <ManualAdjustment cardYear={cardYear} onDone={() => refresh(['metrics'])} />}

          {tab === 'rewards' && (
            <>
              <RewardsSection rewards={rewards} onChanged={() => refresh(['metrics'])} />

              <div className={'mb-6'}>
                <div className={'mb-3 flex items-center justify-between gap-3 flex-wrap'}>
                  <h3 className={'text-2xl font-bold'}>Активные награды (доступны к погашению)</h3>
                  <input
                    className={'border border-line-btn rounded-lg px-3 py-2 text-sm w-64'}
                    placeholder={'Поиск: имя / e-mail / телефон / код'}
                    value={redSearch}
                    onChange={(e) => {
                      setRedSearch(e.target.value)
                      setRedPage(1)
                    }}
                  />
                </div>
                {redemptions.length === 0 ? (
                  <p className={'text-sm text-ink-soft'}>Нет активных наград.</p>
                ) : filteredRedemptions.length === 0 ? (
                  <p className={'text-sm text-ink-soft'}>Ничего не найдено по запросу.</p>
                ) : (
                  <TableWrapper
                    additionalInfo={`Показано ${filteredRedemptions.length} из ${redemptions.length}`}
                  >
                    <table className={'w-full text-left min-w-[620px]'}>
                      <thead>
                        <tr>
                          <Cell title={'Клиент'} asHeader />
                          <Cell title={'Контакт'} asHeader />
                          <Cell title={'Награда'} asHeader />
                          <Cell title={'Код'} asHeader />
                          <Cell title={'Действует до'} asHeader />
                          <Cell title={''} asHeader />
                        </tr>
                      </thead>
                      <tbody>
                        {pagedRedemptions.map((r) => (
                          <tr key={r.documentId} className={'hover:bg-surface-hover'}>
                            <Cell title={r.client?.name || '—'} />
                            <td className={'p-4 border-b border-line-soft'}>
                              {r.client?.email || r.client?.phone ? (
                                <span className={'block font-sans text-sm text-ink'}>
                                  {r.client?.email && <span className={'block'}>{r.client.email}</span>}
                                  {r.client?.phone && (
                                    <span className={'block text-ink-soft'}>{r.client.phone}</span>
                                  )}
                                </span>
                              ) : (
                                <span className={'block font-sans text-sm text-ink-faint'}>—</span>
                              )}
                            </td>
                            <Cell
                              title={`${r.reward?.title || '—'} (от ${r.reward?.thresholdKc ?? '?'} Kč)`}
                            />
                            <Cell title={r.code || '—'} className={'font-mono text-brand'} />
                            <Cell title={fmtDay(r.expiresAt)} />
                            <td className={'p-4 border-b border-line-soft'}>
                              <button
                                type={'button'}
                                disabled={busy}
                                className={'text-sm px-2 py-1 rounded-lg border border-line-btn hover:bg-pink-50'}
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
                <Pagination page={redPage} total={filteredRedemptions.length} pageSize={PAGE_SIZE} onPage={setRedPage} unit={'наград'} />
              </div>
            </>
          )}

          {tab === 'accounts' && (
            <>
              <div className={'mb-2 flex items-center justify-between'}>
                <h3 className={'text-2xl font-bold'}>Аккаунты ({cardYear})</h3>
                <input
                  className={'border border-line-btn rounded-lg px-3 py-2 text-sm w-64'}
                  placeholder={'Поиск: имя / e-mail'}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setAccPage(1)
                  }}
                />
              </div>
              {loading && accounts.length === 0 ? (
                <p className={'text-sm text-ink-soft'}>Загрузка…</p>
              ) : (
                <TableWrapper additionalInfo={`Показано ${filtered.length} из ${accounts.length}`}>
                  <table className={'w-full text-left min-w-[620px]'}>
                    <thead>
                      <tr>
                        <Cell title={'Клиент'} asHeader />
                        <Cell title={'E-mail'} asHeader />
                        <Cell title={'Копилка'} asHeader />
                        <Cell title={'Наклейки'} asHeader />
                        <Cell title={'Визитов'} asHeader />
                        <Cell title={'Вход в кабинет'} asHeader />
                        <Cell title={'Последняя транзакция'} asHeader />
                      </tr>
                    </thead>
                    <tbody>
                      {pagedAccounts.map((a) => (
                        <Fragment key={a.clientDocId}>
                          <tr
                            className={'hover:bg-surface-hover cursor-pointer'}
                            onClick={() =>
                              setExpanded(expanded === a.clientDocId ? null : a.clientDocId)
                            }
                          >
                            <Cell title={a.name} className={'text-brand'} />
                            <Cell title={a.email || '—'} className={'text-ink-muted'} />
                            <Cell title={kc(a.balanceKc)} className={'font-bold'} />
                            <Cell title={'●'.repeat(Math.min(a.stamps, 8)) || '—'} />
                            <Cell title={String(a.visits)} />
                            <Cell title={a.cabinetLastLoginAt ? fmtDay(a.cabinetLastLoginAt) : '—'} />
                            <Cell title={fmtDay(a.lastTxAt)} />
                          </tr>
                          {expanded === a.clientDocId && (
                            <tr>
                              <td colSpan={7} className={'p-4 bg-surface-tile border-b border-line-soft'}>
                            <div className={'flex flex-col gap-1'}>
                              {a.transactions.map((tx) => (
                                <div key={tx.documentId} className={'flex gap-3 text-sm'}>
                                  <span className={'text-ink-soft w-36'}>{fmtDate(tx.createdAt)}</span>
                                  <span
                                    className={`w-20 font-medium ${tx.delta < 0 ? 'text-neg' : 'text-emerald-600'}`}
                                  >
                                    {tx.delta > 0 ? '+' : ''}
                                    {tx.delta} Kč
                                  </span>
                                  <span className={'w-28 text-ink-muted'}>
                                    {REASON_LABELS[tx.reason] || tx.reason}
                                  </span>
                                  {tx.comment && <span className={'text-ink-muted'}>{tx.comment}</span>}
                                  {tx.createdByName && tx.reason === 'manual' && (
                                    <span className={'text-ink-faint'}>({tx.createdByName})</span>
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
              <Pagination page={accPage} total={filtered.length} pageSize={PAGE_SIZE} onPage={setAccPage} unit={'аккаунтов'} />
            </>
          )}
      </div>
    </OwnerProtection>
  )
}
