// CRUD наград. Перенесено из LoyaltyPage.tsx (этап 6) дословно.
import { useState } from 'react'
import { Cell } from '../../dashboard/components/Cell'
import { TableWrapper } from '../components/TableWrapper'
import type { Reward, RewardInput } from '../fetch/loyalty'
import { createReward, deleteReward, updateReward } from '../fetch/loyalty'

const DISCOUNT_LABEL = (r: Reward) =>
  r.discountType === 'percent' ? `−${r.discountValue} %` : `−${r.discountValue} Kč`

const EMPTY_REWARD: RewardInput = {
  title: '',
  thresholdKc: 0,
  discountType: 'percent',
  discountValue: 0,
  active: true,
  order: 0,
}

// ── CRUD наград ──

export function RewardsSection({ rewards, onChanged }: { rewards: Reward[]; onChanged: () => void }) {
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
        <table className={'w-full text-left min-w-[620px]'}>
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
              <tr key={r.documentId} className={'hover:bg-surface-hover'}>
                <Cell title={r.title} className={!r.active ? 'line-through opacity-50' : ''} />
                <Cell title={String(r.thresholdKc)} />
                <Cell title={DISCOUNT_LABEL(r)} className={'text-brand'} />
                <td className={'p-4 border-b border-line-soft'}>
                  <button
                    type={'button'}
                    disabled={busy}
                    className={`text-sm px-2 py-1 rounded-lg border ${r.active ? 'border-emerald-300 text-emerald-700' : 'border-line-btn text-ink-soft'}`}
                    onClick={() => save(() => updateReward(r.documentId, { active: !r.active }))}
                  >
                    {r.active ? 'ANO' : 'NE'}
                  </button>
                </td>
                <td className={'p-4 border-b border-line-soft'}>
                  <button
                    type={'button'}
                    disabled={busy}
                    className={'text-sm text-neg hover:underline'}
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
          className={'border border-line-btn rounded-lg px-3 py-2 text-sm w-44'}
          placeholder={'Название'}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <input
          className={'border border-line-btn rounded-lg px-3 py-2 text-sm w-28'}
          placeholder={'Порог Kč'}
          value={draft.thresholdKc || ''}
          onChange={(e) => setDraft({ ...draft, thresholdKc: Number(e.target.value.replace(/\D/g, '')) })}
        />
        <select
          className={'border border-line-btn rounded-lg px-2 py-2 text-sm'}
          value={draft.discountType}
          onChange={(e) => setDraft({ ...draft, discountType: e.target.value as Reward['discountType'] })}
        >
          <option value={'percent'}>% скидка</option>
          <option value={'fixed'}>Kč скидка</option>
        </select>
        <input
          className={'border border-line-btn rounded-lg px-3 py-2 text-sm w-28'}
          placeholder={draft.discountType === 'percent' ? '%' : 'Kč'}
          value={draft.discountValue || ''}
          onChange={(e) => setDraft({ ...draft, discountValue: Number(e.target.value.replace(/\D/g, '')) })}
        />
        <button
          type={'button'}
          disabled={busy || !draft.title.trim() || !draft.thresholdKc || !draft.discountValue}
          className={'px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand disabled:opacity-40'}
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
