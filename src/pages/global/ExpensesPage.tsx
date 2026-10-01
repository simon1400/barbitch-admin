import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMonthYear } from '../../hooks/useMonthYear'
import { getSessionRole } from '../../services/auth'
import { fmtCsDate, monthEndYmd, todayYmd } from '../../utils/date'
import { btnNeutralCls, btnPinkCls, h1Cls, inputCls, kickerCls, pageShellCls, pillCls, selectCls, toolbarCardCls } from '../../ui/kit'
import { Select } from '../dashboard/components/Select'
import { OwnerProtection } from './components/OwnerProtection'
import { StatSection } from './components/StatSection'
import { ExpensesBarChart } from './components/ExpensesBarChart'
import { ExpenseForm, type ExpenseFormResult } from './expenses/ExpenseForm'
import { ExpensesTable } from './expenses/ExpensesTable'
import { PendingRequests } from './expenses/PendingRequests'
import { RepeatPanel } from './expenses/RepeatPanel'
import {
  PAYMENT_ORDER,
  fetchCostSuggestions,
  fetchCostsMonth,
  monthKey,
  nameKey,
  type CostRow,
  type CostsMonth,
  type CostSuggestion,
} from './fetch/expenses'

const EMPTY: CostsMonth = { month: '', rows: [], categories: [], payments: PAYMENT_ORDER, pending: [] }

/** Дата новой затраты: сегодня, если открыт текущий месяц; иначе последний день прошлого / первый будущего. */
const defaultDateFor = (month: number, year: number, today: string): string => {
  const key = monthKey(month, year)
  if (today.startsWith(key)) return today
  return key < today.slice(0, 7) ? monthEndYmd(year, month) : `${key}-01`
}

