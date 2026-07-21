import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { DayShift } from "@prisma/client"

import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { RealtimeService } from "@/modules/realtime/realtime.service"
import { PermissionCode } from "@/core/enums/permission-code.enum"
import type { CurrentUserType } from "@/shared/types/current-user.types"

import { CreateActivityLogDto } from "./dto/create-activity-log.dto"
import { CreateActivityTypeDto } from "./dto/create-activity-type.dto"
import { UpdateActivityTypeDto } from "./dto/update-activity-type.dto"
import { getLimaMinutesOfDay, getStartOfTodayInLima } from "./utils/lima-time.util"

// Se calcula del lado del servidor a partir de la hora real — nunca
// se confía en que el cliente diga "estoy en tal franja", evita que
// alguien loguee una franja que no corresponde por error (o a
// propósito). IMPORTANTE: se usa la hora de Lima explícitamente (no
// date.getHours(), que depende de la TZ del servidor — el servidor
// corre en UTC, así que usar la hora del sistema hacía que casi todo
// cayera en "Noche" para usuarios en Perú).
//
// Franjas (ver comentario del enum DayShift en schema.prisma):
//   < 11:00 → MORNING_1   (incluye cualquier hora antes de las 8:30,
//                          no hay franja previa a la que asignarlo)
//   < 13:00 → MORNING_2
//   < 14:00 → LUNCH
//   < 16:00 → AFTERNOON_1
//   < 18:00 → AFTERNOON_2
//   resto   → NIGHT
function getShiftForDate(date: Date): DayShift {

  const minutes = getLimaMinutesOfDay(date)

  if (minutes < 11 * 60) {
    return DayShift.MORNING_1
  }

  if (minutes < 13 * 60) {
    return DayShift.MORNING_2
  }

  if (minutes < 14 * 60) {
    return DayShift.LUNCH
  }

  if (minutes < 16 * 60) {
    return DayShift.AFTERNOON_1
  }

  if (minutes < 18 * 60) {
    return DayShift.AFTERNOON_2
  }

  return DayShift.NIGHT

}

