// Platby dárkových voucherů kartou (Comgate, s275): kdo kdy objednal a zaplatil,
// zda odešel e-mail s PDF, a pro majitele „Vrátit peníze“ (jen nevyužitý voucher).
import type { CardPayment, CardPaymentStatus } from './fetch'

import { useCallback, useEffect, useState } from 'react'

import { RefreshButton } from '../../components/RefreshButton'
import { useAppContext } from '../../context/useAppContext'
import { errMsg } from '../../lib/errMsg'
import {
  badgeMutedCls,
  badgeNegCls,
  badgePosCls,
  badgeWarnCls,
  btnDangerCls,
  cardPadCls,
  cardTitleCls,
  hintCls,
  mutedCls,
} from '../../ui/kit'
import { CARD_STATUS_LABEL, fetchCardPayments, refundCardPayment } from './fetch'

const STATUS_BADGE: Record<CardPaymentStatus, string> = {
  pending: badgeWarnCls,
  paid: badgePosCls,
  cancelled: badgeMutedCls,
  refunded: badgeNegCls,
}

const fmtWhen = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('cs-CZ', {
        timeZone: 'Europe/Prague',
        day: 'numeric',
        month: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

const fmtKc = (n: number) => `${n.toLocaleString('cs-CZ')} Kč`

const Row = ({
  p,
  isOwner,
  busy,
  onRefund,
}: {
  p: CardPayment
  isOwner: boolean
  busy: boolean
  onRefund: (p: CardPayment) => void
}) => (
  <li className="border-t border-line py-3 first:border-t-0 flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-extrabold text-ink">#{p.idVoucher}</span>
        <span className={STATUS_BADGE[p.status]}>{CARD_STATUS_LABEL[p.status]}</span>
        {p.test && <span className={badgeMutedCls}>TEST</span>}
        {p.voucherUsed && <span className={badgeMutedCls}>využit</span>}
      </div>
      <div className="text-[14px] font-semibold text-ink-body mt-1">
        {p.serviceName ? `${p.serviceName} · ` : ''}
        {fmtKc(p.price)} · {p.buyerName} → {p.forName}
      </div>
      <div className={`${mutedCls} mt-0.5 break-all`}>
        {p.email} · objednáno {fmtWhen(p.createdAt)}
        {p.paidAt ? ` · zaplaceno ${fmtWhen(p.paidAt)}` : ''}
        {p.refundedAt ? ` · vráceno ${fmtWhen(p.refundedAt)}${p.refundedBy ? ` (${p.refundedBy})` : ''}` : ''}
      </div>
      {p.status === 'paid' && !p.mailSentAt && (
        <div className="text-[12.5px] font-semibold text-neg mt-1">
          E-mail s PDF neodešel{p.mailError ? ` (${p.mailError})` : ''} — pošlete ho formulářem níže.
        </div>
      )}
      {p.status === 'pending' && p.failReason?.startsWith('mismatch') && (
        <div className="text-[12.5px] font-semibold text-neg mt-1">
          Údaje u Comgate nesedí ({p.failReason.slice(10)}) — zkontrolujte platbu v portálu Comgate.
        </div>
      )}
      {p.status === 'cancelled' && p.failReason && (
        <div className={`${mutedCls} mt-0.5`}>
          {p.failReason === 'expired' ? 'Nezaplaceno do 24 h — zrušeno' : `Důvod: ${p.failReason}`}
        </div>
      )}
    </div>
    {isOwner && p.canRefund && (
      <button type="button" className={btnDangerCls} disabled={busy} onClick={() => onRefund(p)}>
        {busy ? 'Vracím…' : 'Vrátit peníze'}
      </button>
    )}
  </li>
)

export const CardPaymentsCard = () => {
  const { userRole } = useAppContext()
  const isOwner = userRole === 'owner'
  const [items, setItems] = useState<CardPayment[] | null>(null)
  const [configured, setConfigured] = useState(true)
  const [loading, setLoading] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchCardPayments()
      setItems(res.items)
      setConfigured(res.configured)
      setUpdatedAt(Date.now())
    } catch (e) {
      setError(errMsg(e, 'Platby se nepodařilo načíst'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const refund = async (p: CardPayment) => {
    const ok = window.confirm(
      `Vrátit ${fmtKc(p.price)} za voucher #${p.idVoucher} (${p.buyerName})?\n\nPeníze odejdou zpět na kartu přes Comgate a voucher přestane platit. Nejde vzít zpět.`,
    )
    if (!ok) return
    setBusyId(p.id)
    setError('')
    try {
      await refundCardPayment(p.id)
      await load()
    } catch (e) {
      setError(errMsg(e, 'Vrácení se nepovedlo'))
    } finally {
      setBusyId('')
    }
  }

  // Bez rozbalení jen to podstatné: zaplacené, vrácené a čekající; nezaplacené pokusy schované.
  const visible = (items || []).filter((p) => showAll || p.status !== 'cancelled')
  const hidden = (items || []).length - visible.length

  return (
    <section className={`${cardPadCls} max-w-3xl`} lang="cs">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className={cardTitleCls}>Platby kartou (Comgate)</h2>
        <RefreshButton onClick={() => void load()} loading={loading} updatedAt={updatedAt} lang="cs" />
      </div>
      <p className={`m-0 mb-2 ${hintCls}`}>
        Objednávky z webu za 90 dní. Po zaplacení se voucher sám označí jako zaplacený a klientce
        odejde e-mail s PDF — formulář níže je jen pro převod a platbu v salonu.
      </p>
      {!configured && (
        <p className="m-0 mb-2 text-[13px] font-semibold text-warn">
          Comgate na serveru zatím není nastavený — objednávky kartou nejdou.
        </p>
      )}
      {error && <p className="m-0 mb-2 text-[13px] font-semibold text-neg">{error}</p>}
      {items && visible.length === 0 && <p className={`m-0 ${mutedCls}`}>Zatím žádné platby.</p>}
      {visible.length > 0 && (
        <ul className="list-none m-0 p-0">
          {visible.map((p) => (
            <Row key={p.id} p={p} isOwner={isOwner} busy={busyId === p.id} onRefund={refund} />
          ))}
        </ul>
      )}
      {(hidden > 0 || showAll) && (
        <button
          type="button"
          className={`mt-2 bg-transparent border-0 p-0 cursor-pointer underline ${mutedCls}`}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Skrýt nezaplacené' : `Ukázat i nezaplacené (${hidden})`}
        </button>
      )}
    </section>
  )
}
