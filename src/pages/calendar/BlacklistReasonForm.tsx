// Форма «Přidat na blacklist» с обязательной причиной (s208). Заменила
// window.confirm в шторке брони, модале «Hledat klienta» и на странице дублей:
// одним кликом клиента больше не заблокировать (так случайно попала Sofie
// Rosová при обучении сотрудника). Кнопка неактивна, пока не выбрана причина,
// у «Jiné» — пока нет комментария. Снятие блокировки формы не требует.
import { useState } from 'react'
import {
  BLACKLIST_REASONS,
  blacklistCommentRequired,
  composeBlacklistReason,
  type BlacklistReasonKey,
} from '../../lib/blacklistReasons'

interface Props {
  clientName: string
  busy?: boolean
  /** ошибка сервера последней попытки — показывается под кнопками */
  error?: string | null
  onSubmit: (reason: string) => void
  onCancel: () => void
}

export const BlacklistReasonForm = ({ clientName, busy = false, error, onSubmit, onCancel }: Props) => {
  const [key, setKey] = useState<BlacklistReasonKey | null>(null)
  const [comment, setComment] = useState('')
  const needComment = blacklistCommentRequired(key)
  const ready = key !== null && (!needComment || comment.trim().length > 0)

  return (
    <div
      data-blacklist-form
      className="mt-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm dark:border-red-500/40 dark:bg-red-500/10"
    >
      <div className="font-semibold text-red-800 dark:text-red-200">
        Přidat {clientName} na blacklist
      </div>
      <p className="mt-0.5 text-xs text-red-700/80 dark:text-red-300/80">
        Klient se nebude moci rezervovat přes web. Důvod je povinný — na požádání ho klientovi sdělujeme.
      </p>
      <fieldset className="mt-2 flex min-w-0 flex-col gap-1">
        <legend className="sr-only">Důvod</legend>
        {BLACKLIST_REASONS.map((r) => (
          <label key={r.key} className="flex cursor-pointer items-center gap-2 text-gray-800 dark:text-gray-200">
            <input
              type="radio"
              name="blacklist-reason"
              value={r.key}
              checked={key === r.key}
              onChange={() => setKey(r.key)}
              className="accent-red-600"
            />
            {r.label}
          </label>
        ))}
      </fieldset>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        maxLength={400}
        placeholder={needComment ? 'Komentář (povinný)' : 'Komentář (nepovinný)'}
        className="mt-2 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 dark:border-[#3f3f3d] dark:bg-[#1c1c1b] dark:text-gray-200"
      />
      {error && <div className="mt-1 text-xs font-semibold text-red-700 dark:text-red-300">{error}</div>}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-[#3f3f3d] dark:bg-transparent dark:text-gray-300 sm:py-1"
        >
          Zrušit
        </button>
        <button
          type="button"
          data-blacklist-submit
          disabled={busy || !ready}
          onClick={() => key && onSubmit(composeBlacklistReason(key, comment))}
          className="rounded-md bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40 sm:py-1"
        >
          Přidat na blacklist
        </button>
      </div>
    </div>
  )
}
