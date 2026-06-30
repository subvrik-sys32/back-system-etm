export class AuthRoleDto{

  id!:string

  code!:string

  name!:string

  icon!:string

  color!:string

  active!:boolean

}

export class AuthUserDto{

  id!:string

  username!:string|null

  name!:string

  email!:string

  icon!:string

  color!:string

  active!:boolean

  role!:AuthRoleDto

}

export class LoginResponseDto{

  accessToken!:string

  permissions!:string[]

  user!:AuthUserDto

}

export class MeResponseDto{

  permissions!:string[]

  user!:AuthUserDto

}