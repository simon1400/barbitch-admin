// «График мастеров» (/schedule), s218 — Фаза F плана «Управляющая».
//
// Плановый график: шаблон недели мастера + исключения по датам. Сервер сам
// ставит по плану блоки календаря до конца окна записи — движок, сайт и все
// отчёты видят график только через них. Руководство меняет шаблон и дни сразу,
// администратор — предлагает изменение дня (действует после согласования),
// мастеру модуль закрыт (свои блоки он видит в календаре).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { btnNeutralCls, h1Cls, hintCls, iconBtnCls, kickerCls, mutedCls, pageShellCls, toolbarCardCls } from '../../ui/kit'
import { fmtCsDate, monthLabelRu, todayYmd } from '../../utils/date'
import { ChevronLeft, ChevronRight, RefreshIcon } from '../upsell/components/icons'
import { ConflictList } from '../global/team/tabs/timeoff/ConflictList'
import { DayEditor } from './components/DayEditor'
import { LegacyPanel } from './components/LegacyPanel'
import { ScheduleTable } from './components/ScheduleTable'
import { TemplateEditor } from './components/TemplateEditor'
import {
  decideRequest,
  fetchScheduleGrid,
  saveDays,
  saveTemplate,
  type Conflict,
  type DayChange,
  type ScheduleGrid,
  type TemplateDays,
} from './fetch/schedule'

