import type { Employee } from '../../fetch/masterServices'

interface Props {
  employees: Employee[]
  selectedId: string | null
  onSelect: (id: string) => void
  disabled?: boolean
}

export const MasterSelector = ({ employees, selectedId, onSelect, disabled }: Props) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-4">
    <label className="font-semibold text-gray-600 text-sm" htmlFor="master-select">
      Выбери мастера
    </label>
    <select
      id="master-select"
      value={selectedId ?? ''}
      onChange={(e) => onSelect(e.target.value)}
      disabled={disabled}
      className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
    >
      <option value="" disabled>
        — выбрать мастера ({employees.length}) —
      </option>
      {employees.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
        </option>
      ))}
    </select>
  </div>
)
