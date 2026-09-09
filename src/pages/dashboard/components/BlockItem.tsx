// Плитка-показатель нового стиля (s165): серый тайл внутри белой карточки-секции.
// tone: 'accent' — розовая плитка (главный показатель), 'neg' — красное значение.
// Значение, начинающееся с минуса, краснеет автоматически.

import { headMicroCls, tileGeomCls, tileSubCls, tileValueBaseCls } from '../../../ui/kit'

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
        `${tileGeomCls} w-full ` +
        (accent ? 'bg-brand-tint border border-brand-line' : 'bg-surface-tile')
      }
    >
      <span
        className={
          `block ${headMicroCls} mb-[5px] ` +
          (accent ? 'text-brand-dark' : 'text-ink-soft')
        }
      >
        {title}
      </span>
      <span
        className={
          `block ${tileValueBaseCls} ` +
          (accent ? 'text-brand-dark' : neg ? 'text-neg' : 'text-ink')
        }
      >
        {content}
      </span>
      {addContent && (
        <span className={`block ${tileSubCls}`}>
          {addContent}
        </span>
      )}
    </div>
  )
}
