export const toLocalStringDigits = (value: string | number) => {
  return value.toLocaleString('cz-CZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
}