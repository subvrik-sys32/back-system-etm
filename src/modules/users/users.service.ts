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
      include: { role: true, area: true },
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
      include: { role: true, area: true },
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

    await this.assertLevelMatchesRole(dto.roleId, targetLevel)
    this.assertAreaMatchesLevel(dto.areaId, targetLevel)

    const passwordHash = await bcrypt.hash(dto.password, 10)

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        name: dto.name,
        email: dto.email,
        passwordHash,
        roleId: dto.roleId,
        level: targetLevel,
        // Solo un OPERARIO puede tener área fija — si por lo que
        // sea llegara un areaId con otro level (no debería, ya lo
        // valida assertAreaMatchesLevel arriba), igual no se
        // persiste.
        areaId: targetLevel === JobLevel.OPERARIO ? dto.areaId : null,
        icon: dto.icon,
        color: dto.color,
        active: dto.active ?? true,
      },
      include: { role: true, area: true },
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
        roleId: true,
        level: true,
        role: {
          select: { code: true },
        },
      },
    })

    if (!existing) {
      throw new NotFoundException("User not found")
    }

    // Rol efectivo tras este update
    const effectiveRoleId = dto.roleId ?? existing.roleId

    // 1. Resolver el nuevo valor de 'level'
    let levelToUpdate: JobLevel | undefined

    if (dto.level === null) {
      // Si el frontend envía 'null' explícito, lo mapeamos a GENERAL
      levelToUpdate = JobLevel.GENERAL
    } else if (dto.level !== undefined) {
      levelToUpdate = dto.level
    }

    // 2. Si no enviaron level pero cambiaron a un rol que NO es PRODUCCION, forzamos GENERAL
    if (
      dto.roleId &&
      dto.roleId !== existing.roleId &&
      levelToUpdate === undefined &&
      existing.level !== JobLevel.GENERAL
    ) {
      const nextRole = await this.prisma.role.findUnique({
        where: { id: dto.roleId },
        select: { code: true },
      })

      if (
        !this.isLevelAllowedForRole(
          nextRole?.code,
          existing.level,
        )
      ) {
        levelToUpdate = JobLevel.GENERAL
      }
    }

    // 3. Validar consistencia de Sub-nivel vs Rol
    if (levelToUpdate) {
      await this.assertLevelMatchesRole(effectiveRoleId, levelToUpdate)
    }

    // 4. Resolver 'areaId' — mismo criterio que 'level' arriba:
    // null explícito limpia, undefined no toca. Si el nivel
    // EFECTIVO tras este update deja de ser OPERARIO, se fuerza a
    // null sin importar lo que haya venido en el DTO (un
    // Supervisor/General no tiene área fija — la elige él mismo
    // desde el panel, no queda pegada a su Perfil).
    const effectiveLevel = levelToUpdate ?? existing.level

    let areaIdToUpdate: string | null | undefined

    if (effectiveLevel !== JobLevel.OPERARIO) {
      areaIdToUpdate = null
    } else if (dto.areaId !== undefined) {
      areaIdToUpdate = dto.areaId
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
        roleId: dto.roleId,
        level: levelToUpdate, // Jamás será null
        areaId: areaIdToUpdate,
        icon: dto.icon,
        color: dto.color,
        active: dto.active,
        passwordHash,
      },
      include: { role: true, area: true },
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
      include: { role: true },
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
      include: { role: true },
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

  private async assertLevelMatchesRole(
    roleId: string | undefined,
    level: JobLevel | undefined | null,
  ) {

    if (!level || level === JobLevel.GENERAL) {
      return
    }

    if (!roleId) {
      return
    }

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { code: true },
    })

    if (!this.isLevelAllowedForRole(role?.code, level)) {
      throw new BadRequestException(
        "El sub-nivel (level) no es válido para el departamento del usuario",
      )
    }

  }

  // El Área (Perfil) solo tiene sentido para un Operario — un
  // Supervisor elige qué área(s) supervisar desde el panel lateral
  // (preferencia de UI, no queda pegada a su Perfil), y General/
  // otros roles no tienen ningún concepto de área.
  private assertAreaMatchesLevel(
    areaId: string | null | undefined,
    level: JobLevel,
  ) {

    if (!areaId) {
      return
    }

    if (level !== JobLevel.OPERARIO) {
      throw new BadRequestException(
        "El área solo aplica para usuarios con sub-nivel OPERARIO",
      )
    }

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
      include: { role: true },
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
        role: {
          select: { code: true },
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