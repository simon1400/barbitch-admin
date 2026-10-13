/**
 * «Работает как мастер» (s249) — зеркало strapi/src/utils/works-as-master.ts.
 * Мастер ИЛИ управляющая с флагом карточки `alsoMaster`: у неё колонка в календаре,
 * запись на сайте, отпуска с блоками, план, приоритет — как у мастера. Всё
 * «управляющее» (роль входа, výkaz, поручения) — по-прежнему по должности.
 *
 * 🟥 Кто мастер — решать через этот хелпер, а не сравнением `position === 'master'`.
 */
export const worksAsMaster = (p: { position?: string | null; alsoMaster?: boolean | null } | null | undefined): boolean =>
  p?.position === 'master' || (p?.position === 'manager' && p?.alsoMaster === true)
