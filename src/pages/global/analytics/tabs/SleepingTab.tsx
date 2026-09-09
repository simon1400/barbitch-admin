import { useState, useEffect, useCallback, useMemo } from 'react'
import { Cell } from '../../../dashboard/components/Cell'
import { StatSection } from '../../components/StatSection'
import { TableWrapper } from '../../components/TableWrapper'
import { Pagination } from '../../../../components/Pagination'
import { getSleepingCandidates, buildCsv, type SleepingClient } from '../fetch/sleepingClients'
import {
  buildLastSentMap,
  daysAwayLabel,
  fetchCampaignLogs,
  getCampaignResults,
  type CampaignRecipient,
  type CampaignResult,
  type SentInfo,
} from '../fetch/emailCampaign'

const DAY_OPTIONS = [60, 90, 120, 180, 365]
// Верхняя граница давности — чтобы разделить сегменты: «недавно уснули» (мягкое
// письмо-возврат) и «давно потеряны» (другая кампания). 0 = без ограничения.
const MAX_DAY_OPTIONS = [0, 120, 180, 365]
const VISIT_OPTIONS = [1, 2, 3, 5]
const PAGE_SIZE = 50

import { kcNum } from '../../../../utils/money'
import { SleepingRow } from './sleeping/SleepingRow'
import { CampaignRow } from './sleeping/CampaignRow'
import { SendModal } from './sleeping/SendModal'
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
  const [page, setPage] = useState(1)
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

  // Таблица рисуется страницами: без этого сотни строк перерисовывались
  // целиком на каждый клик по чекбоксу (аудит s184, п. 3.2).
  const pagedRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page],
  )

  // Смена фильтра меняет состав списка — страница 7 может перестать существовать.
  useEffect(() => {
    setPage(1)
  }, [minDays, maxDays, minVisits])

  const emailableRows = useMemo(() => rows.filter((r) => r.email), [rows])
  const allEmailableChecked =
    emailableRows.length > 0 && emailableRows.every((r) => visibleSelected.has(r.customerId))

  const toggleAll = () => {
    if (allEmailableChecked) setSelected(new Set())
    else setSelected(new Set(emailableRows.map((r) => r.customerId)))
  }

  // Стабильная ссылка (функциональный setState вместо замыкания на selected):
  // иначе каждая строка получала бы новый onToggle и memo не спасал бы от
  // перерисовки всей таблицы на один клик по чекбоксу.
  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

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
                  {kcNum(totalSpent)} Kč
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
                    {pagedRows.map((r) => (
                      <SleepingRow
                        key={r.customerId}
                        row={r}
                        sent={lastSent.get(r.customerId)}
                        checked={visibleSelected.has(r.customerId)}
                        onToggle={toggleOne}
                      />
                    ))}
                  </tbody>
                </table>
                <Pagination
                  page={page}
                  total={rows.length}
                  pageSize={PAGE_SIZE}
                  onPage={setPage}
                  unit={"клиентов"}
                />
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

