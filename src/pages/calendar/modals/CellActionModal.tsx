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
      <div className="absolute inset-0 bg-black/30 dark:bg-black/60" />
      <div
        className="relative w-full max-w-xs rounded-xl bg-white dark:bg-[#1f1f1e] dark:text-gray-300 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-md font-bold text-gray-900 dark:text-gray-300">Přidat</h3>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {time} · {ddmm} · {masterName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít"
            className="-m-2 p-2 text-sm1 text-gray-400 dark:text-gray-500 hover:text-gray-700"
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
            className="min-h-11 w-full rounded-md border border-gray-300 dark:border-[#3f3f3d] bg-white dark:bg-[#2a2a28] px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333331]"
          >
            + Nový blok
          </button>
        </div>
      </div>
    </div>
  )
}
