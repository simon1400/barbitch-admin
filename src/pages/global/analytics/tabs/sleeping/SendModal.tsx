// Модалка отправки рассылки. Перенесено из SleepingTab.tsx (этап 6) дословно.
import { useMemo, useState } from 'react'
import {
  CAMPAIGN_TEMPLATES,
  daysSinceIso,
  saveCampaignLog,
  sendBulkEmail,
  type CampaignFilters,
  type CampaignRecipient,
  type SendResult,
  type SentInfo,
} from '../../fetch/emailCampaign'

const SKIP_RECENT_OPTIONS = [0, 30, 60, 90] // не слать тем, кому писали недавно

export function SendModal({
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
