import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"

import { JobLevel } from "@prisma/client"
import * as bcrypt from "bcrypt"
import sharp from "sharp"

import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { RealtimeService } from "@/modules/realtime/realtime.service"
import { SupabaseStorageService } from "@/infra/storage/supabase-storage.service"

import { CreateUserDto } from "./dto/create-user.dto"
import { UpdateUserDto } from "./dto/update-user.dto"

import { UpdateProfileDto } from "./dto/update-profile.dto"
import { UpdateAvatarDto } from "./dto/update-avatar.dto"
import { CreateUserPermissionOverrideDto } from "./dto/create-user-permission-override.dto"

@Injectable()
export class UsersService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly storage: SupabaseStorageService,
  ) {}

  async findAll() {

    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: { roles: true, areas: true },
      omit: { passwordHash: true },
      orderBy: { createdAt: "asc" },
    })

    return users.map(user => ({
      ...user,
      online: this.realtime.isUserOnline(user.id),
    }))

  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { roles: true, areas: true },
      omit: { passwordHash: true },
    })

    if (!user) {
      throw new NotFoundException("User not found")
    }

    return {
      ...user,
      online: this.realtime.isUserOnline(user.id),
    }
  }

  async create(dto: CreateUserDto, actorId?: string) {

    // Normalizamos si viene null desde el cliente
    const targetLevel = (dto.level === null || dto.level === undefined) 
      ? JobLevel.GENERAL 
      : dto.level

    await this.assertLevelMatchesRoles(dto.roleIds, targetLevel)
    this.assertAreasMatchLevel(dto.areaIds, targetLevel)

    const passwordHash = await bcrypt.hash(dto.password, 10)

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        name: dto.name,
        email: dto.email,
        passwordHash,
        roles: {
          connect: dto.roleIds.map(id => ({ id })),
        },
        level: targetLevel,
        // Solo un OPERARIO puede tener áreas fijas — si por lo que
        // sea llegaran areaIds con otro level (no debería, ya lo
        // valida assertAreasMatchLevel arriba), igual no se
        // persisten.
        areas: {
          connect:
            targetLevel === JobLevel.OPERARIO && dto.areaIds
              ? dto.areaIds.map(id => ({ id }))
              : [],
        },
        icon: dto.icon,
        color: dto.color,
        active: dto.active ?? true,
      },
      include: { roles: true, areas: true },
      omit: { passwordHash: true },
    })

    this.realtime.publish({
      entity: "USER",
      action: "CREATED",
      id: user.id,
      payload: user,
      excludeUserId: actorId,
    })

    return user
  }

  async update(id: string, dto: UpdateUserDto, actorId?: string) {

    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        level: true,
        roles: {
          select: { id: true, code: true },
        },
      },
    })

    if (!existing) {
      throw new NotFoundException("User not found")
    }

    const existingRoleIds = existing.roles.map(role => role.id)

    // Roles efectivos tras este update
    const effectiveRoleIds = dto.roleIds ?? existingRoleIds

    const rolesChanged =
      dto.roleIds !== undefined &&
      !this.sameIdSet(dto.roleIds, existingRoleIds)

    // 1. Resolver el nuevo valor de 'level'
    let levelToUpdate: JobLevel | undefined

    if (dto.level === null) {
      // Si el frontend envía 'null' explícito, lo mapeamos a GENERAL
      levelToUpdate = JobLevel.GENERAL
    } else if (dto.level !== undefined) {
      levelToUpdate = dto.level
    }

    // 2. Si no enviaron level pero cambiaron el conjunto de roles a
    // uno donde YA NINGÚN rol es compatible con el level actual,
    // forzamos GENERAL — mismo criterio aditivo que
    // assertLevelMatchesRoles: alcanza con que UNO solo de los
    // roles nuevos siga habilitando el level para no tocarlo.
    if (
      rolesChanged &&
      levelToUpdate === undefined &&
      existing.level !== JobLevel.GENERAL
    ) {
      const nextRoles = await this.prisma.role.findMany({
        where: { id: { in: effectiveRoleIds } },
        select: { code: true },
      })

      const stillAllowed = nextRoles.some(role =>
        this.isLevelAllowedForRole(role.code, existing.level),
      )

      if (!stillAllowed) {
        levelToUpdate = JobLevel.GENERAL
      }
    }

    // 3. Validar consistencia de Sub-nivel vs Roles
    if (levelToUpdate) {
      await this.assertLevelMatchesRoles(effectiveRoleIds, levelToUpdate)
    }

    // 4. Resolver 'areas' — mismo criterio que 'level' arriba:
    // undefined no toca nada, un array (aunque sea vacío) reemplaza
    // el conjunto completo. Si el nivel EFECTIVO tras este update
    // deja de ser OPERARIO, se fuerza a vacío sin importar lo que
    // haya venido en el DTO (un Supervisor/General no tiene área
    // fija — la elige él mismo desde el panel, no queda pegada a su
    // Perfil).
    const effectiveLevel = levelToUpdate ?? existing.level

    let areasUpdate: { set: { id: string }[] } | undefined

    if (effectiveLevel !== JobLevel.OPERARIO) {
      areasUpdate = { set: [] }
    } else if (dto.areaIds !== undefined) {
      areasUpdate = { set: dto.areaIds.map(id => ({ id })) }
    }

    let passwordHash: string | undefined

    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 10)
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        username: dto.username,
        name: dto.name,
        email: dto.email,
        roles:
          dto.roleIds !== undefined
            ? { set: dto.roleIds.map(roleId => ({ id: roleId })) }
            : undefined,
        level: levelToUpdate, // Jamás será null
        areas: areasUpdate,
        icon: dto.icon,
        color: dto.color,
        active: dto.active,
        passwordHash,
      },
      include: { roles: true, areas: true },
      omit: { passwordHash: true },
    })

    this.realtime.publish({
      entity: "USER",
      action: "UPDATED",
      id: user.id,
      payload: user,
      excludeUserId: actorId,
    })

    return user
  }

  async updateProfile(userId: string, dto: UpdateProfileDto, actorId?: string) {

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        phone: dto.phone,
        position: dto.position,
      },
      include: { roles: true },
      omit: { passwordHash: true },
    })

    this.realtime.publish({
      entity: "USER",
      action: "UPDATED",
      id: user.id,
      payload: user,
      excludeUserId: actorId,
    })

    return user

  }

  async updateAvatar(userId: string, dto: UpdateAvatarDto, actorId?: string) {

    const compressedBuffer =
      await this.compressAvatar(dto.imageBase64)

    await this.storage.deleteUserAvatars(userId)

    const avatarUrl =
      await this.storage.uploadAvatar(
        userId,
        compressedBuffer,
        "image/webp",
      )

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      include: { roles: true },
      omit: { passwordHash: true },
    })

    this.realtime.publish({
      entity: "USER",
      action: "UPDATED",
      id: user.id,
      payload: user,
      excludeUserId: actorId,
    })

    return { avatarUrl: user.avatarUrl }

  }

  // Departamentos que admiten sub-nivel (JobLevel) y cuáles. Antes
  // solo PRODUCCION podía tener level != GENERAL. Ingeniería y
  // Proyectos necesitan poder marcar SUPERVISOR (para identificar
  // Project Managers — ver isProjectManager en el frontend), pero
  // no OPERARIO/Área, que son un concepto exclusivo de Producción.
  // Si mañana se suma un departamento más con sub-niveles, este es
  // el único lugar a tocar.
  private static readonly LEVELS_BY_ROLE: Record<string, JobLevel[]> = {
    PRODUCCION: [JobLevel.OPERARIO, JobLevel.SUPERVISOR],
    INGENIERIA: [JobLevel.SUPERVISOR],
    PROYECTOS: [JobLevel.SUPERVISOR],
  }

  private isLevelAllowedForRole(
    roleCode: string | undefined,
    level: JobLevel | undefined | null,
  ): boolean {

    if (!level || level === JobLevel.GENERAL) {
      return true
    }

    if (!roleCode) {
      return false
    }

    const allowedLevels =
      UsersService.LEVELS_BY_ROLE[roleCode]

    return allowedLevels?.includes(level) ?? false

  }

  // Criterio aditivo (mismo espíritu que los permisos: la unión de
  // todos los roles): con que UNO SOLO de los roles del usuario
  // habilite el level alcanza, no hace falta que todos lo permitan.
  private async assertLevelMatchesRoles(
    roleIds: string[] | undefined,
    level: JobLevel | undefined | null,
  ) {

    if (!level || level === JobLevel.GENERAL) {
      return
    }

    if (!roleIds || roleIds.length === 0) {
      return
    }

    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { code: true },
    })

    const allowed = roles.some(role =>
      this.isLevelAllowedForRole(role.code, level),
    )

    if (!allowed) {
      throw new BadRequestException(
        "El sub-nivel (level) no es válido para ninguno de los roles del usuario",
      )
    }

  }

  // Las Áreas (Perfil) solo tienen sentido para un Operario — un
  // Supervisor elige qué área(s) supervisar desde el panel lateral
  // (preferencia de UI, no queda pegada a su Perfil), y General/
  // otros roles no tienen ningún concepto de área.
  private assertAreasMatchLevel(
    areaIds: string[] | undefined,
    level: JobLevel,
  ) {

    if (!areaIds || areaIds.length === 0) {
      return
    }

    if (level !== JobLevel.OPERARIO) {
      throw new BadRequestException(
        "Las áreas solo aplican para usuarios con sub-nivel OPERARIO",
      )
    }

  }

  private sameIdSet(a: string[], b: string[]): boolean {

    if (a.length !== b.length) {
      return false
    }

    const setB = new Set(b)

    return a.every(id => setB.has(id))

  }

  private async compressAvatar(imageBase64: string): Promise<Buffer> {

    const commaIndex = imageBase64.indexOf(",")

    const rawBase64 =
      commaIndex >= 0
        ? imageBase64.slice(commaIndex + 1)
        : imageBase64

    const inputBuffer =
      Buffer.from(rawBase64, "base64")

    return sharp(inputBuffer)
      .resize(200, 200, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 80 })
      .toBuffer()

  }

  async removeAvatar(userId: string, actorId?: string) {

    await this.storage.deleteUserAvatars(userId)

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      include: { roles: true },
      omit: { passwordHash: true },
    })

    this.realtime.publish({
      entity: "USER",
      action: "UPDATED",
      id: user.id,
      payload: user,
      excludeUserId: actorId,
    })

    return { avatarUrl: null }

  }

  async remove(id: string, actorId?: string) {

    const user = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    this.realtime.publish({
      entity: "USER",
      action: "DELETED",
      id,
      excludeUserId: actorId,
    })

    return user
  }

  // ---- Overrides de permisos por usuario ----

  async findPermissionOverrides(userId: string) {

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    })

    if (!user) {
      throw new NotFoundException("User not found")
    }

    return this.prisma.userPermission.findMany({
      where: { userId },
      include: {
        permission: true,
        grantedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

  }

  // Un mismo permiso no puede tener dos overrides a la vez para el
  // mismo usuario (ver @@unique en el schema) — si ya existe uno
  // para ese permiso, se reemplaza (upsert) en vez de acumular filas
  // contradictorias.
  async setPermissionOverride(
    userId: string,
    dto: CreateUserPermissionOverrideDto,
    grantedById: string,
  ) {

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    })

    if (!user) {
      throw new NotFoundException("User not found")
    }

    const permission = await this.prisma.permission.findUnique({
      where: { id: dto.permissionId },
      select: { id: true },
    })

    if (!permission) {
      throw new BadRequestException("El permiso indicado no existe")
    }

    const override = await this.prisma.userPermission.upsert({
      where: {
        userId_permissionId: {
          userId,
          permissionId: dto.permissionId,
        },
      },
      create: {
        userId,
        permissionId: dto.permissionId,
        effect: dto.effect,
        reason: dto.reason,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        grantedById,
      },
      update: {
        effect: dto.effect,
        reason: dto.reason,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        grantedById,
      },
      include: {
        permission: true,
        grantedBy: {
          select: { id: true, name: true },
        },
      },
    })

    // Al usuario afectado, para que su sesión refleje el override
    // sin esperar a que refresque manualmente — mismo mecanismo que
    // publishToRole en RolesService.updatePermissions.
    this.realtime.publishToUser(userId, {
      entity: "USER_PERMISSION_OVERRIDE",
      action: "UPDATED",
      payload: { userId },
    })

    return override

  }

  async removePermissionOverride(userId: string, overrideId: string) {

    const existing = await this.prisma.userPermission.findUnique({
      where: { id: overrideId },
      select: { id: true, userId: true },
    })

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException("Override de permiso no encontrado")
    }

    await this.prisma.userPermission.delete({
      where: { id: overrideId },
    })

    this.realtime.publishToUser(userId, {
      entity: "USER_PERMISSION_OVERRIDE",
      action: "DELETED",
      payload: { userId },
    })

  }

  async directory() {

    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, active: true },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        level: true,
        color: true,
        icon: true,
        // Para mostrar "visto por última vez hace X" cuando no
        // está online (ver el panel de Activos del sidebar).
        lastSeenAt: true,
        // Array ahora (m2m) — antes un solo role obligatorio por FK.
        roles: {
          select: {
            id: true,
            code: true,
            name: true,
            icon: true,
            color: true,
            active: true,
          },
        },
        // Faltaba por completo — sin esto, useAreaOperators
        // (Convocar en TaskAreaPanel) nunca podía filtrar por área
        // porque user.area?.processCode siempre venía undefined
        // para TODOS, en TODAS las áreas. Ahora es un array (m2m):
        // un operario puede aparecer en más de un área a la vez.
        areas: {
          select: { id: true, code: true, label: true, processCode: true },
        },
      },
      orderBy: { name: "asc" },
    })

    return users.map(user => ({
      ...user,
      online: this.realtime.isUserOnline(user.id),
    }))

  }

}