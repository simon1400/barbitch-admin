// Кнопка принудительного пересчёта месячных данных + подпись «когда обновлялось».
// Месячные агрегаты кэшируются (monthDataCache): текущий месяц — 10 минут, прошлый —
// ВЕЧНО (он считается закрытым). Поэтому правки задним числом (аванс/штраф/премия за
// прошлый месяц) сами по себе в таблицах не появятся — нужна эта кнопка.
// Используется на главной владельца и во вкладке «Зарплаты» — один компонент, чтобы
// поведение не разъезжалось.

import { btnNeutralCls, mutedCls } from '../../../ui/kit'

const formatAgo = (ts: number): string => {
  if (!ts) return ''
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return 'обновлено только что'
  const min = Math.floor(sec / 60)
  if (min < 60) return `обновлено ${min} мин назад`
  const hour = Math.floor(min / 60)
  return `обновлено ${hour} ч назад`
}

export const RefreshControl = ({
  cachedAt,
  loading,
  refresh,
}: {
  cachedAt: number
  loading: boolean
  refresh: () => void
}) => (
  <div className="flex items-center gap-3">
    {cachedAt > 0 && (
      <span className={`${mutedCls} whitespace-nowrap`}>{formatAgo(cachedAt)}</span>
    )}
    <button
      type="button"
      onClick={refresh}
      disabled={loading}
      title="Пересчитать месяц заново (минуя кэш)"
      className={btnNeutralCls}
    >
      {loading ? 'Обновление…' : 'Обновить'}
    </button>
  </div>
)
