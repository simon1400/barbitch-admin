// Роли пользователей
export type UserRole = 'master' | 'owner' | 'administrator' | 'manager'

// Руководство салона (s213): владелец и управляющая. Управляющей открыто всё, что
// видит владелец, кроме email-рассылки (решение владельца s212) — рассылку гейтит
// реестр moduleAccess и сервер (campaign/send остаётся owner).
export const isManagement = (role: string | null | undefined): boolean =>
  role === 'owner' || role === 'manager'
