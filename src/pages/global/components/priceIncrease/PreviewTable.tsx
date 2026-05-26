import type { PlannedChange } from '../../fetch/priceIncrease'

interface Props {
  changes: PlannedChange[]
}

const KIND_LABEL: Record<PlannedChange['kind'], string> = {
  'noona-event-type': 'Noona',
  'addon-group': 'Strapi addon-group',
  offering: 'Strapi offering',
}

const KIND_COLOR: Record<PlannedChange['kind'], string> = {
  'noona-event-type': 'bg-purple-100 text-purple-800',
  'addon-group': 'bg-blue-100 text-blue-800',
  offering: 'bg-emerald-100 text-emerald-800',
}

export const PreviewTable = ({ changes }: Props) => {
  if (changes.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-8 text-center text-sm text-gray-500">
        Нет изменений (укажите процент и scope)
      </div>
    )
  }

  const grouped = {
    'noona-event-type': changes.filter((c) => c.kind === 'noona-event-type'),
    'addon-group': changes.filter((c) => c.kind === 'addon-group'),
    offering: changes.filter((c) => c.kind === 'offering'),
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-baseline justify-between mb-4">
        <span className="font-semibold text-gray-700 text-sm">
          Превью изменений ({changes.length})
        </span>
        <div className="flex gap-3 text-xs text-gray-500">
          {Object.entries(grouped).map(([k, list]) => (
            <span key={k}>
              {KIND_LABEL[k as PlannedChange['kind']]}: <b>{list.length}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto -mx-2 px-2">
        {(Object.keys(grouped) as PlannedChange['kind'][]).map((kind) => {
          const list = grouped[kind]
          if (list.length === 0) return null
          return (
            <div key={kind} className="mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {KIND_LABEL[kind]} · {list.length}
              </p>
              <div className="space-y-1.5">
                {list.map((c) => (
                  <div
                    key={c.key}
                    className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                  >
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${KIND_COLOR[c.kind]} shrink-0`}
                    >
                      {KIND_LABEL[c.kind]}
                    </span>
                    <span className="flex-1 text-sm text-gray-800 truncate" title={c.label}>
                      {c.label}
                    </span>
                    <span className="text-sm text-gray-400 line-through font-mono shrink-0">
                      {c.before}
                    </span>
                    <span className="text-sm text-gray-300 shrink-0">→</span>
                    <span className="text-sm font-bold text-primary font-mono shrink-0">
                      {c.after}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
