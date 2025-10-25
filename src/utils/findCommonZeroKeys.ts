// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findCommonZeroKeys(arr: Record<string, any>[]): string[] {
  if (arr.length === 0) return []

  const keys = Object.keys(arr[0])

  return keys.filter((key) => arr.every((item) => item[key] === 0))
}
