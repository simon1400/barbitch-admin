import type { ManageOp, PlannedManageOp } from '../../fetch/manageServices'

const KIND_LABEL: Record<ManageOp['kind'], string> = {
  'noona-price': 'Цена Noona',
  'noona-title': 'Название Noona',
  'hide-event-type': 'Скрыть в Noona',
  'addon-group-put': 'Strapi группа',
  'addon-group-delete': 'Удалить группу',
  'offer-price': 'Цена offer',
  'offer-title': 'Название offer',
  'junior-map-delete': 'Junior-map',
  'junior-map-title': 'Junior-map',
  'junior-map-price': 'Junior-map цена',
}

const KIND_COLOR: Record<ManageOp['kind'], string> = {
  'noona-price': 'bg-blue-50 text-blue-700',
  'noona-title': 'bg-indigo-50 text-indigo-700',
  'hide-event-type': 'bg-amber-50 text-amber-700',
  'addon-group-put': 'bg-violet-50 text-violet-700',
  'addon-group-delete': 'bg-red-50 text-red-700',
  'offer-price': 'bg-green-50 text-green-700',
  'offer-title': 'bg-teal-50 text-teal-700',
  'junior-map-delete': 'bg-red-50 text-red-700',
  'junior-map-title': 'bg-purple-50 text-purple-700',
  'junior-map-price': 'bg-purple-50 text-purple-700',
}

interface Props {
  ops: PlannedManageOp[]
  onApply: () => void
  onCancel: () => void
  applying: boolean
  progress: { done: number; total: number }
}

export const PlanPreview = ({ ops, onApply, onCancel, applying, progress }: Props) => {
  if (ops.length === 0) return null

  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="text-sm font-semibold text-gray-700 mb-3">Предпросмотр: {ops.length} операций</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2">Тип</th>
              <th className="py-2">Объект</th>
              <th className="py-2 text-right">Было</th>
              <th className="py-2 text-right">Стало</th>
            </tr>
          </thead>
          <tbody>
            {ops.map((o) => (
              <tr key={o.key} className="border-b last:border-b-0">
                <td className="py-2">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${KIND_COLOR[o.op.kind]}`}>
                    {KIND_LABEL[o.op.kind]}
                  </span>
                </td>
                <td className="py-2 text-gray-700">{o.label}</td>
                <td className="py-2 text-right tabular-nums text-gray-500">
                  {o.before === null ? '—' : `${o.before} Kč`}
                </td>
                <td className="py-2 text-right tabular-nums font-semibold text-primary">
                  {o.after === null ? '—' : `${o.after} Kč`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onApply}
          disabled={applying}
          className="px-6 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {applying ? `Применяем… (${progress.done}/${progress.total})` : `Применить (${ops.length})`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={applying}
          className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-60"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}
