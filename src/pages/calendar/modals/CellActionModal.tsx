// Выбор действия по клику на пустую ячейку грида: rezervace / blok.
// Компактный модал по центру (не ModalShell — тот прижат кверху и широкий).

export const CellActionModal = ({
  masterName,
  date,
  time,
  onClose,
  onReservation,
  onBlock,
}: {
  masterName: string
  date: string
  time: string
  onClose: () => void
  onReservation: () => void
  onBlock: () => void
}) => {
  const ddmm = `${date.split('-').reverse().slice(0, 2).join('. ')}.`
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-xs rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-md font-bold text-gray-900">Přidat</h3>
            <p className="mt-0.5 text-sm text-gray-500">
              {time} · {ddmm} · {masterName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít"
            className="-m-2 p-2 text-sm1 text-gray-400 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onReservation}
            className="min-h-11 w-full rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            + Nová rezervace
          </button>
          <button
            type="button"
            onClick={onBlock}
            className="min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            + Nový blok
          </button>
        </div>
      </div>
    </div>
  )
}