// «Затраты» (s236): владелец и управляющая добавляют затраты сами (раньше — только
// панель Strapi). Правка и удаление: владелец — сразу, управляющая — запросом на
// одобрение владельца. Страница — сборка: запросы, форма, график, таблица.
const ExpensesPage = () => {
  const { month, setMonth, year, setYear } = useMonthYear()
  const isOwner = getSessionRole() === 'owner'
  const [data, setData] = useState<CostsMonth>(EMPTY)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<CostSuggestion[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [formRow, setFormRow] = useState<CostRow | null | 'new'>(null)
  // новая затрата сохранена — форма открывается заново пустой
  const [formNonce, setFormNonce] = useState(0)
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  // s237: только затраты без чека — видно, что приложить перед отправкой účetní
  const [noReceipt, setNoReceipt] = useState(false)
  const [repeating, setRepeating] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  // ответ старого месяца не ложится поверх нового (быстрое листание)
  const seq = useRef(0)

  const key = monthKey(month, year)

  const load = useCallback(async () => {
    const my = ++seq.current
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetchCostsMonth(month, year)
      if (my === seq.current) setData(res)
    } catch (e) {
      if (my === seq.current) {
        setError((e as Error).message)
        setData(EMPTY)
      }
    } finally {
      if (my === seq.current) setIsLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    load()
  }, [load])

  // смена месяца закрывает форму и повтор — они про другой месяц
  useEffect(() => {
    setFormRow(null)
    setRepeating(false)
  }, [key])

  const loadSuggestions = useCallback(() => {
    fetchCostSuggestions()
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
  }, [])

  useEffect(() => {
    loadSuggestions()
  }, [loadSuggestions])

  const visible = useMemo(() => {
    const q = nameKey(search)
    return data.rows.filter(
      (r) =>
        (!category || r.category === category) &&
        (!q || nameKey(`${r.name} ${r.comment ?? ''}`).includes(q)) &&
        (!noReceipt || r.files.length === 0),
    )
  }, [data.rows, category, search, noReceipt])
  const withoutReceipt = useMemo(() => data.rows.filter((r) => r.files.length === 0).length, [data.rows])

  // график — по всем строкам месяца (фильтр — кликом по столбцу)
  const chartData = useMemo(() => {
    const byCat = new Map<string, { name: string; sum: number; noDph: number }>()
    for (const r of data.rows) {
      const c = byCat.get(r.category) ?? { name: r.category, sum: 0, noDph: 0 }
      c.sum += r.sum
      c.noDph += r.noDph
      byCat.set(r.category, c)
    }
    return [...byCat.values()]
  }, [data.rows])

  const openForm = (row: CostRow | 'new') => {
    setNotice(null)
    setRepeating(false)
    setFormRow(row)
    formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  const onDone = (r: ExpenseFormResult) => {
    setFormRow(r.kind === 'created' ? 'new' : null)
    if (r.kind === 'created') setFormNonce((n) => n + 1)
    const other = (ymd: string) => !ymd.startsWith(key)
    if (r.kind === 'created') {
      const base = other(r.row.date)
        ? `Затрата добавлена в ${fmtCsDate(r.row.date)} — это другой месяц, здесь она не видна.`
        : `Добавлено: «${r.row.name}».`
      setNotice(
        r.fileErrors.length
          ? `${base} Чек не загрузился (${r.fileErrors.join('; ')}) — откройте затрату и приложите его снова.`
          : base,
      )
      loadSuggestions()
    } else if (r.kind === 'updated') {
      setNotice(other(r.row.date) ? `Сохранено. Затрата перенесена в ${fmtCsDate(r.row.date)}.` : 'Сохранено.')
    } else if (r.kind === 'deleted') {
      setNotice(`Затрата «${r.row.name}» удалена.`)
    } else {
      setNotice(
        r.action === 'delete'
          ? 'Запрос на удаление отправлен владельцу.'
          : r.action === 'file_delete'
            ? 'Запрос на удаление чека отправлен владельцу.'
            : 'Запрос на изменение отправлен владельцу — до одобрения затрата остаётся прежней.',
      )
    }
    load()
  }

  const editing = formRow !== null && formRow !== 'new' ? formRow : null

  return (
    <OwnerProtection>
      <div className={pageShellCls}>
        <div className={kickerCls}>Barbitch Admin</div>
        <h1 className={h1Cls}>Затраты</h1>

        <div className={toolbarCardCls}>
          <Select month={month} setMonth={setMonth} year={year} setYear={setYear} />
          <select
            name="category"
            aria-label="Категория"
            className={selectCls}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Все категории</option>
            {data.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            name="search"
            type="search"
            aria-label="Поиск по названию"
            placeholder="Поиск по названию"
            className={`${inputCls} min-w-0 flex-1 sm:flex-none sm:w-[220px]`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className={pillCls(noReceipt)}
            aria-pressed={noReceipt}
            data-filter="no-receipt"
            onClick={() => setNoReceipt((v) => !v)}
          >
            Без чека{data.rows.length ? ` (${withoutReceipt})` : ''}
          </button>
          <button
            type="button"
            className={`${btnNeutralCls} ml-auto`}
            onClick={() => {
              setNotice(null)
              setFormRow(null)
              setRepeating(true)
              formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
            }}
          >
            Повторить прошлый месяц
          </button>
          <button type="button" className={btnPinkCls} onClick={() => openForm('new')}>
            + Затрата
          </button>
        </div>

        <PendingRequests
          pending={data.pending}
          isOwner={isOwner}
          onChanged={(msg) => {
            if (msg) setNotice(msg)
            load()
          }}
        />

        <div ref={formRef}>
          {repeating && (
            <RepeatPanel
              key={key}
              month={month}
              year={year}
              payments={data.payments}
              onCancel={() => setRepeating(false)}
              onDone={(rows) => {
                setRepeating(false)
                setNotice(rows.length === 1 ? 'Добавлена 1 затрата.' : `Добавлено затрат: ${rows.length}.`)
                loadSuggestions()
                load()
              }}
            />
          )}
          {formRow !== null && (
            <ExpenseForm
              key={editing ? `${editing.documentId}:${editing.updatedAt}:${editing.pendingRequest?.id ?? ''}` : `new:${key}:${formNonce}`}
              row={editing}
              isOwner={isOwner}
              categories={data.categories}
              payments={data.payments}
              suggestions={suggestions}
              monthRows={data.rows}
              defaultDate={defaultDateFor(month, year, todayYmd())}
              onDone={onDone}
              onCancel={() => setFormRow(null)}
              onFilesChanged={load}
            />
          )}
        </div>

        {notice && (
          <div role="status" className="mb-3.5 text-[12.5px] font-semibold text-ink-soft">
            {notice}
          </div>
        )}

        {!isLoading && chartData.length > 0 && (
          <div className={'mb-3.5'}>
            <ExpensesBarChart
              data={chartData}
              title={'Затраты по категориям'}
              onSelect={(c) => setCategory((cur) => (cur === c ? '' : c))}
            />
          </div>
        )}

        <StatSection title={'Таблица затрат'} id={'expenses'} count={visible.length} defaultOpen>
          {error && (
            <div role="alert" className="mb-3 text-[12.5px] font-semibold text-neg">
              Не удалось загрузить затраты: {error}
            </div>
          )}
          {isLoading ? (
            <div className={'py-12 text-center text-[13px] font-semibold text-ink-faint'}>Загрузка…</div>
          ) : error ? null : visible.length === 0 ? (
            <div className={'py-12 text-center text-[13px] font-semibold text-ink-faint'}>
              {data.rows.length === 0
                ? 'За выбранный месяц затрат нет'
                : noReceipt && !category && !search
                  ? 'У всех затрат месяца чек приложен'
                  : 'Ничего не найдено — сбросьте фильтр'}
            </div>
          ) : (
            <ExpensesTable rows={visible} selectedId={editing?.documentId ?? null} onOpen={openForm} />
          )}
        </StatSection>
      </div>
    </OwnerProtection>
  )
}

export default ExpensesPage
