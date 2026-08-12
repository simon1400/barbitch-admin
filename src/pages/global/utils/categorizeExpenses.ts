import { EXPENSE_COLORS } from '../../../ui/chartColors'

export interface ExpenseCategory {
  name: string
  keywords: string[]
  color: string
}

// Цвет категории берётся по её порядковому номеру из общей палитры (ui/chartColors),
// чтобы он не расходился с цветами столбцов графика расходов.
const categoryDefs: Omit<ExpenseCategory, 'color'>[] = [
  {
    name: 'Маркетинг',
    keywords: ['marketing', 'маркетинг', 'ads', 'meta', 'google', 'реклама', 'instagram', 'facebook'],
  },
  {
    name: 'Материалы для салона',
    keywords: ['салфетки', 'перчатки', 'материалы', 'расходники', 'bozp', 'топы', 'базы', 'фрезы', 'лампа'],
  },
  {
    name: 'Косметика',
    keywords: ['косметика', 'крем', 'маска', 'шампунь', 'бальзам', 'средство'],
  },
  {
    name: 'Оборудование',
    keywords: ['оборудование', 'техника', 'машина', 'прибор', 'аппарат', 'kamera', 'камера'],
  },
  {
    name: 'Услуги',
    keywords: ['услуги', 'сервис', 'обслуживание', 'ремонт', 'чистка', 'уборка'],
  },
  {
    name: 'Продукты',
    keywords: ['продукты', 'еда', 'напитки', 'кофе', 'чай', 'вода'],
  },
  {
    name: 'Уход за волосами',
    keywords: ['волосы', 'brows', 'брови', 'ресницы', 'окрашивание'],
  },
  {
    name: 'Маникюр',
    keywords: ['маникюр', 'naninails', 'гель', 'лак', 'покрытие', 'nail'],
  },
  {
    name: 'Аксессуары',
    keywords: ['аксессуары', 'засоби', 'средства', 'инструменты'],
  },
  {
    name: 'Другое',
    keywords: ['noona', 'ucetni', 'учет', 'бухгалтерия', 'налоги', 'temu', 'ostreni', 'najem', 'аренда'],
  },
]

export const expenseCategories: ExpenseCategory[] = categoryDefs.map((c, i) => ({
  ...c,
  color: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
}))

export const categorizeExpense = (name: string): ExpenseCategory => {
  const lowerName = name.toLowerCase()

  for (const category of expenseCategories) {
    for (const keyword of category.keywords) {
      if (lowerName.includes(keyword.toLowerCase())) {
        return category
      }
    }
  }

  // Если категория не найдена, возвращаем "Другое"
  return expenseCategories[expenseCategories.length - 1]
}

export interface CategorizedExpense {
  category: string
  sum: number
  noDph: number
  color: string
  count: number
}

export const groupExpensesByCategory = (
  expenses: { name: string; sum: number; noDph?: number }[]
): CategorizedExpense[] => {
  const grouped = new Map<string, CategorizedExpense>()

  expenses.forEach((expense) => {
    const category = categorizeExpense(expense.name)
    const existing = grouped.get(category.name)

    if (existing) {
      existing.sum += expense.sum
      existing.noDph += expense.noDph || 0
      existing.count += 1
    } else {
      grouped.set(category.name, {
        category: category.name,
        sum: expense.sum,
        noDph: expense.noDph || 0,
        color: category.color,
        count: 1,
      })
    }
  })

  return Array.from(grouped.values()).sort((a, b) => b.sum - a.sum)
}
