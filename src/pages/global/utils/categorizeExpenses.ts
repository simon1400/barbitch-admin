export interface ExpenseCategory {
  name: string
  keywords: string[]
  color: string
}

export const expenseCategories: ExpenseCategory[] = [
  {
    name: 'Маркетинг',
    keywords: ['marketing', 'маркетинг', 'ads', 'meta', 'google', 'реклама', 'instagram', 'facebook'],
    color: '#e71e6e',
  },
  {
    name: 'Материалы для салона',
    keywords: ['салфетки', 'перчатки', 'материалы', 'расходники', 'bozp', 'топы', 'базы', 'фрезы', 'лампа'],
    color: '#ff6b9d',
  },
  {
    name: 'Косметика',
    keywords: ['косметика', 'крем', 'маска', 'шампунь', 'бальзам', 'средство'],
    color: '#c41e3a',
  },
  {
    name: 'Оборудование',
    keywords: ['оборудование', 'техника', 'машина', 'прибор', 'аппарат', 'kamera', 'камера'],
    color: '#ff1744',
  },
  {
    name: 'Услуги',
    keywords: ['услуги', 'сервис', 'обслуживание', 'ремонт', 'чистка', 'уборка'],
    color: '#d81b60',
  },
  {
    name: 'Продукты',
    keywords: ['продукты', 'еда', 'напитки', 'кофе', 'чай', 'вода'],
    color: '#e91e63',
  },
  {
    name: 'Уход за волосами',
    keywords: ['волосы', 'brows', 'брови', 'ресницы', 'окрашивание'],
    color: '#f06292',
  },
  {
    name: 'Маникюр',
    keywords: ['маникюр', 'naninails', 'гель', 'лак', 'покрытие', 'nail'],
    color: '#ec407a',
  },
  {
    name: 'Аксессуары',
    keywords: ['аксессуары', 'засоби', 'средства', 'инструменты'],
    color: '#ad1457',
  },
  {
    name: 'Другое',
    keywords: ['noona', 'ucetni', 'учет', 'бухгалтерия', 'налоги', 'temu', 'ostreni', 'najem', 'аренда'],
    color: '#880e4f',
  },
]

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
