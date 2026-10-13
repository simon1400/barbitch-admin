// Кнопка принудительного пересчёта месячных данных + подпись «когда обновлялось».
// Месячные агрегаты кэшируются (monthDataCache): текущий месяц — 10 минут, прошлый —
// ВЕЧНО (он считается закрытым). Поэтому правки задним числом (аванс/штраф/премия за
// прошлый месяц) сами по себе в таблицах не появятся — нужна эта кнопка.
// Используется на главной владельца и во вкладке «Зарплаты» — один компонент, чтобы
// поведение не разъезжалось.

// s256: внутри — общая RefreshButton (иконка + «обновлено 20:10»), как во всех модулях.
import { RefreshButton } from '../../../components/RefreshButton'

export const RefreshControl = ({
  cachedAt,
  loading,
  refresh,
}: {
  cachedAt: number
  loading: boolean
  refresh: () => void
}) => <RefreshButton onClick={refresh} loading={loading} updatedAt={cachedAt} title="Пересчитать месяц заново (минуя кэш)" />
