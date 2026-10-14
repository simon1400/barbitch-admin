// «Сейчас» на главной владельца (s258): касса и последняя закрытая смена. Не зависит от
// выбранного месяца и в кэш месяца не входит — грузится своей ручкой при открытии и по
// кнопке «обновить» (`reloadKey`). Сбой ручки — строка ошибки, остальная главная живёт.
import { useEffect, useState } from 'react'

import { badgeNegCls } from '../../../ui/kit'
import { BlocksContent } from '../../dashboard/components/BlocksContent'
import { blockNowItems } from '../data'
import { fetchOwnerOverview, type OwnerOverview } from '../fetch/ownerOverview'

import { StatSection } from './StatSection'

export const NowSection = ({ reloadKey }: { reloadKey: number }) => {
  const [data, setData] = useState<OwnerOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setError(null)
    fetchOwnerOverview()
      .then((d) => {
        if (alive) setData(d)
      })
      .catch((e) => {
        if (alive) setError((e as Error).message)
      })
    return () => {
      alive = false
    }
  }, [reloadKey])

  return (
    <StatSection title="Сейчас" id="now" defaultOpen>
      {error && (
        <div role="alert" className={`${badgeNegCls} !text-[12.5px] !px-3 !py-2 block mb-2.5`} data-testid="now-error">
          {error}
        </div>
      )}
      <BlocksContent items={blockNowItems(data)} />
    </StatSection>
  )
}
