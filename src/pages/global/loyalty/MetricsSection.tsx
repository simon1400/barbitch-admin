// Метрики программы лояльности. Перенесено из LoyaltyPage.tsx (этап 6) дословно.
import { useMemo } from 'react'
import { kc, num } from '../../../utils/money'
import { Cell } from '../../dashboard/components/Cell'
import { TableWrapper } from '../components/TableWrapper'
import type { LoyaltyAccount, LoyaltyMetrics, Reward } from '../fetch/loyalty'

// ── метрики программы ──

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

function StatTile({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className={'bg-white shadow-md rounded-xl p-4 flex flex-col gap-1'}>
      <span className={'text-xs text-ink-soft'}>{label}</span>
      <span className={'text-2xl font-bold'}>{value}</span>
      {sub && <span className={'text-xs text-ink-faint'}>{sub}</span>}
    </div>
  )
}

export function MetricsSection({
  metrics,
  accounts,
  rewards,
}: {
  metrics: LoyaltyMetrics | null
  accounts: LoyaltyAccount[]
  rewards: Reward[]
}) {
  const minThreshold = useMemo(
    () => (rewards.length ? Math.min(...rewards.map((r) => r.thresholdKc)) : 0),
    [rewards],
  )
  const withEnoughBalance = useMemo(
    () => (minThreshold ? accounts.filter((a) => a.balanceKc >= minThreshold).length : 0),
    [accounts, minThreshold],
  )

  if (!metrics) return null
  const { clientTotal, clientVerified, clientLoggedIn, redemptionsByStatus, discountUsedKc, tiers } =
    metrics

  return (
    <div className={'mb-8'}>
      <h3 className={'text-2xl font-bold mb-3'}>Метрики программы ({metrics.cardYear})</h3>

      <p className={'text-sm font-semibold text-ink-muted mb-2'}>Охват</p>
      <div className={'grid grid-cols-2 md:grid-cols-4 gap-3 mb-5'}>
        <StatTile label={'Клиентов в базе'} value={num(clientTotal)} />
        <StatTile
          label={'С цифровым аккаунтом'}
          value={num(clientVerified)}
          sub={`${pct(clientVerified, clientTotal)} % базы (e-mail подтверждён)`}
        />
        <StatTile
          label={'Заходили в кабинет'}
          value={num(clientLoggedIn)}
          sub={`${pct(clientLoggedIn, clientVerified)} % аккаунтов`}
        />
        <StatTile
          label={`Копилка ≥ ${minThreshold} Kč`}
          value={num(withEnoughBalance)}
          sub={'достигли первой награды'}
        />
      </div>

      <p className={'text-sm font-semibold text-ink-muted mb-2'}>Скидки (стоимость программы)</p>
      <div className={'grid grid-cols-2 md:grid-cols-4 gap-3 mb-5'}>
        <StatTile
          label={'Применено скидок'}
          value={kc(discountUsedKc)}
          sub={`за ${metrics.cardYear} год (использованные награды)`}
        />
        <StatTile label={'Выдано наград'} value={String(redemptionsByStatus.available)} sub={'доступны'} />
        <StatTile
          label={'Использовано'}
          value={String(redemptionsByStatus.used)}
          sub={`${pct(redemptionsByStatus.used, redemptionsByStatus.available + redemptionsByStatus.used + redemptionsByStatus.expired)} % всех выданных`}
        />
        <StatTile label={'Истекло'} value={String(redemptionsByStatus.expired)} sub={'не погашены до 31.12'} />
      </div>

      {tiers.length > 0 && (
        <>
          <p className={'text-sm font-semibold text-ink-muted mb-2'}>По ступеням</p>
          <TableWrapper>
            <table className={'w-full text-left min-w-[620px]'}>
              <thead>
                <tr>
                  <Cell title={'Награда'} asHeader />
                  <Cell title={'Порог Kč'} asHeader />
                  <Cell title={'Доступно'} asHeader />
                  <Cell title={'Использовано'} asHeader />
                  <Cell title={'Истекло'} asHeader />
                  <Cell title={'Скидок Kč'} asHeader />
                </tr>
              </thead>
              <tbody>
                {tiers.map((t) => (
                  <tr key={`${t.thresholdKc}-${t.title}`} className={'hover:bg-surface-hover'}>
                    <Cell title={t.title} />
                    <Cell title={String(t.thresholdKc)} />
                    <Cell title={String(t.available)} />
                    <Cell title={String(t.used)} className={'font-medium'} />
                    <Cell title={String(t.expired)} className={'text-ink-faint'} />
                    <Cell title={kc(t.discountUsedKc)} className={'text-brand'} />
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
        </>
      )}

      <p className={'mt-3 text-xs text-ink-soft'}>
        ⚠️ Числа описывают <b>охват и стоимость</b> программы, а не её причинный эффект: нет чистой
        контрольной группы (участники vs нет), поэтому сравнивать удержание/чек напрямую нельзя —
        разница может объясняться тем, что активные клиенты и так лояльнее.
      </p>
    </div>
  )
}
