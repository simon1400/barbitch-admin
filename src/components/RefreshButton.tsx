// Единая кнопка «обновить» всех модулей (s256, просьба владельца): квадратная кнопка с
// иконкой (крутится, пока грузится) и рядом короткое «обновлено 20:10» — только там, где
// известно время данных. Не сегодня — «обновлено 12.10 20:10». Подпись кнопки — в
// aria-label и подсказке; на чешских экранах (Sklad, журнал ошибок) — `lang="cs"`.
import { iconBtnCls, mutedCls } from '../ui/kit'
import { fmtTimePrague, todayYmd, ymdPrague } from '../utils/date'
import { RefreshIcon } from '../pages/upsell/components/icons'

type Lang = 'ru' | 'cs'

const TEXT: Record<Lang, { label: string; updated: string }> = {
  ru: { label: 'Обновить', updated: 'обновлено' },
  cs: { label: 'Obnovit', updated: 'aktualizováno' },
}

/** «обновлено 20:10» / «обновлено 12.10 20:10»; без времени — пусто. */
const fmtUpdated = (ts: number | null | undefined, lang: Lang = 'ru'): string => {
  if (!ts) return ''
  const iso = new Date(ts).toISOString()
  const ymd = ymdPrague(iso)
  const day = ymd === todayYmd() ? '' : `${ymd.slice(8, 10)}.${ymd.slice(5, 7)} `
  return `${TEXT[lang].updated} ${day}${fmtTimePrague(iso)}`
}

export function RefreshButton({
  onClick,
  loading = false,
  updatedAt = null,
  title,
  lang = 'ru',
  small = false,
}: {
  onClick: () => void
  loading?: boolean
  /** время данных (мс); нет — только кнопка */
  updatedAt?: number | null
  /** подсказка, если нужна точнее «Обновить» (например, «пересчитать месяц заново») */
  title?: string
  lang?: Lang
  /** маленькая кнопка — в строке таблицы */
  small?: boolean
}) {
  const label = TEXT[lang].label
  const updated = fmtUpdated(updatedAt, lang)
  const button = (
    <button
      type="button"
      className={small ? `${iconBtnCls} !w-[28px] !h-[28px]` : iconBtnCls}
      onClick={onClick}
      disabled={loading}
      aria-label={label}
      title={title ?? label}
      data-refresh
    >
      <RefreshIcon className={loading ? 'animate-spin' : undefined} />
    </button>
  )
  if (!updated) return button
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`${mutedCls} whitespace-nowrap`} data-updated>
        {updated}
      </span>
      {button}
    </span>
  )
}
