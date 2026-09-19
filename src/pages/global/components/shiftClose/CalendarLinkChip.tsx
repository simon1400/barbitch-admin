// Голубой чип-ссылка «открыть бронь в календаре» — один на все таблицы закрытия смены
// (Provedené služby, Dozápisy administrátorů), чтобы иконки не расходились.
//
// Ссылка в календарь админки на конкретную бронь: CalendarPage читает
// ?date=YYYY-MM-DD&highlight=<bookingDocId> при загрузке (тот же контракт, что у
// push-уведомлений) — открывает нужный день, докручивает к карточке и мигает ею.
// 🟥 Дата — ИМЕННО брони; дата смены только как запасной вариант. Открывается в
// новой вкладке, чтобы не терять загруженную сверку смены.
const calendarLink = (bookingDocId: string, date: string) =>
  `/calendar?date=${encodeURIComponent(date)}&highlight=${encodeURIComponent(bookingDocId)}`

const chipCls = 'inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded bg-sky-100 text-sky-700'

const CalendarGlyph = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M3 10h18" />
  </svg>
)

/**
 * Без bookingDocId (бронь удалена или не связана) — тот же чип без ссылки;
 * `muted` делает его серым, когда брони уже нет.
 */
export const CalendarLinkChip = ({
  bookingDocId,
  date,
  title,
  muted = false,
}: {
  bookingDocId?: string | null
  date: string
  title: string
  muted?: boolean
}) => {
  if (bookingDocId) {
    return (
      <a
        href={calendarLink(bookingDocId, date)}
        target="_blank"
        rel="noopener noreferrer"
        title={`${title}\nOtevřít v kalendáři`}
        aria-label="Otevřít v kalendáři"
        className={`${chipCls} hover:bg-sky-200 hover:text-sky-900 transition-colors`}
      >
        <CalendarGlyph />
      </a>
    )
  }
  return (
    <span
      title={title}
      className={
        muted
          ? 'inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded bg-surface-input text-ink-disabled cursor-default'
          : `${chipCls} cursor-default`
      }
    >
      <CalendarGlyph />
    </span>
  )
}
