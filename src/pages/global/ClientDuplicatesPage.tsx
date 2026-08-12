// Модуль «Дубли клиентов» (/global/client-duplicates, owner + administrator):
// группы дублей (надёжные = общий e-mail/телефон; вероятные = одинаковое полное
// имя), слияние карточек с переносом броней/лояльности, правка контактов
// с распространением имени на брони календаря, синхронизация блэклиста,
// «не дубли» (скрыть группу), история операций.

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  btnDangerCls,
  btnNeutralCls,
  btnPinkCls,
  cardPadCls,
  hintCls,
  inputCls,
  kickerCls,
  mutedCls,
  pageShellCls,
  pillCls,
  rowInputCls,
  tileCls,
  tileLabelCls,
  tileValueCls,
  tileValueNegCls,
} from '../../ui/kit'
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

// чипы-бейджи (11px/700)
const chipInfoCls = 'text-[11px] font-bold rounded-md px-[7px] py-0.5 text-ink-muted bg-surface-input'
const chipWarnCls = 'text-[11px] font-bold rounded-md px-[7px] py-0.5 text-warn bg-warn-bg'
const chipDangerCls = 'text-[11px] font-bold rounded-md px-[7px] py-0.5 text-neg bg-neg-bg'
const chipPosCls = 'text-[11px] font-bold rounded-md px-[7px] py-0.5 text-pos bg-pos-bg'

