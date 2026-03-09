export const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
      ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    }`}
  >
    <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
    {label}
  </span>
)

export const CheckCard = ({
  title,
  found,
  count,
  children,
}: {
  title: string
  found: boolean
  count: number
  children?: React.ReactNode
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-semibold text-gray-800">{title}</h3>
      <StatusBadge ok={found} label={found ? `${count} zázn.` : 'Nenalezeno'} />
    </div>
    {children}
  </div>
)
