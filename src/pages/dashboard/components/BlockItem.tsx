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
        (accent ? 'bg-[#fce7f0] border border-[#f0a8c8]' : 'bg-[#faf9f8]')
      }
    >
      <span
        className={
          'block text-[10.5px] font-bold tracking-[0.06em] uppercase mb-[5px] ' +
          (accent ? 'text-[#b81b60]' : 'text-[#8b857f]')
        }
      >
        {title}
      </span>
      <span
        className={
          'block text-[21px] font-extrabold leading-[1.15] ' +
          (accent ? 'text-[#b81b60]' : neg ? 'text-[#c53030]' : 'text-[#161615]')
        }
      >
        {content}
      </span>
      {addContent && (
        <span className={'block text-[11.5px] font-semibold text-[#a39e99] mt-[3px]'}>
          {addContent}
        </span>
      )}
    </div>
  )
}