const flashOkCls = 'rounded-lg bg-pos-bg text-pos text-[13px] font-semibold px-4 py-2.5'
const flashErrCls = 'rounded-lg bg-neg-bg text-neg text-[13px] font-semibold px-4 py-2.5'

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

  return (
    <div
      className={`px-3 py-2.5 ${
        isPrimary
          ? 'rounded-lg border border-brand-line-soft bg-brand-card'
          : 'border-t border-line-soft first:border-t-0'
      }`}
    >
      <div className={'flex flex-wrap items-start gap-3'}>
        {/* выбор главной / чекбокс слияния */}
        <div className={'flex flex-col items-center gap-2 pt-1'}>
          <label className={'flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-ink-soft'} title={'Главная карточка — в неё сольются остальные'}>
            <input type={'radio'} checked={isPrimary} onChange={onPrimary} className={'accent-brand'} />
            главная
          </label>
          <label className={'flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-ink-soft'} title={'Слить эту карточку в главную'}>
            <input
              type={'checkbox'}
              checked={checked}
              disabled={isPrimary}
              onChange={(e) => onCheck(e.target.checked)}
              className={'accent-brand disabled:opacity-30'}
            />
            слить
          </label>
        </div>

        <div className={'min-w-0 flex-1'}>
          {editing ? (
            <div className={'grid gap-2 sm:grid-cols-3'}>
              <input className={rowInputCls + ' w-full'} value={name} onChange={(e) => setName(e.target.value)} placeholder={'Jméno'} />
              <input className={rowInputCls + ' w-full'} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={'Telefon'} />
              <input className={rowInputCls + ' w-full'} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={'E-mail'} />
            </div>
          ) : (
            <>
              <div className={'flex flex-wrap items-center gap-2'}>
                <span className={'text-[14px] font-bold text-ink'}>{c.name}</span>
                {c.blacklisted && (
                  <span className={chipDangerCls}>⛔ blacklist</span>
                )}
                {c.emailVerifiedAt && (
                  <span className={chipPosCls} title={'Зарегистрирована в кабинете'}>кабинет</span>
                )}
                <span className={'text-[11px] font-medium text-ink-label'}>id={c.id} · {c.source || '—'}</span>
              </div>
              <div className={'mt-0.5 text-[13px] font-semibold text-ink-muted'}>
                {c.phone || '— телефон —'} · {c.email || '— e-mail —'}
              </div>
            </>
          )}
          <div className={'mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] font-medium text-ink-soft'}>
            <span>броней: <b className={'font-bold text-ink-body'}>{c.bookings}</b></span>
            <span>посл. визит: {fmtDay(c.lastVisit)}</span>
            {c.futureActive > 0 && (
              <span className={'font-bold text-warn'}>будущих активных: {c.futureActive}</span>
            )}
            {c.loyaltyTx > 0 && <span>лояльность: {c.loyaltyTx} tx</span>}
            {c.redemptions > 0 && <span>награды: {c.redemptions}</span>}
          </div>
          {err && <div className={'mt-1 text-[12px] font-semibold text-neg'}>{err}</div>}
        </div>

        <div className={'flex shrink-0 gap-1.5'}>
          {editing ? (
            <>
              <button onClick={save} disabled={saving} className={btnPinkCls}>
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
                className={btnNeutralCls}
              >
                Zrušit
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className={btnNeutralCls}
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
    <div className={cardPadCls}>
      <div className={'mb-3 flex flex-wrap items-center gap-2'}>
        <span className={'text-[15px] font-extrabold text-ink'}>{group.clients[0]?.name}</span>
        <span className={chipInfoCls}>
          {group.clients.length} записи · совпало: {group.matchedOn.map((m) => REASON_LABEL[m]).join(' + ') || '—'}
        </span>
        {group.tier === 'weak' && (
          <span className={chipWarnCls} title={'Совпадает только имя — контакты разные. Может быть два разных человека!'}>
            проверить вручную
          </span>
        )}
        {group.blacklistConflict && (
          <span className={chipDangerCls} title={'Часть карточек в блэклисте, часть нет — клиент может бронировать через незаблокированную'}>
            ⚠ дыра в blacklistu
          </span>
        )}
        {group.futureActive > 0 && (
          <span className={chipWarnCls}>
            будущие брони: {group.futureActive}
          </span>
        )}
      </div>

      <div className={'flex flex-col'}>
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

      {err && <div className={'mt-2 ' + flashErrCls}>{err}</div>}
      {done && !err && <div className={'mt-2 ' + flashOkCls}>{done}</div>}

      <div className={'mt-4 flex flex-wrap items-center gap-2'}>
        {isIgnoredTab ? (
          <button onClick={doUnignore} disabled={busy !== null} className={btnNeutralCls}>
            {busy === 'unignore' ? '…' : '↩ Вернуть в список'}
          </button>
        ) : (
          <>
            <button
              onClick={doMerge}
              disabled={busy !== null || mergeList.length === 0}
              className={btnPinkCls}
              title={'Брони/лояльность/награды выбранных переедут на главную, дубли удалятся, имя обновится в календаре'}
            >
              {busy === 'merge' ? 'Sloučuji…' : `Слить выбранные (${mergeList.length}) → главная`}
            </button>
            <button
              onClick={() => doBlacklist(!anyBl)}
              disabled={busy !== null}
              className={anyBl ? btnNeutralCls : btnDangerCls}
            >
              {busy === 'bl' ? '…' : anyBl ? '⛔ Снять blacklist со всех' : '⛔ Blacklist всем'}
            </button>
            <button
              onClick={doIgnore}
              disabled={busy !== null}
              className={btnNeutralCls + ' ml-auto'}
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
  return (
    <div className={'mt-4 flex items-center justify-between'}>
      <span className={mutedCls}>
        {from}–{to} из {total} групп
      </span>
      <div className={'flex items-center gap-2'}>
        <button className={btnNeutralCls} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ← Назад
        </button>
        <span className={'text-[13px] font-semibold text-ink-muted'}>
          {page} / {pageCount}
        </span>
        <button className={btnNeutralCls} disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
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
      <button
        onClick={() => setOpen((v) => !v)}
        className={'text-[13px] font-bold text-ink-soft transition-colors hover:text-brand'}
      >
        {open ? '▾' : '▸'} История операций
      </button>
      {open && (
        <div className={cardPadCls + ' mt-2.5'}>
          {logs === null && <p className={'m-0 text-[12.5px] font-semibold text-ink-faint'}>Загрузка…</p>}
          {logs?.length === 0 && <p className={'m-0 text-[12.5px] font-semibold text-ink-faint'}>Пока пусто</p>}
          {logs?.map((l, i) => (
            <div
              key={l.documentId}
              className={
                'py-2 text-[12.5px] font-semibold text-ink-muted' +
                (i > 0 ? ' border-t border-line-soft' : '')
              }
            >
              <span className={'font-bold text-ink-body'}>
                {l.action === 'merge' ? 'Слияние' : 'Правка/blacklist'}
              </span>
              {l.primaryName && <span> · {l.primaryName}</span>}
              {l.action === 'merge' && Array.isArray(l.mergedDocIds) && (
                <span className={'text-ink-hint'}> · слито карточек: {l.mergedDocIds.length}</span>
              )}
              <span className={'float-right text-[11px] font-semibold text-ink-label'}>
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
    <button onClick={() => setTab(t)} className={pillCls(tab === t)}>
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={`ml-1.5 rounded-full px-1.5 text-[11px] ${
            tab === t ? 'bg-white/25' : 'bg-surface-muted text-ink-soft'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )

  return (
    <OwnerProtection>
      <div className={pageShellCls}>
        <div className={kickerCls}>Barbitch Admin</div>
        <div className={'mb-2 flex flex-wrap items-center justify-between gap-3'}>
          <h1 className={'m-0 text-[24px] leading-[1.2] font-extrabold text-ink'}>Дубли клиентов</h1>
          <button onClick={() => void load()} disabled={loading} className={btnNeutralCls}>
            {loading ? 'Načítám…' : '↻ Обновить'}
          </button>
        </div>
        <p className={'mb-4 ' + hintCls}>
          Слияние переносит брони, лояльность и награды на главную карточку и удаляет дубли; имя
          клиента обновляется во всех бронях календаря. Действие необратимо.
        </p>

        {s && (
          <div className={'mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4'}>
            {[
              { label: 'Групп дублей', value: s.strongGroups + s.weakGroups },
              { label: 'Лишних карточек', value: s.extraRecords },
              { label: 'Дыры в blacklistu', value: s.blacklistConflicts, warn: s.blacklistConflicts > 0 },
              { label: 'С будущими бронями', value: s.withFutureBookings },
            ].map((card) => (
              <div key={card.label} className={tileCls}>
                <div className={tileLabelCls}>{card.label}</div>
                <div className={card.warn ? tileValueNegCls : tileValueCls}>{card.value}</div>
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
            className={inputCls + ' ml-auto w-64'}
          />
        </div>

        {tab === 'strong' && (
          <p className={'mb-3 ' + hintCls}>Записи связаны общим e-mail или телефоном — почти наверняка один человек.</p>
        )}
        {tab === 'weak' && (
          <p className={'mb-3 text-[12.5px] leading-[1.55] font-semibold text-warn'}>
            Совпадает только полное имя, контакты разные. Может быть два РАЗНЫХ человека — сливайте только если уверены; иначе «Не дубли — скрыть».
          </p>
        )}

        {error && (
          <div className={'mb-4 ' + flashErrCls}>
            {error}
            <button onClick={() => void load()} className={'ml-3 font-bold underline'}>Zkusit znovu</button>
          </div>
        )}

        {loading && !data && (
          <p className={'py-12 text-center text-[13px] font-semibold text-ink-faint'}>Hledám duplicity… (pár sekund)</p>
        )}

        {!loading && data && groups.length === 0 && (
          <p className={'py-12 text-center text-[13px] font-semibold text-ink-faint'}>
            {search ? 'Ничего не найдено' : tab === 'ignored' ? 'Скрытых групп нет' : '🎉 Дублей нет'}
          </p>
        )}

        <div className={'flex flex-col'}>
          {pageGroups.map((g) => (
            <GroupCard key={g.key} group={g} isIgnoredTab={tab === 'ignored'} onChanged={() => void load()} />
          ))}
        </div>

        <Pagination page={safePage} total={groups.length} onPage={gotoPage} />

        <HistorySection />
      </div>
    </OwnerProtection>
  )
}

export default ClientDuplicatesPage
