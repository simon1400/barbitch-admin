// Роли пользователей
export type UserRole = 'master' | 'owner'

export interface UserData {
  password: string
  role: UserRole
}
