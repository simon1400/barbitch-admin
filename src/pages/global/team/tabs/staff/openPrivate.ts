// «заполнить» / «загрузить скан» в онбординге → раскрыть свёрнутую секцию «Личные данные и
// документы» и прокрутить к полям или к документам. Секция сама грузит `/private` —
// онбординг личных данных не касается, только просит открыть.
export const OPEN_PRIVATE_EVENT = 'staff:open-private'

export type OpenPrivateTarget = 'private' | 'documents'

export const openPrivateSection = (target: OpenPrivateTarget) =>
  window.dispatchEvent(new CustomEvent<OpenPrivateTarget>(OPEN_PRIVATE_EVENT, { detail: target }))
