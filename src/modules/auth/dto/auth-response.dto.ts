import { JobLevel } from "@prisma/client"

export class AuthRoleDto {
  id!: string
  code!: string
  name!: string
  icon!: string
  color!: string
  active!: boolean
}

export class AuthUserDto {
  id!: string
  username!: string | null
  name!: string
  email!: string
  level!: JobLevel
  icon!: string
  color!: string
  active!: boolean
  avatarUrl!: string | null
  phone!: string | null
  position!: string | null
  role!: AuthRoleDto
}

export class LoginResponseDto {
  accessToken!: string
  permissions!: string[]
  user!: AuthUserDto
}

export class MeResponseDto {
  permissions!: string[]
  user!: AuthUserDto
}