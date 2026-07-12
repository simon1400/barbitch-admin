// Общие UI-примитивы модалов календаря: каркас модала, секция формы, строка выбора.

// Каркас модала: оверлей + белая карточка с заголовком и ✕
export const ModalShell = ({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) => (
  <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
    <div className="absolute inset-0 bg-black/30" />
    <div
      className="relative mt-8 w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-md font-bold text-gray-900">{title}</h3>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm1">
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
)

// Обособленный блок формы: рамка + фон + заголовок-метка
export const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
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
