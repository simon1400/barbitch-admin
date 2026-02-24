import { useEffect, useState } from 'react'
import { getNoonaEmployees, type NoonaEmployee } from '../fetch/noonaEmployees'
import { createNoonaService, type CreateServiceResult } from '../fetch/noonaServices'

interface ProcedureRow {
  id: number
  title: string
  minutes: string
  price: string
  employeeIds: string[]
}

let nextId = 1
const makeRow = (): ProcedureRow => ({
  id: nextId++,
  title: '',
  minutes: '60',
  price: '',
  employeeIds: [],
})

export const NoonaServiceForm = () => {
  const [employees, setEmployees] = useState<NoonaEmployee[]>([])
  const [loadingEmps, setLoadingEmps] = useState(true)
  const [rows, setRows] = useState<ProcedureRow[]>([makeRow()])
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<CreateServiceResult[]>([])
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    getNoonaEmployees()
      .then(setEmployees)
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmps(false))
  }, [])

  const updateRow = (id: number, field: keyof ProcedureRow, value: string | string[]) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const toggleEmployee = (rowId: number, empId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r
        const has = r.employeeIds.includes(empId)
        return {
          ...r,
          employeeIds: has ? r.employeeIds.filter((e) => e !== empId) : [...r.employeeIds, empId],
        }
      }),
    )
  }

  const addRow = () => setRows((prev) => [...prev, makeRow()])

  const removeRow = (id: number) => {
    if (rows.length === 1) return
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handleSubmit = async () => {
    const invalid = rows.find((r) => !r.title.trim() || !r.minutes || !r.price)
    if (invalid) {
      alert('Заполните все поля во всех процедурах')
      return
    }
    setSubmitting(true)
    setResults([])

    const created: CreateServiceResult[] = []
    for (const row of rows) {
      const result = await createNoonaService({
        title: row.title.trim(),
        minutes: Number(row.minutes),
        price: Number(row.price),
        employeeIds: row.employeeIds,
      })
      created.push(result)
    }

    setResults(created)
    setSubmitting(false)
  }

  const copyAll = () => {
    const text = results
      .filter((r) => r.status === 'ok')
      .map((r) => `${r.title}: ${r.id}`)
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopied('all')
    setTimeout(() => setCopied(null), 2000)
  }

  const copyOne = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div>
      <div className="space-y-4">
        {rows.map((row, idx) => (
          <div
            key={row.id}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-gray-600 text-sm">Процедура #{idx + 1}</span>
              {rows.length > 1 && (
                <button
                  onClick={() => removeRow(row.id)}
                  className="text-red-400 hover:text-red-600 text-sm font-medium transition-colors"
                >
                  Удалить
                </button>
              )}
            </div>

            <div className="flex flex-wrap md:flex-nowrap gap-4 mb-4">
              <div className="min-w-[70%]">
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                  Название
                </label>
                <input
                  type="text"
                  value={row.title}
                  onChange={(e) => updateRow(row.id, 'title', e.target.value)}
                  placeholder="Маникюр классический"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                  Мин
                </label>
                <input
                  type="number"
                  value={row.minutes}
                  onChange={(e) => updateRow(row.id, 'minutes', e.target.value)}
                  min={5}
                  step={5}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                  Цена
                </label>
                <input
                  type="number"
                  value={row.price}
                  onChange={(e) => updateRow(row.id, 'price', e.target.value)}
                  min={0}
                  placeholder="500"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                Мастера
              </label>
              {loadingEmps ? (
                <p className="text-sm text-gray-400">Загрузка мастеров...</p>
              ) : employees.length === 0 ? (
                <p className="text-sm text-gray-400">Мастера не найдены</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {employees.map((emp) => {
                    const selected = row.employeeIds.includes(emp.id)
                    return (
                      <button
                        key={emp.id}
                        onClick={() => toggleEmployee(row.id, emp.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          selected
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {emp.profile?.name ?? emp.id}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-5">
        <button
          onClick={addRow}
          className="px-5 py-2.5 rounded-lg border-2 border-primary text-primary font-semibold text-sm hover:bg-primary/5 transition-colors"
        >
          + Добавить процедуру
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-6 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {submitting ? 'Создаём...' : `Создать (${rows.length})`}
        </button>
      </div>

      {results.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-gray-800">Результат</h3>
            {results.some((r) => r.status === 'ok') && (
              <button
                onClick={copyAll}
                className="text-sm text-primary font-semibold hover:underline"
              >
                {copied === 'all' ? '✓ Скопировано' : 'Скопировать все ID'}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                  r.status === 'ok'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div>
                  <span className="font-semibold text-gray-800">{r.title}</span>
                  {r.status === 'ok' ? (
                    <span className="ml-3 text-sm text-gray-500 font-mono">{r.id}</span>
                  ) : (
                    <span className="ml-3 text-sm text-red-500">{r.error}</span>
                  )}
                </div>
                {r.status === 'ok' && (
                  <button
                    onClick={() => copyOne(r.id)}
                    className="text-xs text-primary font-semibold hover:underline ml-4 shrink-0"
                  >
                    {copied === r.id ? '✓' : 'Копировать'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
