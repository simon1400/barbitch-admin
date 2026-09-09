// Стили макета «Каталог услуг». Перенесено из CatalogPage.tsx (этап 6) дословно.

// ── стили макета (точные значения из standalone-HTML) ──
//
// cardCls / labelCls / colHeadCls берутся из ui/kit.ts — они там побайтово те же.
// ⚠️ Остальное НЕ дубли kit, а сознательно другие значения этого макета:
// инпуты добавляют `w-full`, kickerCls даёт mb-[3px] вместо mb-1, кнопки крупнее
// (px-[18px] py-[9px], text-[14px], shadow-brand-lg против px-4 py-2 / text-[13px]).
// Заменять их на kit нельзя — поедет вид страницы.

// инпут формы: bg surface-input, border transparent, focus = белый + розовая рамка + кольцо
export const inputBaseCls =
  'box-border w-full bg-surface-input border border-transparent font-semibold text-ink transition-all duration-150 ' +
  'placeholder:text-ink-placeholder placeholder:font-medium ' +
  'focus:outline-none focus:bg-white focus:border-brand focus:shadow-focus ' +
  '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
// крупный инпут (Основное): padding 9px 12px, radius 8px, 15px
export const inputCls = `${inputBaseCls} rounded-lg px-3 py-[9px] text-[15px]`
// строчный инпут (таблицы вариантов/дополнений): padding 7px 10px, radius 7px, 14px
export const rowInputCls = `${inputBaseCls} rounded-[7px] px-2.5 py-[7px] text-[14px]`

export const kickerCls = 'text-[11px] font-bold tracking-[0.08em] uppercase text-ink-faint mb-[3px]'

// кнопки макета
export const btnNeutralCls =
  'px-[18px] py-[9px] rounded-lg border border-line-btn bg-white text-ink-body text-[14px] font-bold whitespace-nowrap transition-colors hover:border-line-btn-hover'
export const btnPinkCls =
  'rounded-lg border-0 bg-brand text-white text-[14px] font-extrabold whitespace-nowrap shadow-brand-lg transition-colors hover:bg-brand-hover disabled:opacity-60'

// grid-шаблоны (inline style — точные minmax из макета)
export const LIST_GRID = 'minmax(170px,1.6fr) 84px 74px 128px minmax(130px,1fr) 118px'
export const VARIANT_GRID = '22px minmax(120px,1.3fr) 72px 72px minmax(90px,1fr) 30px'
export const MODIFIER_GRID = '22px minmax(110px,1.4fr) 72px 72px 84px minmax(80px,1fr) 30px'
