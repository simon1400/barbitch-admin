// Форматирование дат вкладки «Спящие». Вынесено из SleepingTab.tsx в этапе 6
// аудита — ПЕРЕНОС без изменений.
import { fmtCsDate, ymdPrague } from '../../../../../utils/date'

export const fmtDate = fmtCsDate

// Момент отправки письма → день САЛОНА (раньше день брался по поясу браузера).
export const fmtDateTime = (iso: string) => fmtCsDate(ymdPrague(iso))
