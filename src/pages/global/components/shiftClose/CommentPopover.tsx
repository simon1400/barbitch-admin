import DOMPurify from 'dompurify'
import { useEffect, useRef, useState } from 'react'

// 🟥 Комментарии приходят из CKEditor-полей service-provided.comment и
// work-time.comment, которые может ПЕРЕЗАПИСАТЬ любая сессия сотрудника
// (после s175 сессия = права API-токена). Без очистки `<img src=x onerror=…>`
// выполнялся бы у ВЛАДЕЛЬЦА на /global/shift-close, где в localStorage лежит
// его JWT, а CSP на admin.barbitch.cz нет.
// Allowlist ровно под то, что CKEditor реально даёт в этих полях; ссылки
// оставлены, но DOMPurify сам режет javascript:/data: в href.
const ALLOWED_TAGS = [
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's',
  'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'span', 'a',
]
const sanitize = (html: string) =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    // никаких data:/blob:, только обычные ссылки и почта
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:)/i,
  })

// True if the (possibly HTML) string has any visible text once tags are stripped.
export const hasComment = (raw: unknown) => {
  if (!raw || typeof raw !== 'string') return false
  return raw.replace(/<[^>]*>/g, '').trim().length > 0
}

// 💬 button that toggles a popover with rendered CKEditor HTML.
// Shared by ServiceProvidedCard (deal comment) and WorkTimeCard (worker comment).
export const CommentPopover = ({ html }: { html: string }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <span ref={ref} className="relative inline-block ml-1.5 align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Zobrazit komentář"
        aria-label="Zobrazit komentář"
        className="text-yellow-500 hover:text-yellow-600 transition-colors leading-none"
      >
        💬
      </button>
      {open && (
        <span
          role="dialog"
          className="absolute z-20 left-0 top-full mt-1 w-72 max-w-[80vw] rounded-lg border border-line bg-white shadow-lg p-3 text-left text-sm text-ink-body font-normal whitespace-normal break-words"
        >
          <span
            className="block prose prose-sm max-w-none [&_*]:m-0 [&_p]:my-1"
            dangerouslySetInnerHTML={{ __html: sanitize(html) }}
          />
        </span>
      )}
    </span>
  )
}
