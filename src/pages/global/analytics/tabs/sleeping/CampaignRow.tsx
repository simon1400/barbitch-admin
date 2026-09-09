// Строка журнала рассылок. Перенесено из SleepingTab.tsx (этап 6) дословно.
import { Cell } from '../../../../dashboard/components/Cell'
import { kcNum } from '../../../../../utils/money'
import {
  CAMPAIGN_TEMPLATES,
  daysSinceIso,
  formatFilterParts,
  type CampaignResult,
} from '../../fetch/emailCampaign'
import { fmtDate, fmtDateTime } from './format'

export function CampaignRow({
  result,
  expanded,
  onToggle,
}: {
  result: CampaignResult
  expanded: boolean
  onToggle: () => void
}) {
  const { log, converted, pct } = result
  const templateName =
    CAMPAIGN_TEMPLATES.find((t) => t.key === log.template)?.name ?? log.template
  return (
    <>
      <tr className="hover:bg-surface-hover transition-colors cursor-pointer" onClick={onToggle}>
        <td className="p-4 border-b border-line-soft">
          <span className="flex items-center gap-2 font-sans text-sm font-medium text-ink">
            <span className="text-brand">{expanded ? '−' : '+'}</span>
            {fmtDateTime(log.createdAt)}
            <span className="text-xs text-ink-faint">({daysSinceIso(log.createdAt)} дн.)</span>
          </span>
        </td>
        <td className="p-4 border-b border-line-soft">
          <span className="block font-sans text-sm font-medium text-ink">
            {templateName}
          </span>
        </td>
        <td className="p-4 border-b border-line-soft">
          {log.filters ? (
            <span className="inline-flex flex-col gap-0.5 px-2 py-1 rounded text-xs font-semibold bg-line-soft text-ink-muted leading-tight whitespace-nowrap">
              {formatFilterParts(log.filters).map((part) => (
                <span key={part}>{part}</span>
              ))}
            </span>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </td>
        <Cell title={String(log.recipients.length)} />
        <td className="p-4 border-b border-line-soft">
          <span
            className={`px-2 py-0.5 rounded text-xs font-semibold ${
              converted.length > 0 ? 'bg-green-100 text-pos' : 'bg-line-soft text-ink-faint'
            }`}
          >
            {converted.length} ({pct} %)
          </span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="p-0 border-b border-line-soft bg-surface-tile">
            <div className="p-4">
              {converted.length === 0 ? (
                <div className="text-sm text-ink-soft">Пока никто не записался.</div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
                  <table className="w-full text-left min-w-[620px]">
                    <thead>
                      <tr>
                        <Cell title="Клиент" asHeader />
                        <Cell title="Email" asHeader />
                        <Cell title="Визитов" asHeader />
                        <Cell title="Последний визит" asHeader />
                        <Cell title="Принёс" asHeader />
                        <Cell title="Записалась на" asHeader />
                        <Cell title="Статус" asHeader />
                      </tr>
                    </thead>
                    <tbody>
                      {converted.map((c) => (
                        <tr key={c.customerId} className="hover:bg-surface-hover transition-colors">
                          <Cell title={c.name} className="font-medium" />
                          <Cell title={c.email || '—'} />
                          <Cell title={String(c.visits)} />
                          <td className="p-4 border-b border-line-soft">
                            {c.lastVisit ? (
                              <span className="block font-sans text-sm font-medium text-ink">
                                {fmtDate(c.lastVisit)}{' '}
                                <span className="text-xs text-ink-faint">({c.daysSince} дн.)</span>
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          <Cell title={`${kcNum(c.spent)} Kč`} className="text-brand" />
                          <Cell title={fmtDate(c.bookingDate)} />
                          <td className="p-4 border-b border-line-soft">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                c.attended
                                  ? 'bg-green-100 text-pos'
                                  : 'bg-info-bg text-info'
                              }`}
                            >
                              {c.attended ? 'уже была' : 'записана'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
