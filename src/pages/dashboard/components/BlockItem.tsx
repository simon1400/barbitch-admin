// Плитка-показатель нового стиля (s165): серый тайл внутри белой карточки-секции.
// tone: 'accent' — розовая плитка (главный показатель), 'neg' — красное значение.
// Значение, начинающееся с минуса, краснеет автоматически.

const isNegative = (value: string): boolean => /^\s*[−-]/.test(value)

export const BlockItem = ({
  title,
  content,
  addContent,
  tone,
}: {
  title: string
  content: string
  addContent?: string
  tone?: 'accent' | 'neg'
}) => {
  const accent = tone === 'accent'
  const neg = tone === 'neg' || (!accent && isNegative(content))

  return (
    <div
      className={
        'rounded-[10px] px-4 py-[13px] w-full ' +
        (accent ? 'bg-brand-tint border border-brand-line' : 'bg-surface-tile')
      }
    >
      <span
        className={
          'block text-[10.5px] font-bold tracking-[0.06em] uppercase mb-[5px] ' +
          (accent ? 'text-brand-dark' : 'text-ink-soft')
        }
      >
        {title}
      </span>
      <span
        className={
          'block text-[21px] font-extrabold leading-[1.15] ' +
          (accent ? 'text-brand-dark' : neg ? 'text-neg' : 'text-ink')
        }
      >
        {content}
      </span>
      {addContent && (
        <span className={'block text-[11.5px] font-semibold text-ink-faint mt-[3px]'}>
          {addContent}
        </span>
      )}
    </div>
  )
}
