// Мелкие UI-кирпичики макета каталога. Перенесено из CatalogPage.tsx
// (этап 6) дословно.
import { bodyBoldCls, cardCls } from '../../../../ui/kit'
import { palette } from '../../../../ui/palette'
import { inputCls } from './styles'

// ── мелкие UI-кирпичики макета ──

export const CountBadge = ({ n, big }: { n: number; big?: boolean }) => (
  <span
    className={`text-[11px] font-bold text-brand-dark bg-brand-tint rounded-full ${big ? 'px-[9px] py-[3px]' : 'px-2 py-0.5'}`}
  >
    {n}
  </span>
)

export const Toggle = ({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (v: boolean) => void
}) => (
  <button
    type="button"
    className="flex items-center gap-[9px] cursor-pointer select-none bg-transparent border-0 p-0"
    onClick={() => onChange(!checked)}
  >
    <span
      className="relative inline-flex flex-none w-9 h-[21px] rounded-full transition-colors duration-150"
      style={{ background: checked ? palette.brand : palette['surface-toggle'] }}
    >
      <span
        className="absolute top-[2.5px] w-4 h-4 rounded-full bg-white shadow-knob transition-all duration-150"
        style={{ left: checked ? 17.5 : 2.5 }}
      />
    </span>
    <span className={bodyBoldCls}>{label}</span>
  </button>
)

// Инпут с суффиксом (Kč / мин) внутри поля справа
export const SuffixInput = ({
  value,
  suffix,
  suffixPad,
  onChange,
}: {
  value: number
  suffix?: string
  suffixPad?: number // padding-right инпута под суффикс (38 у Kč, 42 у мин)
  onChange: (n: number) => void
}) => (
  <div className="relative">
    <input
      type="number"
      className={inputCls}
      style={suffix ? { paddingRight: suffixPad ?? 38 } : undefined}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
    {suffix && (
      <span className="pointer-events-none absolute right-[11px] top-1/2 -translate-y-1/2 text-[12px] font-bold text-ink-dim">
        {suffix}
      </span>
    )}
  </div>
)

// Карточка-секция формы: слева заголовок (200px) + описание, справа контент
export const SectionCard = ({
  title,
  badge,
  hint,
  children,
}: {
  title: string
  badge?: number
  hint: string
  children: React.ReactNode
}) => (
  <div className={`${cardCls} px-6 py-[22px] mb-3.5`}>
    <div className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-x-7 gap-y-[18px]">
      <div>
        <h2 className="m-0 mb-1.5 flex items-center gap-2 text-[15px] font-extrabold text-ink">
          {title}
          {typeof badge === 'number' && <CountBadge n={badge} />}
        </h2>
        <p className="m-0 text-[12.5px] leading-[1.55] font-medium text-ink-hint">{hint}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  </div>
)

export const MoveArrows = ({ onUp, onDown }: { onUp: () => void; onDown: () => void }) => (
  <span className="flex flex-col items-center gap-px">
    <button
      type="button"
      className="bg-transparent border-0 p-px text-[9px] leading-none text-ink-disabled cursor-pointer hover:text-ink"
      onClick={onUp}
    >
      ▲
    </button>
    <button
      type="button"
      className="bg-transparent border-0 p-px text-[9px] leading-none text-ink-disabled cursor-pointer hover:text-ink"
      onClick={onDown}
    >
      ▼
    </button>
  </span>
)

export const RemoveBtn = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    className="w-7 h-7 rounded-[7px] border-0 bg-transparent text-ink-icon text-[14px] cursor-pointer justify-self-center transition-colors hover:bg-brand-wash hover:text-brand-alert"
    title="Удалить"
    onClick={onClick}
  >
    ✕
  </button>
)

export const AddDashedBtn = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    type="button"
    className="box-border w-full mt-2.5 py-[9px] rounded-lg border border-dashed border-brand-line-dash bg-transparent text-brand text-[13px] font-bold cursor-pointer transition-colors hover:bg-brand-wash-soft"
    onClick={onClick}
  >
    ＋ {label}
  </button>
)

// Строка-чекбокс панели ограничений
export const AllowRow = ({
  checked,
  label,
  onToggle,
}: {
  checked: boolean
  label: string
  onToggle: () => void
}) => (
  <button
    type="button"
    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] font-semibold text-ink-body transition-colors hover:bg-brand-wash-soft"
    onClick={onToggle}
  >
    <span
      className="inline-flex h-[15px] w-[15px] flex-none items-center justify-center rounded text-[10px] leading-none text-white transition-colors"
      style={{
        background: checked ? palette.brand : "#fff",
        border: `1px solid ${checked ? palette.brand : palette["line-chip"]}`,
      }}
    >
      {checked ? "✓" : ""}
    </span>
    <span className="truncate">{label}</span>
  </button>
)
