// Дизайн-токены редизайна админки (по макетам владельца «Страницы — редизайн»,
// Claude Design, s165). ЕДИНСТВЕННЫЙ источник классов нового стиля для контента
// модулей — те же значения, что в CatalogPage (s163) и AdminHeader (s164).
//
// ⚠️ Размеры — только literal px: кастомная шкала fontSize админки (text-sm = 16px/800,
// text-md = 32px и т.п.) здесь НЕ используется — не заменять literal-классы на неё.
//
// ⚠️ Цвета — ТОЛЬКО именованные токены (bg-brand, text-ink, border-line…), НЕ literal-hex.
// Их значения заданы в src/ui/palette.js (s166) — смена цвета делается там, одной строкой.

/** Белая карточка-секция (белый фон, рамка line, r12, мягкая тень). */
export const cardCls =
  'bg-white border border-line rounded-xl shadow-panel'

/** Карточка с типовыми отступами секции (20px 24px) + интервал между карточками. */
export const cardPadCls = `${cardCls} px-6 py-5 mb-3.5`

/** Карточка под график recharts (левый паддинг снят — ось Y рисует свой). */
export const chartCardCls = `${cardCls} p-4 pl-0`

/** Карточка-обёртка длинной формы. Ширину (`max-w-*`) страница задаёт сама. */
export const formCardCls = `${cardCls} px-6 py-[22px]`

/** Заголовок внутри карточки (h2). */
export const cardTitleCls = 'm-0 text-[15px] font-extrabold text-ink'

/** Кикер над h1 страницы (модуль uppercase). */
export const kickerCls =
  'text-[11px] font-bold tracking-[0.08em] uppercase text-ink-faint mb-1'

/** H1 страницы. */
export const h1Cls = 'm-0 mb-[18px] text-[24px] leading-[1.2] font-extrabold text-ink'

/** Корневой контейнер страницы (как AnalyticsPage/TeamPage/CatalogPage). */
export const pageShellCls = 'max-w-[1024px] mx-auto box-border px-5 pt-7 pb-[60px] text-ink'

/** Розовый бейдж-счётчик рядом с заголовком («Мастера 5»). */
export const countBadgeCls =
  'text-[11px] font-bold text-brand-dark bg-brand-tint rounded-full px-2 py-0.5'

/**
 * Геометрия микро-заголовка (10.5px/700, разрядка, uppercase) БЕЗ цвета.
 * Цвет и отступ добавляются производными ниже — в проекте эта геометрия
 * встречается в трёх цветах, и склеивать их в одну константу нельзя.
 */
export const headMicroCls = 'text-[10.5px] font-bold tracking-[0.06em] uppercase'

/** Заголовок колонки таблицы. */
export const colHeadCls = `${headMicroCls} text-ink-label`

/** Подпись над полем формы. */
export const labelCls =
  'block text-[11px] font-bold tracking-[0.07em] uppercase text-ink-soft mb-1.5'

/** Приглушённая служебная подпись («обновлено 6 мин назад»). */
export const mutedCls = 'text-[12.5px] font-semibold text-ink-faint'

/** Поясняющий текст-подсказка (многострочный). */
export const hintCls = 'text-[12.5px] leading-[1.55] font-medium text-ink-hint'

/** Нейтральная кнопка (белая с рамкой). */
export const btnNeutralCls =
  'px-4 py-2 rounded-lg border border-line-btn bg-white text-ink-body text-[13px] font-bold whitespace-nowrap transition-colors hover:border-line-btn-hover disabled:opacity-50 disabled:cursor-not-allowed'

/** Главная (розовая) кнопка. */
export const btnPinkCls =
  'px-4 py-2 rounded-lg border-0 bg-brand text-white text-[13px] font-extrabold whitespace-nowrap shadow-brand-sm transition-colors hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed'

/** Опасная кнопка (красная обводка). */
export const btnDangerCls =
  'px-4 py-2 rounded-lg border border-neg-line bg-white text-neg text-[13px] font-bold whitespace-nowrap transition-colors hover:bg-neg-bg hover:border-neg-line-hover disabled:opacity-50 disabled:cursor-not-allowed'

/** Квадратная икон-кнопка 34×34 (стрелки листания и т.п.). */
export const iconBtnCls =
  'w-[34px] h-[34px] rounded-lg border border-line-btn bg-white text-ink-muted transition-colors hover:border-line-btn-hover hover:text-ink shrink-0 inline-flex items-center justify-center disabled:opacity-50'

/** База инпута (серый фон, розовый focus-ring). */
export const inputBaseCls =
  'box-border bg-surface-input border border-transparent font-semibold text-ink transition-all duration-150 ' +
  'placeholder:text-ink-placeholder placeholder:font-medium ' +
  'focus:outline-none focus:bg-white focus:border-brand focus:shadow-focus ' +
  '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

/** Стандартный инпут формы. */
export const inputCls = `${inputBaseCls} rounded-lg px-3 py-[9px] text-[15px]`

/** Компактный инпут в строке таблицы. */
export const rowInputCls = `${inputBaseCls} rounded-[7px] px-2.5 py-[7px] text-[14px]`

/** Селект (месяц/год и пр.). */
export const selectCls =
  'box-border bg-surface-input border border-transparent rounded-lg px-2.5 py-2 text-[13.5px] font-bold text-ink cursor-pointer focus:outline-none focus:bg-white focus:border-brand'

/** Тулбар-карточка над контентом (селекты периода + кнопки). */
export const toolbarCardCls = `${cardCls} px-4 py-3 mb-3.5 flex items-center justify-between gap-3.5 flex-wrap`

/** Геометрия плитки-показателя (скругление + отступы) БЕЗ фона. */
export const tileGeomCls = 'rounded-[10px] px-4 py-[13px]'

