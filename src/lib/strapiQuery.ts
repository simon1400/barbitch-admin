// Сборка query-строки в скобочном формате Strapi (`filters[date][$gte]=…`).
//
// 🟥 ЗАЧЕМ СВОЙ БИЛДЕР. Ради этих восьми вызовов админка тянула библиотеку `qs`
// (отдельный чанк ~39 KB, который подтягивался в 19 других чанков). Нужен из неё
// был ровно один режим: `qs.stringify(obj, { encodeValuesOnly: true })` над
// простыми объектами — вложенные объекты, массивы строк, числа и строки.
//
// ⚠️ Поведение повторяет `qs` ПОБАЙТОВО, и это проверено дифференциальным тестом
// против самой `qs` (реальные восемь форм запросов + фаззинг). Если правишь этот
// файл — гони тот тест заново, иначе можно молча изменить фильтр и получить
// НЕВЕРНЫЕ деньги вместо ошибки. Договорённости, которые надо сохранить:
//   • ключи НЕ кодируются (это и есть `encodeValuesOnly`), значения кодируются;
//   • кодирование по RFC3986: `encodeURIComponent` плюс `!`, `'`, `(`, `)`, `*`;
//   • массивы — с индексами: `fields[0]=name&fields[1]=sum`;
//   • `undefined` пропускается целиком, `null` даёт `key=` (пустое значение);
//   • пустой массив и пустой объект не дают ничего;
//   • порядок пар — порядок ключей объекта, как их отдаёт `Object.entries`.

const RFC3986_EXTRA = /[!'()*]/g

// ⚠️ Единственное место, где мы СОЗНАТЕЛЬНО расходимся с `qs`: одинокий суррогат
// (обломок эмодзи, который может приехать только из битых данных). `qs` собирает
// UTF-8 руками и молча выдаёт байты несуществующего символа, а
// `encodeURIComponent` на таком бросает `URIError`. Бросать нельзя — это уронило
// бы страницу целиком, поэтому меняем обломок на U+FFFD и продолжаем. Для любых
// корректных строк (включая эмодзи целиком и чешскую диакритику) результат
// совпадает с `qs` побайтово.
const wellFormed = (raw: string): string => {
  const s = raw as string & { toWellFormed?: () => string }
  if (typeof s.toWellFormed === 'function') return s.toWellFormed()
  return raw.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�')
}

const encodeValue = (raw: string): string => {
  let encoded: string
  try {
    encoded = encodeURIComponent(raw)
  } catch {
    encoded = encodeURIComponent(wellFormed(raw))
  }
  return encoded.replace(RFC3986_EXTRA, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

const walk = (key: string, value: unknown, out: string[]): void => {
  if (value === undefined) return
  if (value === null) {
    out.push(`${key}=`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(`${key}[${i}]`, item, out))
    return
  }
  // Date отдельно: `qs` сериализует его в ISO, а обычный обход объекта дал бы
  // пустоту (у Date нет собственных перечислимых свойств)
  if (value instanceof Date) {
    out.push(`${key}=${encodeValue(value.toISOString())}`)
    return
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      walk(`${key}[${k}]`, v, out)
    }
    return
  }
  out.push(`${key}=${encodeValue(String(value))}`)
}

/** Аналог `qs.stringify(params, { encodeValuesOnly: true })` для запросов Strapi. */
export const strapiQuery = (params: Record<string, unknown>): string => {
  const out: string[] = []
  for (const [key, value] of Object.entries(params)) walk(key, value, out)
  return out.join('&')
}
