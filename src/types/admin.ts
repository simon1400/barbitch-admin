// Роли пользователей
export type UserRole = 'master' | 'owner' | 'administrator'

export interface UserData {
  password: string
  role: UserRole
}