/** Плитка-показатель (нейтральная). */
export const tileCls = `${tileGeomCls} bg-surface-tile`

/** Плитка-показатель (розовый акцент). */
export const tileAccentCls = `${tileGeomCls} bg-brand-tint border border-brand-line`

export const tileLabelCls = `${headMicroCls} text-ink-soft mb-[5px]`
/** Подпись плитки в розовом акценте («Výsledek za měsíc», «Прогноз минимум»). */
export const tileLabelAccentCls = `${headMicroCls} text-brand-dark mb-[5px]`

/** Геометрия крупного значения плитки (21px/800) БЕЗ цвета. */
export const tileValueBaseCls = 'text-[21px] font-extrabold leading-[1.15]'
export const tileValueCls = `${tileValueBaseCls} text-ink`
export const tileValueNegCls = `${tileValueBaseCls} text-neg`
export const tileValueAccentCls = `${tileValueBaseCls} text-brand-dark`
export const tileSubCls = 'text-[11.5px] font-semibold text-ink-faint mt-[3px]'

/**
 * Геометрия бейджа-чипа (11px/700) БЕЗ цвета. В проекте эта геометрия носит
 * СЕМЬ разных цветовых пар, поэтому общая только она — цвет всегда отдельно.
 */
export const badgeBaseCls = 'text-[11px] font-bold rounded-md px-[7px] py-0.5'

/** Зелёный/красный процент-бейдж. */
export const badgePosCls = `${badgeBaseCls} text-pos bg-pos-bg`
export const badgeNegCls = `${badgeBaseCls} text-neg bg-neg-bg`
/** Жёлтый бейдж (частичная загрузка, «похоже»). */
export const badgeWarnCls = `${badgeBaseCls} text-warn bg-warn-bg`
/** Нейтральные серые бейджи — три оттенка текста на одном фоне. */
export const badgeNeutralCls = `${badgeBaseCls} text-ink-soft bg-surface-input`
export const badgeMutedCls = `${badgeBaseCls} text-ink-muted bg-surface-input`
export const badgeFaintCls = `${badgeBaseCls} text-ink-faint bg-surface-input`
/** Бейдж на цветной подложке (белый фон поверх карточки сверки смены). */
export const badgePlainCls = `${badgeBaseCls} bg-white text-ink-body`

/**
 * Акцент-карточка итога («Výsledek za měsíc», «Общий результат»).
 * Внешний отступ у неё разный (mb-3.5 / mt-3.5) — задаётся на месте.
 */
export const resultCardCls = 'bg-brand-tint border border-brand-line rounded-xl px-6 py-5'
/** Крупное значение в акцент-карточке итога (26px). */
export const resultValueCls = 'text-[26px] font-extrabold text-brand-dark leading-[1.15]'

/** Розовая информационная карточка («Jak to funguje»). */
export const pinkCardCls = 'bg-brand-card border border-brand-line-soft rounded-xl px-6 py-[18px] mb-3.5'
export const pinkCardTitleCls = 'text-[13px] font-extrabold text-brand-dark mb-2'

/** Пилюля-переключатель (пресеты периода и т.п.). */
export const pillCls = (on: boolean): string =>
  'px-3 py-1.5 rounded-full border-0 text-[12px] font-bold whitespace-nowrap cursor-pointer transition-colors ' +
  (on ? 'bg-brand text-white' : 'bg-surface-input text-ink-muted hover:text-ink')

/** Чип-тогл с галочкой (вкл/выкл опции). */
export const chipCls = (on: boolean): string =>
  'inline-flex items-center gap-[7px] px-[13px] py-[7px] rounded-full cursor-pointer select-none text-[12.5px] font-bold transition-all border ' +
  (on
    ? 'bg-brand-tint border-brand-line text-brand-dark'
    : 'bg-white border-line-chip text-ink-soft')

/**
 * @public Строка грид-таблицы: ховер + разделитель сверху (кроме первой).
 * Пока не подключено — литеральные копии в страницах, см. этап 5.3 аудита.
 */
export const gridRowCls = (idx: number): string =>
  'items-center py-[10px] px-2 -mx-2 rounded-lg transition-colors hover:bg-surface-hover' +
  (idx > 0 ? ' border-t border-line-soft' : '')

/**
 * Классы ячеек денежных таблиц (Cell прокидывает className на span).
 * NAME — имя сотрудника, NUM — числовая колонка, NEG — отрицательная сумма,
 * RESULT — итоговая колонка «Результат»: шрифт и цвет как у итоговой суммы под
 * таблицей (жирный + бренд), размер остаётся как у остальных данных.
 * Важно: цвет через important — базовый цвет текста в Cell идёт позже в собранном
 * CSS и без important перебивал бы бренд-цвет.
 */
export const NAME_CELL = 'text-[14px] font-bold text-ink cursor-pointer'
export const NUM_CELL = 'text-right'
export const NEG_CELL = 'text-right text-neg'
export const RESULT_CELL = 'text-right !text-brand-dark'

/**
 * @public Итоговая строка под таблицей.
 * Пока не подключено — литеральные копии в страницах, см. этап 5.3 аудита.
 */
export const totalRowCls = 'flex justify-between items-center pt-3 mt-1'
/**
 * Обычный жирный текст интерфейса (13px/700): подпись итога, подпись чекбокса,
 * заголовок над полем. Имя намеренно НЕЙТРАЛЬНОЕ — прежний `totalLabelCls`
 * врал бы в половине мест, где эта же строка используется не в строке итога.
 */
export const bodyBoldCls = 'text-[13px] font-bold text-ink-body'
export const totalValueCls = 'text-[18px] font-extrabold text-brand-dark whitespace-nowrap'
