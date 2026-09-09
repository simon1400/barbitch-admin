// Поля ввода вкладки «Налоги». Перенесено из TaxesTab.tsx (этап 6) дословно.
import { inputBaseCls, labelCls } from '../../../../../ui/kit'
import { fieldCls } from './styles'

export function ParamInput({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="block text-[10.5px] font-bold tracking-[0.05em] uppercase text-ink-soft mb-1.5">
        {label}
      </span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={`${inputBaseCls} w-full rounded-lg px-3 py-[9px] text-[14px]`}
      />
    </label>
  )
}

export function NumField({
  label,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  suffix?: string
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldCls} ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && (
          <span className="absolute right-[11px] top-1/2 -translate-y-1/2 text-[12px] font-bold text-ink-dim pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </label>
  )
}
