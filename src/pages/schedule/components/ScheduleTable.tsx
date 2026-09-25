// Сетка «мастера × дни месяца». Клетка — эффективный день плана (шаблон или
// исключение) + отметки: предложение администратора, отпуск, прочие блоки, брони.
// Прошедшие дни и дни за окном записи только показываются.
import { colHeadCls } from '../../../ui/kit'
import { DOW_RU_SHORT, dowOfYmd } from '../../../utils/date'
import {
  TIME_OFF_SHORT,
  TIME_OFF_WORDS,
  cellText,
  dayWords,
  fmtMin,
  type GridCell,
  type ScheduleGrid,
} from '../fetch/schedule'

interface Props {
  grid: ScheduleGrid
  selected: { personal: string; dates: Set<string> } | null
  onCell: (personal: string, date: string, e: { shiftKey: boolean }) => void
  onTemplate: (personal: string) => void
}

const cellTitle = (name: string, date: string, c: GridCell): string => {
  const lines = [`${name} · ${date.slice(8, 10)}.${date.slice(5, 7)} — ${dayWords(c)}`]
  if (c.source === 'override') lines.push(`исключение${c.override?.by ? ` (${c.override.by})` : ''}${c.override?.note ? `: ${c.override.note}` : ''}`)
  if (c.source === 'template') lines.push('по шаблону')
  if (c.request) lines.push(`⏳ предложение: ${dayWords(c.request)}${c.request.by ? ` — ${c.request.by}` : ''}${c.request.note ? ` (${c.request.note})` : ''}`)
  if (c.timeOff) lines.push(`🏖 ${TIME_OFF_WORDS[c.timeOff] || c.timeOff}`)
  for (const b of c.blocks) lines.push(`▪ ${b.title} ${fmtMin(b.startMin)}–${fmtMin(b.endMin)}`)
  if (c.bookings) lines.push(`записей: ${c.bookings}`)
  return lines.join('\n')
}

/**
 * День, который по плану рабочий, но целиком закрыт другими блоками (старая серия
 * «Blokace», отпуск, ручной блок): на сайте записи нет — показываем серым, иначе
 * «✓» вводил бы в заблуждение.
 */
const closedByBlocks = (c: GridCell, openMin: number | null, closeMin: number | null): boolean => {
  if (c.state === 'off' || openMin == null || closeMin == null || !c.blocks.length) return false
  let at = openMin
  for (const b of [...c.blocks].sort((x, y) => x.startMin - y.startMin)) {
    if (b.startMin > at) break
    if (b.endMin > at) at = b.endMin
  }
  return at >= closeMin
}

const stateCls = (c: GridCell, blocked: boolean): string => {
  if (blocked) return 'bg-surface-muted text-ink-muted'
  if (c.state === 'off') return 'bg-surface-muted text-ink-soft'
  if (c.state === 'hours') return 'bg-warn-bg text-warn'
  return 'bg-pos-bg text-pos'
}

export function ScheduleTable({ grid, selected, onCell, onTemplate }: Props) {
  const { today, horizon } = grid
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white" data-testid="schedule-grid">
      <table className="border-separate border-spacing-0 text-[12px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left">
              <span className={colHeadCls}>Мастер</span>
            </th>
            {grid.dates.map(({ date }) => {
              const dow = dowOfYmd(date)
              const weekend = dow === 0 || dow === 6
              return (
                <th
                  key={date}
                  className={`px-0.5 py-1.5 text-center font-bold ${date === today ? 'text-brand-dark' : weekend ? 'text-ink-muted' : 'text-ink-label'}`}
                >
                  <div className="text-[10px] font-bold uppercase">{DOW_RU_SHORT[dow]}</div>
                  <div className="text-[12px] font-extrabold">{Number(date.slice(8, 10))}</div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {grid.masters.map((m) => (
            <tr key={m.documentId} data-master={m.documentId}>
              <th className="sticky left-0 z-10 border-t border-line-soft bg-white px-3 py-1.5 text-left align-middle">
                <div className="max-w-[150px] truncate text-[13px] font-bold text-ink" title={m.name}>
                  {m.name}
                </div>
                {grid.canManage ? (
                  <button
                    type="button"
                    className="mt-0.5 text-[11px] font-bold text-brand-dark underline"
                    onClick={() => onTemplate(m.documentId)}
                    data-testid="open-template"
                  >
                    {m.schedule.templates.length ? 'шаблон недели' : 'задать шаблон'}
                  </button>
                ) : (
                  !m.schedule.templates.length && <div className="mt-0.5 text-[11px] font-semibold text-ink-faint">шаблона нет</div>
                )}
              </th>
              {grid.dates.map(({ date, openMin, closeMin }) => {
                const c = m.days[date]
                if (!c) return <td key={date} />
                const blocked = closedByBlocks(c, openMin, closeMin)
                const past = date < today
                const beyond = !!horizon && date > horizon
                const sel = selected?.personal === m.documentId && selected.dates.has(date)
                const hasBlocks = c.blocks.length > 0
                return (
                  <td key={date} className="border-t border-line-soft p-[2px]">
                    <button
                      type="button"
                      disabled={past}
                      onClick={(e) => onCell(m.documentId, date, { shiftKey: e.shiftKey })}
                      title={`${cellTitle(m.name, date, c)}${blocked ? '\nдень целиком закрыт блоками — записи нет' : ''}`}
                      data-date={date}
                      data-state={c.state}
                      data-blocked={blocked ? '1' : undefined}
                      data-source={c.source}
                      data-request={c.request ? c.request.state : undefined}
                      aria-pressed={sel}
                      className={[
                        'relative flex h-[38px] w-[42px] flex-col items-center justify-center rounded-md text-[11px] font-bold leading-tight',
                        stateCls(c, blocked),
                        past ? 'opacity-40 cursor-default' : 'cursor-pointer hover:ring-1 hover:ring-brand-line',
                        beyond && !past ? 'opacity-60' : '',
                        c.request ? 'outline-dashed outline-2 outline-warn -outline-offset-2' : '',
                        sel ? 'ring-2 ring-brand' : '',
                      ].join(' ')}
                    >
                      <span>{blocked ? '▪ блок' : cellText(c)}</span>
                      {c.bookings > 0 && <span className="text-[9.5px] font-semibold opacity-80">{c.bookings} зап.</span>}
                      {c.source === 'override' && (
                        <span className="absolute left-[3px] top-[3px] h-[5px] w-[5px] rounded-full bg-brand" data-mark="override" />
                      )}
                      {c.timeOff && (
                        <span className="absolute right-[2px] top-[1px] text-[9px] font-extrabold text-info" data-mark="timeoff">
                          {TIME_OFF_SHORT[c.timeOff] || '•'}
                        </span>
                      )}
                      {hasBlocks && (
                        <span className="absolute bottom-[2px] right-[3px] h-[5px] w-[5px] rounded-sm bg-ink-soft" data-mark="blocks" />
                      )}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
