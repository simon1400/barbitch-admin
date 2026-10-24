import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { errMsg } from '../../lib/errMsg'
import {
  badgeNeutralCls,
  badgePosCls,
  badgeWarnCls,
  btnNeutralCls,
  btnPinkCls,
  cardPadCls,
  h1Cls,
  hintCls,
  inputCls,
  kickerCls,
  labelCls,
  mutedCls,
  pageShellCls,
  pillCls,
  selectCls,
} from '../../ui/kit'
import {
  OPEN_STATUSES,
  STATUS_LABEL,
  STATUS_ORDER,
  downloadInquiryLogo,
  fetchFirmInquiries,
  updateFirmInquiry,
  type FirmInquiry,
  type InquiryStatus,
} from './fetch'

type Filter = 'open' | 'all' | InquiryStatus

const STATUS_BADGE: Record<InquiryStatus, string> = {
  new: badgeWarnCls,
  contacted: badgeNeutralCls,
  offer: badgeNeutralCls,
  won: badgePosCls,
  lost: badgeNeutralCls,
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const fmtSize = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`)

/** Jedna poptávka: údaje firmy, logo, stav a interní poznámka. */
const InquiryCard = ({
  item,
  highlighted,
  onSaved,
}: {
  item: FirmInquiry
  highlighted: boolean
  onSaved: (next: FirmInquiry) => void
}) => {
  const [status, setStatus] = useState<InquiryStatus>(item.status)
  const [note, setNote] = useState(item.adminNote)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dirty = status !== item.status || note !== item.adminNote

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      onSaved(await updateFirmInquiry(item.id, { status, adminNote: note }))
    } catch (e) {
      setError(errMsg(e, 'Uložení se nezdařilo'))
    } finally {
      setSaving(false)
    }
  }

  const openLogo = async () => {
    setError('')
    try {
      const url = await downloadInquiryLogo(item.id)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setError(errMsg(e, 'Logo se nepodařilo otevřít'))
    }
  }

  return (
    <article
      id={`inquiry-${item.id}`}
      className={`${cardPadCls} ${highlighted ? 'ring-2 ring-brand' : ''}`}
      data-inquiry={item.id}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="m-0 text-[17px] font-extrabold text-ink">
            {item.company} · {item.count} ks
          </h2>
          <div className={mutedCls}>
            {fmtDate(item.createdAt)}
            {item.ico && ` · IČO ${item.ico}`}
          </div>
        </div>
        <span className={STATUS_BADGE[item.status]}>{STATUS_LABEL[item.status]}</span>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[14px] mb-3">
        <div>
          <dt className={labelCls}>Kontakt</dt>
          <dd className="m-0 font-semibold">{item.person}</dd>
          <dd className="m-0">
            <a className="text-brand-dark underline" href={`mailto:${item.email}`}>
              {item.email}
            </a>
            {item.phone && (
              <>
                {' · '}
                <a className="text-brand-dark underline" href={`tel:${item.phone.replaceAll(' ', '')}`}>
                  {item.phone}
                </a>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className={labelCls}>Hodnota / služba</dt>
          <dd className="m-0">{item.value || '—'}</dd>
        </div>
        {item.note && (
          <div className="sm:col-span-2">
            <dt className={labelCls}>Poznámka firmy</dt>
            <dd className="m-0 whitespace-pre-wrap">{item.note}</dd>
          </div>
        )}
        <div className="sm:col-span-2">
          <dt className={labelCls}>Logo</dt>
          <dd className="m-0">
            {item.logo ? (
              <button type="button" className={btnNeutralCls} onClick={openLogo}>
                📎 {item.logo.name} ({fmtSize(item.logo.size)})
              </button>
            ) : (
              <span className={mutedCls}>nepřiloženo</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-1 sm:grid-cols-[220px_minmax(0,1fr)] gap-3 items-start">
        <label>
          <span className={labelCls}>Stav</span>
          <select
            className={selectCls}
            value={status}
            onChange={(e) => setStatus(e.target.value as InquiryStatus)}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelCls}>Interní poznámka</span>
          <textarea
            className={`${inputCls} w-full h-[72px] resize-y`}
            value={note}
            maxLength={4000}
            placeholder="Co jsme nabídli, kdy volat, faktura…"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <span className={mutedCls}>
          {item.updatedByName && `Naposledy upravil(a): ${item.updatedByName} · ${fmtDate(item.updatedAt)}`}
        </span>
        <button type="button" className={btnPinkCls} disabled={!dirty || saving} onClick={save}>
          {saving ? 'Ukládám…' : 'Uložit'}
        </button>
      </div>
      {error && <p className="m-0 mt-2 text-[13px] font-semibold text-neg">{error}</p>}
    </article>
  )
}

/** /firemni-poptavky — poptávky firemních voucherů z webu (vedení). */
const FirmInquiriesPage = () => {
  const [items, setItems] = useState<FirmInquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('open')
  const [params] = useSearchParams()
  const focusId = params.get('id')

  useEffect(() => {
    fetchFirmInquiries()
      .then(setItems)
      .catch((e) => setError(errMsg(e, 'Poptávky se nepodařilo načíst')))
      .finally(() => setLoading(false))
  }, [])

  // Odkaz z e-mailu (?id=…): ukázat všechny a odscrollovat ke kartě.
  useEffect(() => {
    if (!focusId || loading) return
    setFilter('all')
    requestAnimationFrame(() => document.getElementById(`inquiry-${focusId}`)?.scrollIntoView({ block: 'center' }))
  }, [focusId, loading])

  const counts = useMemo(() => {
    const c: Record<string, number> = { open: 0, all: items.length }
    for (const it of items) {
      c[it.status] = (c[it.status] || 0) + 1
      if (OPEN_STATUSES.includes(it.status)) c.open += 1
    }
    return c
  }, [items])

  const shown = items.filter((it) =>
    filter === 'all' ? true : filter === 'open' ? OPEN_STATUSES.includes(it.status) : it.status === filter,
  )

  const filters: { key: Filter; label: string }[] = [
    { key: 'open', label: 'Otevřené' },
    ...STATUS_ORDER.map((s) => ({ key: s as Filter, label: STATUS_LABEL[s] })),
    { key: 'all', label: 'Vše' },
  ]

  return (
    <div className={pageShellCls}>
      <div className={kickerCls}>Vouchery</div>
      <h1 className={h1Cls}>Firemní poptávky</h1>
      <p className={`m-0 mb-4 ${hintCls}`}>
        Poptávky z formuláře barbitch.cz/firemni-vouchery. Firma dostala potvrzení e-mailem; odpovídejte
        jí přímo e-mailem a tady si vedte stav.
      </p>

      <div className="flex flex-wrap gap-2 mb-4" role="tablist">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={pillCls(filter === f.key)}
            onClick={() => setFilter(f.key)}
          >
            {f.label} {counts[f.key] ? `· ${counts[f.key]}` : ''}
          </button>
        ))}
      </div>

      {loading && <p className={mutedCls}>Načítání…</p>}
      {error && <p className="text-neg font-semibold">{error}</p>}
      {!loading && !error && shown.length === 0 && <p className={mutedCls}>Žádné poptávky.</p>}

      {shown.map((item) => (
        <InquiryCard
          key={item.id}
          item={item}
          highlighted={item.id === focusId}
          onSaved={(next) => setItems((prev) => prev.map((it) => (it.id === next.id ? next : it)))}
        />
      ))}
    </div>
  )
}

export default FirmInquiriesPage
