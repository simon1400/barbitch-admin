// Результат предложения по клиенту, который сегодня уже пришёл (s199).
// Администратор подходит к клиенту, предлагает дозапись и закрывает состояние:
//   «Dozapsat» в строке варианта — результат «Дозаписан» ставится сам;
//   «Отказ» или «Не предлагали» — с причиной и комментарием (для «Другое» обязателен).
// Отметку можно поменять до конца дня; владелец видит всё в «Контроле предложений».
import { useState } from 'react'

import { btnNeutralCls, btnPinkCls, chipCls, inputCls, pillCls } from '../../../ui/kit'
import { fmtTimePrague } from '../../../utils/date'
import type { UpsellClient, UpsellManualOutcome } from '../fetch/upsellApi'
import { OUTCOME_LABEL, RESULT_REASONS, reasonLabel } from '../labels'
import { CheckIcon } from './icons'

interface Props {
  client: UpsellClient
  saving: boolean
  onSave: (client: UpsellClient, outcome: UpsellManualOutcome, reason: string, comment: string) => Promise<boolean>
}

const MANUAL: UpsellManualOutcome[] = ['declined', 'not_offered']
const stripCls = 'mt-3 rounded-lg border px-3.5 py-2.5 flex items-center gap-2.5 flex-wrap text-[12.5px] font-semibold'
const byCls = 'text-ink-muted'

export function ResultPanel({ client, saving, onSave }: Props) {
  const result = client.result
  const [editing, setEditing] = useState<UpsellManualOutcome | null>(null)
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')

  const open = (outcome: UpsellManualOutcome) => {
    const same = result?.outcome === outcome
    setEditing(outcome)
    setReason(same ? result?.reason || '' : '')
    setComment(same ? result?.comment || '' : '')
  }

  if (editing) {
    const needComment = reason === 'other'
    const canSave = !!reason && (!needComment || comment.trim().length > 0) && !saving
    return (
      <div className={`${stripCls} !block bg-white border-line-btn`} data-result="edit">
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          {MANUAL.map((o) => (
            <button key={o} type="button" className={pillCls(editing === o)} onClick={() => open(o)}>
              {OUTCOME_LABEL[o]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-2.5" role="radiogroup" aria-label="Причина">
          {RESULT_REASONS[editing].map((r) => (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={reason === r.key}
              className={chipCls(reason === r.key)}
              onClick={() => setReason(r.key)}
              data-reason={r.key}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            className={`${inputCls} !py-1.5 !text-[13px] flex-1 min-w-[200px]`}
            placeholder={needComment ? 'Что случилось? (обязательно)' : 'Комментарий (необязательно)'}
            value={comment}
            maxLength={500}
            onChange={(e) => setComment(e.target.value)}
            aria-label="Комментарий"
          />
          <button
            type="button"
            className={`${btnPinkCls} !py-1.5 !text-[12.5px]`}
            disabled={!canSave}
            onClick={async () => {
              if (await onSave(client, editing, reason, comment.trim())) setEditing(null)
            }}
          >
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
          <button type="button" className={`${btnNeutralCls} !py-1.5 !text-[12.5px]`} disabled={saving} onClick={() => setEditing(null)}>
            Отмена
          </button>
        </div>
      </div>
    )
  }

  if (result?.outcome === 'booked' || result?.outcome === 'site') {
    return (
      <div className={`${stripCls} bg-pos-bg border-pos-line text-pos`} data-result={result.outcome}>
        <CheckIcon />
        <b>{OUTCOME_LABEL[result.outcome]}</b>
        {result.outcome === 'booked' && result.adminUsername && <span>· {result.adminUsername}</span>}
        {result.outcome === 'site' && <span className="font-semibold">— предлагать не нужно</span>}
      </div>
    )
  }

  if (result) {
    const declined = result.outcome === 'declined'
    return (
      <div className={`${stripCls} bg-surface-input border-line-soft text-ink-body`} data-result={result.outcome}>
        <b className={declined ? 'text-neg' : 'text-warn'}>{OUTCOME_LABEL[result.outcome]}</b>
        <span className="text-ink">· {reasonLabel(result.outcome, result.reason)}</span>
        {result.comment && <span className="text-ink-body">«{result.comment}»</span>}
        <span className={byCls}>
          {result.adminUsername}
          {result.updatedAt ? ` · ${fmtTimePrague(result.updatedAt)}` : ''}
        </span>
        <button type="button" className={`${btnNeutralCls} !py-1 !px-2.5 !text-[12px] ml-auto`} onClick={() => open(result.outcome as UpsellManualOutcome)}>
          Изменить
        </button>
      </div>
    )
  }

  return (
    <div className={`${stripCls} bg-warn-bg border-warn-line text-warn`} data-result="missing">
      <b>Результат не отмечен</b>
      <span className="text-ink-body">
        {client.left ? 'клиент ушёл — отметьте, что было' : 'предложите дозапись и отметьте результат'}
      </span>
      <span className="ml-auto flex items-center gap-2">
        {MANUAL.map((o) => (
          <button key={o} type="button" className={`${btnNeutralCls} !py-1 !px-2.5 !text-[12px]`} onClick={() => open(o)}>
            {OUTCOME_LABEL[o]}
          </button>
        ))}
      </span>
    </div>
  )
}
