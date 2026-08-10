// Модуль «Дубли клиентов» (/global/client-duplicates, owner + administrator):
// группы дублей (надёжные = общий e-mail/телефон; вероятные = одинаковое полное
// имя), слияние карточек с переносом броней/лояльности, правка контактов
// с распространением имени на брони календаря, синхронизация блэклиста,
// «не дубли» (скрыть группу), история операций.

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Container } from '../../components/Container'
import { OwnerProtection } from './components/OwnerProtection'
import type { ClientPatch, DedupeGroupsResponse, DupClient, DupGroup, MergeLogEntry } from './fetch/clientDedupe'
import {
  fetchDuplicateGroups,
  fetchMergeHistory,
  ignoreGroup,
  mergeClients,
  setGroupBlacklist,
  unignoreGroup,
  updateClientContacts,
} from './fetch/clientDedupe'

type Tab = 'strong' | 'weak' | 'conflicts' | 'ignored'

const REASON_LABEL: Record<string, string> = { name: 'имя', email: 'e-mail', phone: 'телефон' }

const PAGE_SIZE = 10

const fmtDay = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Неизвестная ошибка')

// ── строка клиента внутри группы ──

function ClientRow({
  c,
  isPrimary,
  checked,
  onPrimary,
  onCheck,
  onSaved,
}: {
  c: DupClient
  isPrimary: boolean
  checked: boolean
  onPrimary: () => void
  onCheck: (v: boolean) => void
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(c.name)
  const [phone, setPhone] = useState(c.phone || '')
  const [email, setEmail] = useState(c.email || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const dirty = name !== c.name || phone !== (c.phone || '') || email !== (c.email || '')

  const save = async () => {
    if (!dirty) {
      setEditing(false)
      return
    }
    const renameBookings =
      name !== c.name && c.bookings > 0
        ? window.confirm(`Обновить имя «${name}» и во всех ${c.bookings} бронях календаря?`)
        : true
    setSaving(true)
    setErr(null)
    try {
      const patch: ClientPatch = {}
      if (name !== c.name) patch.name = name
      if (phone !== (c.phone || '')) patch.phone = phone || null
      if (email !== (c.email || '')) patch.email = email || null
      await updateClientContacts(c.documentId, patch, renameBookings)
      setEditing(false)
      onSaved()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none'

  return (
    <div
      className={`rounded-lg border p-3 ${
        isPrimary ? 'border-primary bg-pink-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className={'flex flex-wrap items-start gap-3'}>
        {/* выбор главной / чекбокс слияния */}
        <div className={'flex flex-col items-center gap-2 pt-1'}>
          <label className={'flex cursor-pointer items-center gap-1 text-[11px] text-gray-500'} title={'Главная карточка — в неё сольются остальные'}>
            <input type={'radio'} checked={isPrimary} onChange={onPrimary} className={'accent-[#e71e6e]'} />
            главная
          </label>
          <label className={'flex cursor-pointer items-center gap-1 text-[11px] text-gray-500'} title={'Слить эту карточку в главную'}>
            <input
              type={'checkbox'}
              checked={checked}
              disabled={isPrimary}
              onChange={(e) => onCheck(e.target.checked)}
              className={'accent-[#e71e6e] disabled:opacity-30'}
            />
            слить
          </label>
        </div>

        <div className={'min-w-0 flex-1'}>
          {editing ? (
            <div className={'grid gap-2 sm:grid-cols-3'}>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={'Jméno'} />
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={'Telefon'} />
              <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={'E-mail'} />
            </div>
          ) : (
            <>
              <div className={'flex flex-wrap items-center gap-2'}>
                <span className={'font-semibold text-gray-900'}>{c.name}</span>
                {c.blacklisted && (
                  <span className={'rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700'}>⛔ blacklist</span>
                )}
                {c.emailVerifiedAt && (
                  <span className={'rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700'} title={'Зарегистрирована в кабинете'}>кабинет</span>
                )}
                <span className={'text-[11px] text-gray-400'}>id={c.id} · {c.source || '—'}</span>
              </div>
              <div className={'mt-0.5 text-sm text-gray-600'}>
                {c.phone || '— телефон —'} · {c.email || '— e-mail —'}
              </div>
            </>
          )}
          <div className={'mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500'}>
            <span>броней: <b className={'text-gray-800'}>{c.bookings}</b></span>
            <span>посл. визит: {fmtDay(c.lastVisit)}</span>
            {c.futureActive > 0 && (
              <span className={'font-semibold text-amber-600'}>будущих активных: {c.futureActive}</span>
            )}
            {c.loyaltyTx > 0 && <span>лояльность: {c.loyaltyTx} tx</span>}
            {c.redemptions > 0 && <span>награды: {c.redemptions}</span>}
          </div>
          {err && <div className={'mt-1 text-xs text-red-600'}>{err}</div>}
        </div>

        <div className={'flex shrink-0 gap-1.5'}>
          {editing ? (
            <>
              <button
                onClick={save}
                disabled={saving}
                className={'rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-50'}
              >
                {saving ? 'Ukládám…' : 'Uložit'}
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setName(c.name)
                  setPhone(c.phone || '')
                  setEmail(c.email || '')
                  setErr(null)
                }}
                className={'rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-600'}
              >
                Zrušit
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className={'rounded-lg border border-pink-300 bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm hover:bg-pink-50'}
              title={'Изменить имя/телефон/e-mail. Имя обновится и в бронях календаря.'}
            >
              Upravit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── карточка группы ──

function GroupCard({
  group,
  isIgnoredTab,
  onChanged,
}: {
  group: DupGroup
  isIgnoredTab: boolean
  onChanged: () => void
}) {
  const [primaryDoc, setPrimaryDoc] = useState(group.clients[0]?.documentId || '')
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(group.clients.slice(1).map((c) => c.documentId))
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const docIds = group.clients.map((c) => c.documentId)
  const primary = group.clients.find((c) => c.documentId === primaryDoc)
  const mergeList = [...selected].filter((d) => d !== primaryDoc)

  const run = async (label: string, fn: () => Promise<unknown>, doneMsg?: string) => {
    setBusy(label)
    setErr(null)
    try {
      await fn()
      if (doneMsg) setDone(doneMsg)
      onChanged()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  const doMerge = () => {
    if (!primary || mergeList.length === 0) return
    const names = group.clients
      .filter((c) => mergeList.includes(c.documentId))
      .map((c) => `«${c.name}» (${c.bookings} broней)`)
      .join(', ')
    if (
      !window.confirm(
        `Слить ${names} в карточку «${primary.name}»?\n\nВсе брони, лояльность и награды переедут на главную, дубли будут УДАЛЕНЫ. Отменить нельзя.`
      )
    )
      return
    void run('merge', () => mergeClients(primaryDoc, mergeList), 'Слито ✓')
  }

  const doBlacklist = (v: boolean) => {
    const q = v
      ? `Добавить все ${group.clients.length} карточки группы в blacklist?`
      : `Убрать все ${group.clients.length} карточки группы из blacklistu?`
    if (!window.confirm(q)) return
    const reason = v ? group.clients.find((c) => c.blacklistReason)?.blacklistReason || undefined : undefined
    void run('bl', () => setGroupBlacklist(docIds, v, reason))
  }

  const doIgnore = () => {
    if (!window.confirm('Пометить группу как «не дубли»? Она скроется из списка (вернуть можно в табе «Скрытые»).')) return
    void run('ignore', () => ignoreGroup(docIds))
  }

  const doUnignore = () => void run('unignore', () => unignoreGroup(group.key))

  const anyBl = group.clients.some((c) => c.blacklisted)

  return (
    <div className={'rounded-xl border border-gray-200 bg-white p-4 shadow-sm'}>
      <div className={'mb-3 flex flex-wrap items-center gap-2'}>
        <span className={'text-base font-bold text-gray-900'}>{group.clients[0]?.name}</span>
        <span className={'rounded bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600'}>
          {group.clients.length} записи · совпало: {group.matchedOn.map((m) => REASON_LABEL[m]).join(' + ') || '—'}
        </span>
        {group.tier === 'weak' && (
          <span className={'rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700'} title={'Совпадает только имя — контакты разные. Может быть два разных человека!'}>
            проверить вручную
          </span>
        )}
        {group.blacklistConflict && (
          <span className={'rounded bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700'} title={'Часть карточек в блэклисте, часть нет — клиент может бронировать через незаблокированную'}>
            ⚠ дыра в blacklistu
          </span>
        )}
        {group.futureActive > 0 && (
          <span className={'rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700'}>
            будущие брони: {group.futureActive}
          </span>
        )}
      </div>

      <div className={'flex flex-col gap-2'}>
        {group.clients.map((c) => (
          <ClientRow
            key={c.documentId}
            c={c}
            isPrimary={c.documentId === primaryDoc}
            checked={selected.has(c.documentId) && c.documentId !== primaryDoc}
            onPrimary={() => {
              setPrimaryDoc(c.documentId)
              setSelected((prev) => {
                const next = new Set(prev)
                next.delete(c.documentId)
                for (const d of docIds) if (d !== c.documentId) next.add(d)
                return next
              })
            }}
            onCheck={(v) =>
              setSelected((prev) => {
                const next = new Set(prev)
                if (v) next.add(c.documentId)
                else next.delete(c.documentId)
                return next
              })
            }
            onSaved={onChanged}
          />
        ))}
      </div>

      {err && <div className={'mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700'}>{err}</div>}
      {done && !err && <div className={'mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700'}>{done}</div>}

      <div className={'mt-3 flex flex-wrap items-center gap-2'}>
        {isIgnoredTab ? (
          <button
            onClick={doUnignore}
            disabled={busy !== null}
            className={'rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50'}
          >
            {busy === 'unignore' ? '…' : '↩ Вернуть в список'}
          </button>
        ) : (
          <>
            <button
              onClick={doMerge}
              disabled={busy !== null || mergeList.length === 0}
              className={'rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50'}
              title={'Брони/лояльность/награды выбранных переедут на главную, дубли удалятся, имя обновится в календаре'}
            >
              {busy === 'merge' ? 'Sloučuji…' : `Слить выбранные (${mergeList.length}) → главная`}
            </button>
            <button
              onClick={() => doBlacklist(!anyBl)}
              disabled={busy !== null}
              className={'rounded-lg border border-red-300 bg-white px-4 py-1.5 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50'}
            >
              {busy === 'bl' ? '…' : anyBl ? '⛔ Снять blacklist со всех' : '⛔ Blacklist всем'}
            </button>
            <button
              onClick={doIgnore}
              disabled={busy !== null}
              className={'ml-auto rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-50'}
              title={'Это разные люди (семья/общий телефон) — скрыть группу из списка'}
            >
              {busy === 'ignore' ? '…' : 'Не дубли — скрыть'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── пагинация ──

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (pageCount <= 1) return null
  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)
  const btn = 'px-3 py-1 rounded-lg border border-gray-300 bg-white shadow-sm text-sm disabled:opacity-40'
  return (
    <div className={'mt-4 flex items-center justify-between text-sm'}>
      <span className={'text-gray-500'}>
        {from}–{to} из {total} групп
      </span>
      <div className={'flex items-center gap-2'}>
        <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ← Назад
        </button>
        <span className={'text-gray-600'}>
          {page} / {pageCount}
        </span>
        <button className={btn} disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          Дальше →
        </button>
      </div>
    </div>
  )
}

// ── история ──

function HistorySection() {
  const [logs, setLogs] = useState<MergeLogEntry[] | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open && logs === null) {
      fetchMergeHistory(50)
        .then(setLogs)
        .catch(() => setLogs([]))
    }
  }, [open, logs])

  return (
    <div className={'mt-8'}>
      <button onClick={() => setOpen((v) => !v)} className={'text-sm font-semibold text-gray-500 hover:text-primary'}>
        {open ? '▾' : '▸'} История операций
      </button>
      {open && (
        <div className={'mt-2 flex flex-col gap-1.5'}>
          {logs === null && <p className={'text-sm text-gray-400'}>Загрузка…</p>}
          {logs?.length === 0 && <p className={'text-sm text-gray-400'}>Пока пусто</p>}
          {logs?.map((l) => (
            <div key={l.documentId} className={'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm'}>
              <span className={'font-semibold text-gray-800'}>
                {l.action === 'merge' ? 'Слияние' : 'Правка/blacklist'}
              </span>
              {l.primaryName && <span className={'text-gray-700'}> · {l.primaryName}</span>}
              {l.action === 'merge' && Array.isArray(l.mergedDocIds) && (
                <span className={'text-gray-500'}> · слито карточек: {l.mergedDocIds.length}</span>
              )}
              <span className={'float-right text-xs text-gray-400'}>
                {new Date(l.createdAt).toLocaleString('cs-CZ')} · {l.actorName || '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── страница ──

const ClientDuplicatesPage = () => {
  const [data, setData] = useState<DedupeGroupsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('strong')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchDuplicateGroups())
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const groups = useMemo(() => {
    if (!data) return []
    let list: DupGroup[]
    if (tab === 'strong') list = data.strong
    else if (tab === 'weak') list = data.weak
    else if (tab === 'conflicts') list = [...data.strong, ...data.weak].filter((g) => g.blacklistConflict)
    else list = data.ignored
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((g) =>
      g.clients.some(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, ''))
      )
    )
  }, [data, tab, search])

  // смена таба/поиска → на первую страницу; после reload держимся в границах
  useEffect(() => {
    setPage(1)
  }, [tab, search])
  const pageCount = Math.max(1, Math.ceil(groups.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageGroups = useMemo(
    () => groups.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [groups, safePage]
  )
  const gotoPage = (p: number) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const s = data?.stats
  const tabBtn = (t: Tab, label: string, count?: number) => (
    <button
      onClick={() => setTab(t)}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold shadow-sm ${
        tab === t ? 'bg-primary text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`ml-1.5 rounded-full px-1.5 text-xs ${tab === t ? 'bg-white/25' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
      )}
    </button>
  )

  return (
    <OwnerProtection allowAdministrator>
      <Container size={'lg'}>
        <div className={'py-6'}>
          <div className={'mb-1 flex flex-wrap items-center justify-between gap-3'}>
            <h2 className={'text-2xl font-bold text-gray-900'}>Дубли клиентов</h2>
            <button
              onClick={() => void load()}
              disabled={loading}
              className={'rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50'}
            >
              {loading ? 'Načítám…' : '↻ Обновить'}
            </button>
          </div>
          <p className={'mb-4 text-sm text-gray-500'}>
            Слияние переносит брони, лояльность и награды на главную карточку и удаляет дубли; имя
            клиента обновляется во всех бронях календаря. Действие необратимо.
          </p>

          {s && (
            <div className={'mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4'}>
              {[
                { label: 'Групп дублей', value: s.strongGroups + s.weakGroups },
                { label: 'Лишних карточек', value: s.extraRecords },
                { label: 'Дыры в blacklistu', value: s.blacklistConflicts, warn: s.blacklistConflicts > 0 },
                { label: 'С будущими бронями', value: s.withFutureBookings },
              ].map((card) => (
                <div key={card.label} className={`rounded-xl border p-3 shadow-sm ${card.warn ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                  <div className={`text-xl font-bold ${card.warn ? 'text-red-600' : 'text-gray-900'}`}>{card.value}</div>
                  <div className={'text-xs text-gray-500'}>{card.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className={'mb-4 flex flex-wrap items-center gap-2'}>
            {tabBtn('strong', 'Надёжные', data?.stats.strongGroups)}
            {tabBtn('weak', 'Вероятные', data?.stats.weakGroups)}
            {tabBtn('conflicts', '⚠ Blacklist', data?.stats.blacklistConflicts)}
            {tabBtn('ignored', 'Скрытые', data?.stats.ignoredGroups)}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={'Поиск: имя / e-mail / телефон'}
              className={'ml-auto w-64 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none'}
            />
          </div>

          {tab === 'strong' && (
            <p className={'mb-3 text-xs text-gray-500'}>Записи связаны общим e-mail или телефоном — почти наверняка один человек.</p>
          )}
          {tab === 'weak' && (
            <p className={'mb-3 text-xs text-amber-600'}>
              Совпадает только полное имя, контакты разные. Может быть два РАЗНЫХ человека — сливайте только если уверены; иначе «Не дубли — скрыть».
            </p>
          )}

          {error && (
            <div className={'mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700'}>
              {error}
              <button onClick={() => void load()} className={'ml-3 font-semibold underline'}>Zkusit znovu</button>
            </div>
          )}

          {loading && !data && <p className={'py-10 text-center text-gray-400'}>Hledám duplicity… (pár sekund)</p>}

          {!loading && data && groups.length === 0 && (
            <p className={'py-10 text-center text-gray-400'}>
              {search ? 'Ничего не найдено' : tab === 'ignored' ? 'Скрытых групп нет' : '🎉 Дублей нет'}
            </p>
          )}

          <div className={'flex flex-col gap-4'}>
            {pageGroups.map((g) => (
              <GroupCard key={g.key} group={g} isIgnoredTab={tab === 'ignored'} onChanged={() => void load()} />
            ))}
          </div>

          <Pagination page={safePage} total={groups.length} onPage={gotoPage} />

          <HistorySection />
        </div>
      </Container>
    </OwnerProtection>
  )
}

export default ClientDuplicatesPage
