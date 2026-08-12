// Дизайн-токены редизайна админки (по макетам владельца «Страницы — редизайн»,
// Claude Design, s165). ЕДИНСТВЕННЫЙ источник классов нового стиля для контента
// модулей — те же значения, что в CatalogPage (s163) и AdminHeader (s164).
//
// ⚠️ Только literal px/hex: кастомная шкала fontSize админки (text-sm = 16px/800,
// text-md = 32px и т.п.) здесь НЕ используется — не заменять literal-классы на неё.

/** Белая карточка-секция (фон #fff, рамка #eee9e6, r12, мягкая тень). */
export const cardCls =
  'bg-white border border-[#eee9e6] rounded-xl shadow-[0_1px_2px_rgba(22,22,21,0.04)]'

/** Карточка с типовыми отступами секции (20px 24px) + интервал между карточками. */
export const cardPadCls = `${cardCls} px-6 py-5 mb-3.5`

/** Заголовок внутри карточки (h2). */
export const cardTitleCls = 'm-0 text-[15px] font-extrabold text-[#161615]'

/** Кикер над h1 страницы (модуль uppercase). */
export const kickerCls =
  'text-[11px] font-bold tracking-[0.08em] uppercase text-[#a39e99] mb-1'

/** H1 страницы. */
export const h1Cls = 'm-0 mb-[18px] text-[24px] leading-[1.2] font-extrabold text-[#161615]'

/** Корневой контейнер страницы (как AnalyticsPage/TeamPage/CatalogPage). */
export const pageShellCls = 'max-w-[1024px] mx-auto box-border px-5 pt-7 pb-[60px] text-[#161615]'

/** Розовый бейдж-счётчик рядом с заголовком («Мастера 5»). */
export const countBadgeCls =
  'text-[11px] font-bold text-[#b81b60] bg-[#fce7f0] rounded-full px-2 py-0.5'

/** Заголовок колонки таблицы. */
export const colHeadCls = 'text-[10.5px] font-bold tracking-[0.06em] uppercase text-[#b3ada7]'

/** Подпись над полем формы. */
export const labelCls =
  'block text-[11px] font-bold tracking-[0.07em] uppercase text-[#8b857f] mb-1.5'

/** Приглушённая служебная подпись («обновлено 6 мин назад»). */
export const mutedCls = 'text-[12.5px] font-semibold text-[#a39e99]'

/** Поясняющий текст-подсказка (многострочный). */
export const hintCls = 'text-[12.5px] leading-[1.55] font-medium text-[#98928c]'

/** Нейтральная кнопка (белая с рамкой). */
export const btnNeutralCls =
  'px-4 py-2 rounded-lg border border-[#e7e2de] bg-white text-[#4c4844] text-[13px] font-bold whitespace-nowrap transition-colors hover:border-[#c9c3be] disabled:opacity-50 disabled:cursor-not-allowed'

/** Главная (розовая) кнопка. */
export const btnPinkCls =
  'px-4 py-2 rounded-lg border-0 bg-[#e71e6e] text-white text-[13px] font-extrabold whitespace-nowrap shadow-[0_3px_10px_rgba(231,30,110,0.25)] transition-colors hover:bg-[#d11a62] disabled:opacity-60 disabled:cursor-not-allowed'

/** Опасная кнопка (красная обводка). */
export const btnDangerCls =
  'px-4 py-2 rounded-lg border border-[#f3c1c1] bg-white text-[#c53030] text-[13px] font-bold whitespace-nowrap transition-colors hover:bg-[#fdecec] hover:border-[#e8a7a7] disabled:opacity-50 disabled:cursor-not-allowed'

/** Квадратная икон-кнопка 34×34 (стрелки листания и т.п.). */
export const iconBtnCls =
  'w-[34px] h-[34px] rounded-lg border border-[#e7e2de] bg-white text-[#6f6a66] transition-colors hover:border-[#c9c3be] hover:text-[#161615] shrink-0 inline-flex items-center justify-center disabled:opacity-50'

/** База инпута (серый фон, розовый focus-ring). */
export const inputBaseCls =
  'box-border bg-[#f6f4f2] border border-transparent font-semibold text-[#161615] transition-all duration-150 ' +
  'placeholder:text-[#b6b0aa] placeholder:font-medium ' +
  'focus:outline-none focus:bg-white focus:border-[#e71e6e] focus:shadow-[0_0_0_3px_rgba(231,30,110,0.1)] ' +
  '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