@Injectable()
export class ActivityLogService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  // ---- Tipos de actividad ----

  findAllTypes(includeInactive = false) {

    return this.prisma.activityType.findMany({
      where: {
        deletedAt: null,
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: { order: "asc" },
    })

  }

  async createType(dto: CreateActivityTypeDto) {

    const maxOrder = await this.prisma.activityType.aggregate({
      where: { deletedAt: null },
      _max: { order: true },
    })

    return this.prisma.activityType.create({
      data: {
        label: dto.label,
        icon: dto.icon,
        color: dto.color,
        order: dto.order ?? (maxOrder._max.order ?? 0) + 1,
      },
    })

  }

  async updateType(id: string, dto: UpdateActivityTypeDto) {

    const exists = await this.prisma.activityType.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!exists) {
      throw new NotFoundException("Tipo de actividad no encontrado")
    }

    return this.prisma.activityType.update({
      where: { id },
      data: dto,
    })

  }

  async removeType(id: string) {

    const exists = await this.prisma.activityType.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!exists) {
      throw new NotFoundException("Tipo de actividad no encontrado")
    }

    // Borrado lógico — un tipo usado en logs viejos tiene que seguir
    // legible ahí aunque se lo sague de la lista para elegir en logs
    // nuevos (por eso solo se filtra por deletedAt, no por active,
    // al mostrar logs existentes).
    return this.prisma.activityType.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    })

  }

  // ---- Entradas de bitácora ----

  async create(userId: string, dto: CreateActivityLogDto) {

    const type = await this.prisma.activityType.findUnique({
      where: { id: dto.activityTypeId },
      select: { id: true, deletedAt: true },
    })

    if (!type || type.deletedAt) {
      throw new NotFoundException("Tipo de actividad no encontrado")
    }

    // Si viene taskId, se valida que la tarea exista y (si también
    // vino projectId) que realmente pertenezca a ese proyecto — evita
    // guardar una combinación inconsistente por un bug del cliente.
    if (dto.taskId) {

      const task = await this.prisma.task.findUnique({
        where: { id: dto.taskId },
        select: { id: true, projectId: true },
      })

      if (!task) {
        throw new NotFoundException("Tarea no encontrada")
      }

      if (dto.projectId && task.projectId !== dto.projectId) {
        throw new NotFoundException("La tarea no pertenece a ese proyecto")
      }

    } else if (dto.projectId) {

      const project = await this.prisma.project.findUnique({
        where: { id: dto.projectId },
        select: { id: true },
      })

      if (!project) {
        throw new NotFoundException("Proyecto no encontrado")
      }

    }

    const now = new Date()

    const log = await this.prisma.activityLog.create({
      data: {
        userId,
        activityTypeId: dto.activityTypeId,
        projectId: dto.projectId,
        taskId: dto.taskId,
        note: dto.note,
        shift: getShiftForDate(now),
        loggedAt: now,
      },
      include: {
        activityType: true,
        project: {
          select: { id: true, name: true, projectCode: true },
        },
        task: {
          select: { id: true, taskNumber: true, reference: true },
        },
      },
    })

    // Tiempo real: para que una pantalla de supervisión (si en algún
    // momento se construye) vea las entradas aparecer sin refrescar.
    this.realtime.publish({
      entity: "ACTIVITY_LOG",
      action: "CREATED",
      id: log.id,
      payload: log,
    })

    return log

  }

  // Elimina una entrada de bitácora. Igual que en comentarios: el
  // dueño de la entrada siempre puede borrar la suya, y quien tenga
  // ACTIVITY_LOG_READ_ANY... no alcanza para borrar entradas ajenas
  // a propósito (ver/registrar todo no debería implicar poder
  // borrar todo) — por eso se pide el permiso propio ACTIVITY_LOG_DELETE,
  // pensado hoy como "borrar lo mío". Si más adelante se necesita
  // que un admin borre entradas ajenas, se agrega un DELETE_ANY como
  // en comentarios.
  async remove(id: string, user: CurrentUserType) {

    const existing = await this.prisma.activityLog.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })

    if (!existing) {
      throw new NotFoundException("Entrada de bitácora no encontrada")
    }

    if (existing.userId !== user.id) {
      throw new ForbiddenException("No podés eliminar una entrada de bitácora ajena.")
    }

    await this.prisma.activityLog.delete({ where: { id } })

    this.realtime.publish({
      entity: "ACTIVITY_LOG",
      action: "DELETED",
      id,
      payload: { id },
    })

  }

  // Entradas de HOY del usuario actual — lo que la pantalla de
  // Bitácora necesita para saber qué franjas ya tienen algo
  // logueado y cuáles todavía están pendientes.
  async findMyToday(userId: string) {

    const startOfDay = getStartOfTodayInLima()

    return this.prisma.activityLog.findMany({
      where: {
        userId,
        loggedAt: { gte: startOfDay },
      },
      include: {
        activityType: true,
        project: {
          select: { id: true, name: true, projectCode: true },
        },
        task: {
          select: { id: true, taskNumber: true, reference: true },
        },
      },
      orderBy: { loggedAt: "asc" },
    })

  }

  // Para supervisión/reportes — cualquiera con ACTIVITY_LOG_READ_ANY.
  // Filtro simple por ahora (usuario + rango de fechas); una pantalla
  // de reportes más completa puede construirse sobre este mismo
  // endpoint más adelante.
  async findAll(filters: { userId?: string; projectId?: string; taskId?: string; from?: Date; to?: Date }) {

    return this.prisma.activityLog.findMany({
      where: {
        userId: filters.userId,
        projectId: filters.projectId,
        taskId: filters.taskId,
        loggedAt: {
          gte: filters.from,
          lte: filters.to,
        },
      },
      include: {
        activityType: true,
        user: {
          select: { id: true, name: true, color: true, icon: true },
        },
        project: {
          select: { id: true, name: true, projectCode: true },
        },
        task: {
          select: { id: true, taskNumber: true, reference: true },
        },
      },
      orderBy: { loggedAt: "desc" },
    })

  }

}