/** Сдвиг месяца YYYY-MM на n (без Date — никакой зависимости от часов браузера). */
const shiftMonth = (m: string, n: number): string => {
  const [y, mo] = m.split('-').map(Number)
  const t = y * 12 + (mo - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

type Panel = { kind: 'template' | 'legacy'; personal: string } | null
type Notice = { text: string; tone: 'ok' | 'warn'; conflicts: Conflict[] } | null

const blocksWord = (n: number) => (n === 1 ? 'блок' : n >= 2 && n <= 4 ? 'блока' : 'блоков')

export default function SchedulePage() {
  const [params] = useSearchParams()
  const boot = useRef({ master: params.get('master'), date: params.get('date') })
  const bootDate = boot.current.date && /^\d{4}-\d{2}-\d{2}$/.test(boot.current.date) ? boot.current.date : null

  const [month, setMonth] = useState(() => (bootDate ?? todayYmd()).slice(0, 7))
  const [grid, setGrid] = useState<ScheduleGrid | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<{ personal: string; dates: Set<string> } | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const seq = useRef(0)
  const lastClick = useRef<string | null>(null)

  const load = useCallback(async (m: string) => {
    const my = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const g = await fetchScheduleGrid(m)
      if (my !== seq.current) return
      setGrid(g)
    } catch (e) {
      if (my !== seq.current) return
      setError((e as Error).message)
    } finally {
      if (my === seq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(month)
  }, [load, month])

  // из календаря (блок плана → «изменить в плане»): сразу выбрать эту клетку
  useEffect(() => {
    const { master, date } = boot.current
    if (!grid || !master || !bootDate || date !== bootDate) return
    if (grid.masters.some((m) => m.documentId === master) && bootDate >= grid.today) {
      setSelected({ personal: master, dates: new Set([bootDate]) })
    }
    boot.current = { master: null, date: null }
  }, [grid, bootDate])

  const goMonth = (m: string) => {
    setSelected(null)
    setPanel(null)
    setMonth(m)
  }

  const onCell = (personal: string, date: string, e: { shiftKey: boolean }) => {
    if (!grid || date < grid.today) return
    setNotice(null)
    setPanel((p) => (p?.kind === 'template' ? p : null))
    setSelected((cur) => {
      if (!cur || cur.personal !== personal) {
        lastClick.current = date
        return { personal, dates: new Set([date]) }
      }
      const next = new Set(cur.dates)
      if (e.shiftKey && lastClick.current) {
        const [a, b] = [lastClick.current, date].sort()
        for (const d of grid.dates.map((x) => x.date)) if (d >= a && d <= b && d >= grid.today) next.add(d)
      } else if (next.has(date)) next.delete(date)
      else next.add(date)
      lastClick.current = date
      return next.size ? { personal, dates: next } : null
    })
  }

  const master = (id: string | undefined) => grid?.masters.find((m) => m.documentId === id) || null
  const selMaster = master(selected?.personal)
  const selDates = selected ? [...selected.dates].sort() : []

  const run = async (fn: () => Promise<Notice>) => {
    setBusy(true)
    try {
      const n = await fn()
      setNotice(n)
      await load(month)
    } catch (e) {
      setNotice({ text: (e as Error).message, tone: 'warn', conflicts: [] })
    } finally {
      setBusy(false)
    }
  }

  const onSaveDays = (changes: DayChange[], note: string) => {
    if (!selMaster) return
    const m = selMaster
    void run(async () => {
      const r = await saveDays(m.documentId, changes, note, m.schedule.updatedAt)
      setSelected(null)
      if (r.pending) return { text: `Предложение отправлено на согласование (${m.name}).`, tone: 'ok', conflicts: [] }
      const moved = r.reconcile.created + r.reconcile.deleted
      return {
        text: `Сохранено: ${m.name}${moved ? ` · в календаре +${r.reconcile.created} / −${r.reconcile.deleted} ${blocksWord(moved)}` : ''}.`,
        tone: 'ok',
        conflicts: r.conflicts,
      }
    })
  }

  const onDecide = (date: string, status: 'approved' | 'rejected') => {
    if (!selMaster) return
    const m = selMaster
    if (status === 'rejected' && !window.confirm(`Отклонить предложение на ${fmtCsDate(date)} (${m.name})?`)) return
    void run(async () => {
      const r = await decideRequest(m.documentId, date, status)
      setSelected(null)
      return {
        text: status === 'approved' ? `Согласовано: ${m.name}, ${fmtCsDate(date)}.` : `Отклонено: ${m.name}, ${fmtCsDate(date)}.`,
        tone: 'ok',
        conflicts: r.conflicts || [],
      }
    })
  }

  const onSaveTemplate = (from: string, days: TemplateDays) => {
    const m = master(panel?.personal)
    if (!m) return
    void run(async () => {
      const r = await saveTemplate(m.documentId, from, days, m.schedule.updatedAt)
      setPanel({ kind: 'legacy', personal: m.documentId })
      const moved = r.reconcile.created + r.reconcile.deleted
      return {
        text: `Шаблон сохранён: ${m.name}, с ${fmtCsDate(from)}${moved ? ` · в календаре +${r.reconcile.created} / −${r.reconcile.deleted} ${blocksWord(moved)}` : ''}.`,
        tone: 'ok',
        conflicts: r.conflicts,
      }
    })
  }

  const templateMaster = panel?.kind === 'template' ? master(panel.personal) : null
  const legacyMaster = panel?.kind === 'legacy' ? master(panel.personal) : null
  const pendingCount = grid
    ? grid.masters.reduce((s, m) => s + Object.entries(m.days).filter(([d, c]) => c.request && d >= grid.today).length, 0)
    : 0

  return (
    <div className={pageShellCls + ' !max-w-[1400px]'}>
      <div className={kickerCls}>Команда</div>
      <h1 className={h1Cls}>График мастеров</h1>

      <div className={toolbarCardCls}>
        <div className="flex items-center gap-2">
          <button type="button" className={iconBtnCls} aria-label="Предыдущий месяц" onClick={() => goMonth(shiftMonth(month, -1))}>
            <ChevronLeft />
          </button>
          <span className="min-w-[96px] text-center text-[15px] font-extrabold text-ink" data-testid="month-label">
            {monthLabelRu(month)}
          </span>
          <button type="button" className={iconBtnCls} aria-label="Следующий месяц" onClick={() => goMonth(shiftMonth(month, 1))}>
            <ChevronRight />
          </button>
          <button type="button" className={btnNeutralCls} onClick={() => goMonth(todayYmd().slice(0, 7))}>
            Этот месяц
          </button>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-[12.5px] font-bold text-warn" data-testid="pending-count">
              ждут согласования: {pendingCount}
            </span>
          )}
          <button type="button" className={iconBtnCls} aria-label="Обновить" title="Обновить" disabled={loading} onClick={() => void load(month)}>
            <RefreshIcon className={loading ? 'animate-spin' : undefined} />
          </button>
        </div>
      </div>

      <p className={`${hintCls} m-0 mb-3`}>
        ✓ — работает весь день, «12–19» — часы, «—» — выходной. Розовая точка — исключение из шаблона, пунктир — предложение
        администратора, Б/О/Л — больничный / отпуск / личное, серый квадрат — другие блоки дня, «▪ блок» — день целиком закрыт блоками (записи нет).
        {grid?.horizon && <> Запись на сайте открыта до {fmtCsDate(grid.horizon)} — дальше блоки появятся сами.</>}
        {grid && !grid.canManage && <> Изменения, которые вы вносите, действуют после согласования руководства.</>}
      </p>

      {notice && (
        <div
          role="status"
          className={`mb-3 rounded-lg border px-3 py-2.5 text-[13px] font-semibold ${
            notice.tone === 'ok' ? 'border-pos-line bg-pos-bg text-pos' : 'border-neg-line bg-neg-bg text-neg'
          }`}
          data-testid="notice"
        >
          {notice.text}
          <ConflictList rows={notice.conflicts} title="Записи в нерабочем времени — блок их не отменил, перенесите в календаре:" />
        </div>
      )}

      {templateMaster && grid && (
        <TemplateEditor
          key={templateMaster.documentId + (templateMaster.schedule.updatedAt || '')}
          master={templateMaster}
          today={grid.today}
          busy={busy}
          onSave={onSaveTemplate}
          onClose={() => setPanel(null)}
        />
      )}
      {legacyMaster && (
        <LegacyPanel
          key={legacyMaster.documentId}
          personal={legacyMaster.documentId}
          name={legacyMaster.name}
          onClose={() => setPanel(null)}
          onDone={(deleted) => {
            setPanel(null)
            setNotice({ text: `Удалено старых блоков: ${deleted} (${legacyMaster.name}).`, tone: 'ok', conflicts: [] })
            void load(month)
          }}
        />
      )}

      {selMaster && selDates.length > 0 && grid && (
        <DayEditor
          key={selMaster.documentId + selDates.join(',')}
          master={selMaster}
          dates={selDates}
          canManage={grid.canManage}
          busy={busy}
          onSave={onSaveDays}
          onDecide={onDecide}
          onClear={() => setSelected(null)}
        />
      )}

      {error && (
        <div role="alert" className="mb-3 rounded-lg border border-neg-line bg-neg-bg px-3 py-2.5 text-[13px] font-semibold text-neg">
          Не удалось загрузить график: {error}
        </div>
      )}
      {!grid && loading && <p className={mutedCls}>Загрузка…</p>}
      {grid && grid.masters.length === 0 && <p className={mutedCls}>Нет мастеров с колонкой в календаре.</p>}
      {grid && grid.masters.length > 0 && (
        <ScheduleTable grid={grid} selected={selected} onCell={onCell} onTemplate={(p) => setPanel({ kind: 'template', personal: p })} />
      )}
      {grid && (
        <p className={`${hintCls} m-0 mt-2`}>
          Нажмите на день, чтобы изменить; Shift — выбрать диапазон дней одного мастера. Прошедшие дни не меняются.
        </p>
      )}
    </div>
  )
}
