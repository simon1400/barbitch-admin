import { useState, useEffect, useCallback, useMemo } from 'react'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import { getSleepingCandidates, buildCsv, type SleepingClient } from '../fetch/sleepingClients'
import {
  CAMPAIGN_TEMPLATES,
  fetchCampaignLogs,
  buildLastSentMap,
  getCampaignResults,
  saveCampaignLog,
  sendBulkEmail,
  daysSinceIso,
  daysAwayLabel,
  formatFilterParts,
  type CampaignFilters,
  type CampaignRecipient,
  type CampaignResult,
  type SentInfo,
  type SendResult,
} from '../fetch/emailCampaign'

const DAY_OPTIONS = [60, 90, 120, 180, 365]
// Верхняя граница давности — чтобы разделить сегменты: «недавно уснули» (мягкое
// письмо-возврат) и «давно потеряны» (другая кампания). 0 = без ограничения.
const MAX_DAY_OPTIONS = [0, 120, 180, 365]
const VISIT_OPTIONS = [1, 2, 3, 5]
const SKIP_RECENT_OPTIONS = [0, 30, 60, 90] // не слать тем, кому писали недавно

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

const fmtMoney = (n: number) => n.toLocaleString('cs-CZ')

export default function SleepingTab() {
  const [all, setAll] = useState<SleepingClient[]>([])
  const [lastSent, setLastSent] = useState<Map<string, SentInfo>>(new Map())
  const [campaigns, setCampaigns] = useState<CampaignResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [minDays, setMinDays] = useState(90)
  const [maxDays, setMaxDays] = useState(0) // 0 = без ограничения
  const [minVisits, setMinVisits] = useState(2)
  const [copied, setCopied] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null)

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      const [clients, logs] = await Promise.all([
        getSleepingCandidates(force),
        fetchCampaignLogs().catch(() => []),
      ])
      setAll(clients)
      setLastSent(buildLastSentMap(logs))
      setCampaigns(await getCampaignResults(logs).catch(() => []))
    } catch {
      setError('Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(
    () =>
      all.filter(
        (c) =>
          c.daysSince >= minDays &&
          (maxDays === 0 || c.daysSince < maxDays) &&
          c.visits >= minVisits,
      ),
    [all, minDays, maxDays, minVisits],
  )

  // выбор живёт только внутри текущего фильтра
  const visibleSelected = useMemo(() => {
    const visible = new Set(rows.map((r) => r.customerId))
    return new Set([...selected].filter((id) => visible.has(id)))
  }, [rows, selected])

  const emailableRows = useMemo(() => rows.filter((r) => r.email), [rows])
  const allEmailableChecked =
    emailableRows.length > 0 && emailableRows.every((r) => visibleSelected.has(r.customerId))

  const toggleAll = () => {
    if (allEmailableChecked) setSelected(new Set())
    else setSelected(new Set(emailableRows.map((r) => r.customerId)))
  }

  const toggleOne = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const totalSpent = useMemo(() => rows.reduce((a, r) => a + r.spent, 0), [rows])
  const phones = useMemo(() => rows.map((r) => r.phone).filter(Boolean), [rows])

  const selectedRecipients: CampaignRecipient[] = useMemo(
    () =>
      rows
        .filter((r) => visibleSelected.has(r.customerId) && r.email)
        .map((r) => ({
          customerId: r.customerId,
          email: r.email,
          name: r.name,
          daysAway: daysAwayLabel(r.daysSince),
        })),
    [rows, visibleSelected],
  )

  const copyPhones = async () => {
    try {
      await navigator.clipboard.writeText(phones.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard может быть недоступен — некритично */
    }
  }

  const downloadCsv = () => {
    // BOM — чтобы Excel открыл CSV в UTF-8 с диакритикой
    const blob = new Blob(['﻿' + buildCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spici-klienti-${minDays}${maxDays ? `-${maxDays}` : ''}d.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="mb-6 flex justify-between items-center gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-ink-body">
            Не были более
            <select
              value={minDays}
              onChange={(e) => setMinDays(Number(e.target.value))}
              className="border border-line-btn rounded-lg px-3 py-2 bg-white shadow-sm text-sm"
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} дней
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-body">
            но менее
            <select
              value={maxDays}
              onChange={(e) => setMaxDays(Number(e.target.value))}
              className="border border-line-btn rounded-lg px-3 py-2 bg-white shadow-sm text-sm"
            >
              {MAX_DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? 'без лимита' : `${d} дней`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-body">
            Мин. визитов
            <select
              value={minVisits}
              onChange={(e) => setMinVisits(Number(e.target.value))}
              className="border border-line-btn rounded-lg px-3 py-2 bg-white shadow-sm text-sm"
            >
              {VISIT_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}+
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className="text-xs text-ink-faint">
          Клиенты без будущей брони · деньги = сумма цен состоявшихся визитов
        </span>
      </div>

      {campaigns.length > 0 && (
        <StatSection title="Результаты кампаний" id="campaign-results" defaultOpen>
          <p className="text-xs text-ink-faint mb-4">
            «Записались» = у получателя появилась активная бронь с датой ПОСЛЕ отправки письма
            (на момент отправки будущих броней не было — значит запись пришла после кампании).
            No-show не считается.
          </p>
          <TableWrapper>
            <table className="w-full text-left min-w-[620px]">
              <thead>
                <tr>
                  <Cell title="Отправлено" asHeader />
                  <Cell title="Шаблон" asHeader />
                  <Cell title="Фильтр" asHeader />
                  <Cell title="Получателей" asHeader />
                  <Cell title="Записались" asHeader />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <CampaignRow
                    key={c.log.documentId}
                    result={c}
                    expanded={expandedCampaign === c.log.documentId}
                    onToggle={() =>
                      setExpandedCampaign(
                        expandedCampaign === c.log.documentId ? null : c.log.documentId,
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </TableWrapper>
        </StatSection>
      )}

      <StatSection title="Спящие клиенты" id="sleeping-clients" defaultOpen>
        {loading ? (
          <div className="text-ink-soft py-8 text-center">Načítání…</div>
        ) : error ? (
          <div className="text-neg py-8 text-center">{error}</div>
        ) : (
          <>
            <div className="flex gap-4 flex-wrap mb-4">
              <div className="bg-white rounded-lg shadow-sm px-4 py-3">
                <div className="text-xs text-ink-faint">Спящих клиентов</div>
                <div className="text-2xl font-bold text-brand">{rows.length}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm px-4 py-3">
                <div className="text-xs text-ink-faint">Принесли всего</div>
                <div className="text-2xl font-bold text-ink">
                  {fmtMoney(totalSpent)} Kč
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm px-4 py-3">
                <div className="text-xs text-ink-faint">С телефоном</div>
                <div className="text-2xl font-bold text-ink">{phones.length}</div>
              </div>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  disabled={selectedRecipients.length === 0}
                  className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-40"
                >
                  Отправить email ({selectedRecipients.length})
                </button>
                <button
                  type="button"
                  onClick={copyPhones}
                  disabled={!phones.length}
                  className="px-4 py-2 rounded-lg border border-line-btn bg-white text-sm font-semibold shadow-sm hover:bg-surface-hover disabled:opacity-40"
                >
                  {copied ? 'Скопировано ✓' : 'Копировать телефоны'}
                </button>
                <button
                  type="button"
                  onClick={downloadCsv}
                  disabled={!rows.length}
                  className="px-4 py-2 rounded-lg border border-line-btn bg-white text-sm font-semibold shadow-sm hover:bg-surface-hover disabled:opacity-40"
                >
                  Экспорт CSV
                </button>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="text-ink-soft py-8 text-center">
                По выбранным фильтрам спящих клиентов нет.
              </div>
            ) : (
              <TableWrapper>
                <table className="w-full text-left min-w-[620px]">
                  <thead>
                    <tr>
                      <th className="p-4 border-b border-line bg-surface-tile w-10">
                        <input
                          type="checkbox"
                          checked={allEmailableChecked}
                          onChange={toggleAll}
                          className="w-4 h-4 accent-pink-600 cursor-pointer"
                          title="Выбрать всех с email"
                        />
                      </th>
                      <Cell title="Клиент" asHeader />
                      <Cell title="Телефон" asHeader />
                      <Cell title="Визитов" asHeader />
                      <Cell title="Последний визит" asHeader />
                      <Cell title="Мастер" asHeader />
                      <Cell title="Принёс" asHeader />
                      <Cell title="Писали" asHeader />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const sent = lastSent.get(r.customerId)
                      return (
                        <tr
                          key={r.customerId}
                          className={`hover:bg-surface-hover transition-colors ${
                            visibleSelected.has(r.customerId) ? 'bg-pink-50/50' : ''
                          }`}
                        >
                          <td className="p-4 border-b border-line-soft">
                            <input
                              type="checkbox"
                              checked={visibleSelected.has(r.customerId)}
                              onChange={() => toggleOne(r.customerId)}
                              disabled={!r.email}
                              className="w-4 h-4 accent-pink-600 cursor-pointer disabled:opacity-30"
                              title={r.email ? r.email : 'Нет email'}
                            />
                          </td>
                          <td className="p-4 border-b border-line-soft">
                            <span className="block font-sans text-sm font-medium text-ink">
                              {r.name}
                            </span>
                            {r.email && <span className="text-xs text-ink-faint">{r.email}</span>}
                          </td>
                          <Cell title={r.phone || '—'} />
                          <Cell title={String(r.visits)} />
                          <td className="p-4 border-b border-line-soft">
                            <span className="block font-sans text-sm font-medium text-ink">
                              {fmtDate(r.lastVisit)}{' '}
                              <span className="text-xs text-ink-faint">({r.daysSince} дн.)</span>
                            </span>
                          </td>
                          <Cell title={r.lastMaster || '—'} />
                          <Cell title={`${fmtMoney(r.spent)} Kč`} className="text-brand" />
                          <td className="p-4 border-b border-line-soft">
                            {sent ? (
                              <span
                                className="px-2 py-0.5 rounded text-xs font-semibold bg-info-bg text-info whitespace-nowrap"
                                title={`Шаблон: ${sent.template}`}
                              >
                                {fmtDateTime(sent.lastSentAt)} ({daysSinceIso(sent.lastSentAt)} дн.)
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </TableWrapper>
            )}
          </>
        )}
      </StatSection>

      {modalOpen && (
        <SendModal
          recipients={selectedRecipients}
          filters={{ minDays, maxDays, minVisits }}
          lastSent={lastSent}
          onClose={() => setModalOpen(false)}
          onSent={() => {
            setSelected(new Set())
            setModalOpen(false)
            load() // перечитать лог — колонка «Писали» обновится
          }}
        />
      )}
    </>
  )
}

function CampaignRow({
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
                          <Cell title={`${fmtMoney(c.spent)} Kč`} className="text-brand" />
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

function SendModal({
  recipients,
  filters,
  lastSent,
  onClose,
  onSent,
}: {
  recipients: CampaignRecipient[]
  filters: CampaignFilters
  lastSent: Map<string, SentInfo>
  onClose: () => void
  onSent: () => void
}) {
  const defaultExtras = (key: string): Record<string, string> => {
    const t = CAMPAIGN_TEMPLATES.find((x) => x.key === key)
    return Object.fromEntries((t?.extras ?? []).map((v) => [v.key, v.defaultValue]))
  }

  const [templateKey, setTemplateKey] = useState(CAMPAIGN_TEMPLATES[0].key)
  const [subject, setSubject] = useState(CAMPAIGN_TEMPLATES[0].subject)
  const [extras, setExtras] = useState<Record<string, string>>(() =>
    defaultExtras(CAMPAIGN_TEMPLATES[0].key),
  )
  const [skipRecentDays, setSkipRecentDays] = useState(30)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const template = CAMPAIGN_TEMPLATES.find((x) => x.key === templateKey)

  const onTemplateChange = (key: string) => {
    setTemplateKey(key)
    const t = CAMPAIGN_TEMPLATES.find((x) => x.key === key)
    if (t) setSubject(t.subject)
    setExtras(defaultExtras(key))
  }

  // защита от дублей: исключаем тех, кому писали недавно (любой шаблон)
  const { toSend, skipped } = useMemo(() => {
    if (skipRecentDays === 0) return { toSend: recipients, skipped: [] as CampaignRecipient[] }
    const send: CampaignRecipient[] = []
    const skip: CampaignRecipient[] = []
    for (const r of recipients) {
      const sent = lastSent.get(r.customerId)
      if (sent && daysSinceIso(sent.lastSentAt) < skipRecentDays) skip.push(r)
      else send.push(r)
    }
    return { toSend: send, skipped: skip }
  }, [recipients, lastSent, skipRecentDays])

  const handleSend = async () => {
    if (!toSend.length || sending) return
    if (!window.confirm(`Отправить «${subject}» на ${toSend.length} адресов?`)) return
    setSending(true)
    setSendError(null)
    try {
      const res = await sendBulkEmail(templateKey, subject, toSend, extras)
      // лог пишем ПОСЛЕ успешной отправки — иначе «защита от дублей» заблокирует ретрай
      try {
        await saveCampaignLog(templateKey, subject, toSend, filters)
      } catch {
        setSendError('Письма отправлены, но лог не записался — колонка «Писали» не обновится')
      }
      setResult(res)
    } catch (e) {
      setSendError((e as Error).message || 'Не удалось отправить')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={result ? onSent : onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-2xl font-bold text-ink mb-4">Отправка email-кампании</h3>

        {result ? (
          <>
            <div
              className={`p-4 rounded-lg border mb-4 ${
                result.failed === 0
                  ? 'bg-pos-bg border-pos-line text-green-800'
                  : 'bg-warn-bg border-amber-200 text-amber-800'
              }`}
            >
              Отправлено {result.successful} из {result.total}
              {result.failed > 0 && ` · не дошло: ${result.failed}`}
            </div>
            {sendError && <div className="text-sm text-neg mb-4">{sendError}</div>}
            <button
              type="button"
              onClick={onSent}
              className="px-6 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold shadow-sm hover:opacity-90"
            >
              Готово
            </button>
          </>
        ) : (
          <>
            <label className="block text-sm font-semibold text-ink-body mb-1">Шаблон</label>
            <select
              value={templateKey}
              onChange={(e) => onTemplateChange(e.target.value)}
              className="w-full border border-line-btn rounded-lg px-3 py-2.5 bg-white shadow-sm text-sm mb-4"
            >
              {CAMPAIGN_TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>

            <label className="block text-sm font-semibold text-ink-body mb-1">
              Предмет письма
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-line-btn rounded-lg px-3 py-2.5 shadow-sm text-sm mb-4"
            />

            {(template?.extras ?? []).map((v) => (
              <div key={v.key}>
                <label className="block text-sm font-semibold text-ink-body mb-1">{v.label}</label>
                <input
                  type="text"
                  value={extras[v.key] ?? ''}
                  onChange={(e) => setExtras({ ...extras, [v.key]: e.target.value })}
                  className="w-full border border-line-btn rounded-lg px-3 py-2.5 shadow-sm text-sm mb-4"
                />
              </div>
            ))}

            <label className="block text-sm font-semibold text-ink-body mb-1">
              Не слать, если уже писали за последние
            </label>
            <select
              value={skipRecentDays}
              onChange={(e) => setSkipRecentDays(Number(e.target.value))}
              className="w-full border border-line-btn rounded-lg px-3 py-2.5 bg-white shadow-sm text-sm mb-4"
            >
              {SKIP_RECENT_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? 'слать всем выбранным (без защиты)' : `${d} дней`}
                </option>
              ))}
            </select>

            <div className="bg-surface-tile rounded-lg p-3 text-sm text-ink-body mb-4">
              <div>
                Выбрано: <b>{recipients.length}</b>
              </div>
              {skipped.length > 0 && (
                <div className="text-warn">
                  Пропущено (недавно писали): <b>{skipped.length}</b>
                </div>
              )}
              <div>
                К отправке: <b className="text-brand">{toSend.length}</b>
              </div>
              {toSend.length > 0 && (
                <div className="text-xs text-ink-faint mt-2 break-words">
                  {toSend
                    .slice(0, 8)
                    .map((r) => r.email)
                    .join(', ')}
                  {toSend.length > 8 && ` … и ещё ${toSend.length - 8}`}
                </div>
              )}
            </div>

            {sendError && <div className="text-sm text-neg mb-4">{sendError}</div>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || toSend.length === 0}
                className="px-6 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-40"
              >
                {sending ? 'Отправка…' : `Отправить (${toSend.length})`}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="px-6 py-2.5 rounded-lg border border-line-btn bg-white text-sm font-semibold shadow-sm hover:bg-surface-hover"
              >
                Отмена
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
