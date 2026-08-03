// Кнопка принудительного пересчёта месячных данных + подпись «когда обновлялось».
// Месячные агрегаты кэшируются (monthDataCache): текущий месяц — 10 минут, прошлый —
// ВЕЧНО (он считается закрытым). Поэтому правки задним числом (аванс/штраф/премия за
// прошлый месяц) сами по себе в таблицах не появятся — нужна эта кнопка.
// Используется на главной владельца и во вкладке «Зарплаты» — один компонент, чтобы
// поведение не разъезжалось.

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
  <div className="flex items-center gap-2">
    {cachedAt > 0 && (
      <span className="text-xs text-gray-400 whitespace-nowrap">{formatAgo(cachedAt)}</span>
    )}
    <button
      type="button"
      onClick={refresh}
      disabled={loading}
      title="Пересчитать месяц заново (минуя кэш)"
      className="px-3 py-2 rounded-lg text-sm font-semibold border bg-white text-gray-700 border-gray-300 shadow-sm hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
    >
      {loading ? 'Обновление…' : 'Обновить'}
    </button>
  </div>
)
