// Общие UI-примитивы модалов календаря: каркас модала, секция формы, строка выбора.

// Каркас модала. На телефоне (<sm) — bottom-sheet: выезжает снизу, скруглён сверху,
// «ручка», max-h в dvh (iOS-safe). На sm+ — карточка сверху по центру (как раньше).
// Контент скроллится внутри; опциональный `footer` (кнопки действий) всегда виден.
export const ModalShell = ({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-start sm:p-4" onClick={onClose}>
    <div className="absolute inset-0 bg-black/30" />
    <div
      className="relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:mt-8 sm:max-h-[85dvh] sm:max-w-lg sm:rounded-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Шапка (не скроллится): ручка листа на мобиле + заголовок + ✕ */}
      <div className="shrink-0 px-5 pb-3 pt-2.5 sm:pt-4">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-300 sm:hidden" />
        <div className="flex items-center justify-between">
          <h3 className="text-md font-bold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít"
            className="-m-2 p-2 text-sm1 text-gray-400 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      {footer && (
        <div className="shrink-0 border-t border-gray-200 bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-b-xl">
          {footer}
        </div>
      )}
    </div>
  </div>
)

// Обособленный блок формы: рамка + фон + заголовок-метка.
// min-w-0 обязателен: у fieldset дефолт min-inline-size:min-content — без него
// длинный контент (select с названиями услуг) распирает модал за край экрана
export const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="min-w-0 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
    <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">{title}</legend>
    <div className="space-y-2.5">{children}</div>
  </fieldset>
)

// Бейдж доплаты (название всегда отделено от цены)
const PriceBadge = ({ diff }: { diff: number }) =>
  diff > 0 ? (
    <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
      +{diff} Kč
    </span>
  ) : (
    <span className="shrink-0 text-xs text-gray-400">v ceně</span>
  )

// Строка выбора: индикатор + название слева, цена справа (radio — вариант, checkbox — доплněk)
export const OptionRow = ({
  active,
  radio,
  disabled,
  name,
  hint,
  priceDiff,
  onClick,
}: {
  active: boolean
  radio: boolean
  disabled?: boolean
  name: string
  hint?: string
  priceDiff: number
  onClick: () => void
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left transition ${
      active ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white hover:border-gray-300'
    } disabled:cursor-not-allowed disabled:opacity-40`}
  >
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center border ${radio ? 'rounded-full' : 'rounded'} ${
          active ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white'
        }`}
      >
        {active && <span className="text-[9px] leading-none">✓</span>}
      </span>
      <span className="truncate text-sm text-gray-800">
        {name}
        {hint && <span className="ml-1.5 text-[10px] text-gray-400">{hint}</span>}
      </span>
    </span>
    <PriceBadge diff={priceDiff} />
  </button>
)
