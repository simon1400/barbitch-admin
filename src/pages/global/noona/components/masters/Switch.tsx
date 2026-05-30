import type { CategoryState } from '../../fetch/masterServices'

interface Props {
  state: CategoryState // 'on' | 'off' | 'partial'
  onClick: () => void
  disabled?: boolean
  title?: string
}

// Toggle switch. 'partial' (category tri-state) shows an amber track with a centered knob.
export const Switch = ({ state, onClick, disabled, title }: Props) => {
  const track =
    state === 'on' ? 'bg-primary' : state === 'partial' ? 'bg-amber-400' : 'bg-gray-300'
  const knob = state === 'on' ? 'translate-x-5' : state === 'partial' ? 'translate-x-2.5' : 'translate-x-0.5'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={state === 'on'}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${track}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${knob}`}
      />
    </button>
  )
}