/** Стандартный инпут формы. */
export const inputCls = `${inputBaseCls} rounded-lg px-3 py-[9px] text-[15px]`

/** Компактный инпут в строке таблицы. */
export const rowInputCls = `${inputBaseCls} rounded-[7px] px-2.5 py-[7px] text-[14px]`

/** Селект (месяц/год и пр.). */
export const selectCls =
  'box-border bg-[#f6f4f2] border border-transparent rounded-lg px-2.5 py-2 text-[13.5px] font-bold text-[#161615] cursor-pointer focus:outline-none focus:bg-white focus:border-[#e71e6e]'

/** Тулбар-карточка над контентом (селекты периода + кнопки). */
export const toolbarCardCls = `${cardCls} px-4 py-3 mb-3.5 flex items-center justify-between gap-3.5 flex-wrap`

/** Плитка-показатель (нейтральная). */
export const tileCls = 'rounded-[10px] px-4 py-[13px] bg-[#faf9f8]'

/** Плитка-показатель (розовый акцент). */
export const tileAccentCls = 'rounded-[10px] px-4 py-[13px] bg-[#fce7f0] border border-[#f0a8c8]'

export const tileLabelCls =
  'text-[10.5px] font-bold tracking-[0.06em] uppercase text-[#8b857f] mb-[5px]'
export const tileValueCls = 'text-[21px] font-extrabold leading-[1.15] text-[#161615]'
export const tileValueNegCls = 'text-[21px] font-extrabold leading-[1.15] text-[#c53030]'
export const tileValueAccentCls = 'text-[21px] font-extrabold leading-[1.15] text-[#b81b60]'
export const tileSubCls = 'text-[11.5px] font-semibold text-[#a39e99] mt-[3px]'

/** Зелёный/красный процент-бейдж. */
export const badgePosCls =
  'text-[11px] font-bold rounded-md px-[7px] py-0.5 text-[#1d7a3f] bg-[#e8f6ee]'
export const badgeNegCls =
  'text-[11px] font-bold rounded-md px-[7px] py-0.5 text-[#c53030] bg-[#fdecec]'

/** Розовая информационная карточка («Jak to funguje»). */
export const pinkCardCls = 'bg-[#fdf5f8] border border-[#f5d3e2] rounded-xl px-6 py-[18px] mb-3.5'
export const pinkCardTitleCls = 'text-[13px] font-extrabold text-[#b81b60] mb-2'

/** Пилюля-переключатель (пресеты периода и т.п.). */
export const pillCls = (on: boolean): string =>
  'px-3 py-1.5 rounded-full border-0 text-[12px] font-bold whitespace-nowrap cursor-pointer transition-colors ' +
  (on ? 'bg-[#e71e6e] text-white' : 'bg-[#f6f4f2] text-[#6f6a66] hover:text-[#161615]')

/** Чип-тогл с галочкой (вкл/выкл опции). */
export const chipCls = (on: boolean): string =>
  'inline-flex items-center gap-[7px] px-[13px] py-[7px] rounded-full cursor-pointer select-none text-[12.5px] font-bold transition-all border ' +
  (on
    ? 'bg-[#fce7f0] border-[#f0a8c8] text-[#b81b60]'
    : 'bg-white border-[#e5e1de] text-[#8b857f]')

/** Строка грид-таблицы: ховер + разделитель сверху (кроме первой). */
export const gridRowCls = (idx: number): string =>
  'items-center py-[10px] px-2 -mx-2 rounded-lg transition-colors hover:bg-[#faf8f7]' +
  (idx > 0 ? ' border-t border-[#f2efec]' : '')

/**
 * Классы ячеек денежных таблиц (Cell прокидывает className на span).
 * NAME — имя сотрудника, NUM — числовая колонка, NEG — отрицательная сумма,
 * RESULT — итоговая колонка «Результат».
 */
export const NAME_CELL = 'text-[14px] font-bold text-[#161615] cursor-pointer'
export const NUM_CELL = 'text-right'
export const NEG_CELL = 'text-right text-[#c53030]'
export const RESULT_CELL = 'text-right text-[14px] font-extrabold text-[#b81b60]'

/** Итоговая строка под таблицей. */
export const totalRowCls = 'flex justify-between items-center pt-3 mt-1'
export const totalLabelCls = 'text-[13px] font-bold text-[#4c4844]'
export const totalValueCls = 'text-[18px] font-extrabold text-[#b81b60] whitespace-nowrap'
