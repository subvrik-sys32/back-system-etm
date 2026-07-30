import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { ActivityDepartment, DayShift } from "@prisma/client"

import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { RealtimeService } from "@/modules/realtime/realtime.service"
import { SupabaseStorageService } from "@/infra/storage/supabase-storage.service"
import { RoleCode } from "@/core/enums/role-code.enum"
import type { CurrentUserType } from "@/shared/types/current-user.types"
import { BITACORA_DEPARTMENT_ROLES } from "./constants/bitacora-department-roles"

import { CreateActivityLogDto } from "./dto/create-activity-log.dto"
import { UpdateActivityLogDto } from "./dto/update-activity-log.dto"
import { CreateActivityTypeDto } from "./dto/create-activity-type.dto"
import { UpdateActivityTypeDto } from "./dto/update-activity-type.dto"
import { getLimaMinutesOfDay, getStartOfTodayInLima, getEndOfDayInLima } from "./utils/lima-time.util"

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

const ACTIVITY_LOG_PHOTOS_BUCKET = "activity-log-photos"

@Injectable()
export class ActivityLogService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly storage: SupabaseStorageService,
  ) {}

  // Delegado al método compartido de SupabaseStorageService (mismo
  // mecanismo que comentarios), con bucket propio.
  private uploadActivityPhoto(imageBase64: string): Promise<string> {
    return this.storage.uploadCompressedImage(ACTIVITY_LOG_PHOTOS_BUCKET, imageBase64)
  }

  // ---- Tipos de actividad ----

  // Algunas bitácoras departamentales son solo para ciertos roles —
  // a diferencia del resto (compartida por cualquiera con el
  // permiso general), acá el permiso no alcanza: se valida también
  // el rol contra BITACORA_DEPARTMENT_ROLES. Sin entrada ahí para
  // ese departamento, queda abierto a cualquiera con el permiso
  // (caso de Producción hoy). ADMIN pasa siempre.
  private assertDepartmentAccess(department: ActivityDepartment, roles: string[]) {

    const allowedRoles = BITACORA_DEPARTMENT_ROLES[department]

    if (!allowedRoles) {
      return
    }

    if (roles.includes(RoleCode.ADMIN)) {
      return
    }

    if (!allowedRoles.some(role => roles.includes(role))) {
      throw new ForbiddenException(
        `No tenés acceso a la bitácora de ${department.toLowerCase()}.`,
      )
    }

  }

  findAllTypes(includeInactive = false, department?: ActivityDepartment, roles?: string[]) {

    if (department && roles) {
      this.assertDepartmentAccess(department, roles)
    }

    return this.prisma.activityType.findMany({
      where: {
        deletedAt: null,
        ...(includeInactive ? {} : { active: true }),
        ...(department ? { department } : {}),
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
        pinned: dto.pinned ?? true,
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

  async create(userId: string, dto: CreateActivityLogDto, roles: string[]) {

    const type = await this.prisma.activityType.findUnique({
      where: { id: dto.activityTypeId },
      select: { id: true, deletedAt: true, department: true },
    })

    if (!type || type.deletedAt) {
      throw new NotFoundException("Tipo de actividad no encontrado")
    }

    this.assertDepartmentAccess(type.department, roles)

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

    // Si la persona eligió a mano una franja puntual en el picker
    // (aunque ya haya pasado — se olvidó y lo registra tarde), se
    // respeta esa franja tal cual. Antes esto SIEMPRE se
    // recalculaba por la hora real, así que un registro tardío
    // terminaba en la franja equivocada (la de "ahora", no la que
    // la persona quiso registrar).
    const shift = dto.shift ?? getShiftForDate(now)

    const photoUrl = dto.photoBase64
      ? await this.uploadActivityPhoto(dto.photoBase64)
      : null

    const log = await this.prisma.activityLog.create({
      data: {
        userId,
        activityTypeId: dto.activityTypeId,
        projectId: dto.projectId,
        taskId: dto.taskId,
        note: dto.note,
        photoUrl,
        shift,
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

  // Auto-registro al completar un WorkflowStep (ver
  // WorkflowService.complete()). A diferencia de create(): no pasa
  // por franja horaria (shift queda null — no es un registro
  // manual de turno), no sube foto, y queda linkeado al step vía
  // workflowStepId (constraint único en schema por (step, tipo):
  // como mucho un AUTO de este tipo por step). Es "fire and forget"
  // a propósito — si el tipo fijo no está sembrado o el insert
  // falla, no debe tumbar el completado real de la tarea, así que
  // el caller decide qué hacer con el error (ver comentario en
  // WorkflowService.complete()).
  async createFromTaskCompletion(params: {
    userId: string
    taskId: string
    projectId: string
    workflowStepId: string
  }) {

    const type = await this.prisma.activityType.findUnique({
      where: { code: "TASK_COMPLETED" },
      select: { id: true, deletedAt: true },
    })

    if (!type || type.deletedAt) {
      // No debería pasar (viene del seed), pero si el tipo fijo no
      // existe todavía en este ambiente, no tiene sentido reventar
      // el completado de la tarea por esto.
      return null
    }

    const now = new Date()

    const log = await this.prisma.activityLog.create({
      data: {
        userId: params.userId,
        activityTypeId: type.id,
        projectId: params.projectId,
        taskId: params.taskId,
        workflowStepId: params.workflowStepId,
        source: "AUTO",
        shift: null,
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

    this.realtime.publish({
      entity: "ACTIVITY_LOG",
      action: "CREATED",
      id: log.id,
      payload: log,
    })

    return log

  }

  // Auto-registro al iniciar un WorkflowStep (ver
  // WorkflowService.start()). Mismo patrón que
  // createFromTaskCompletion: linkeado al step vía workflowStepId
  // (constraint único por (step, tipo), ver @@unique en el schema),
  // source=AUTO, sin franja ni foto, y "fire and forget" — si el
  // tipo fijo no está sembrado o el insert falla, no debe tumbar el
  // inicio real del proceso, así que el caller decide qué hacer con
  // el error (ver comentario en WorkflowService.start()).
  async createFromTaskStart(params: {
    userId: string
    taskId: string
    projectId: string
    workflowStepId: string
  }) {

    const type = await this.prisma.activityType.findUnique({
      where: { code: "TASK_STARTED" },
      select: { id: true, deletedAt: true },
    })

    if (!type || type.deletedAt) {
      // No debería pasar (viene del seed), pero si el tipo fijo no
      // existe todavía en este ambiente, no tiene sentido reventar
      // el inicio de la tarea por esto.
      return null
    }

    const now = new Date()

    const log = await this.prisma.activityLog.create({
      data: {
        userId: params.userId,
        activityTypeId: type.id,
        projectId: params.projectId,
        taskId: params.taskId,
        workflowStepId: params.workflowStepId,
        source: "AUTO",
        shift: null,
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

    this.realtime.publish({
      entity: "ACTIVITY_LOG",
      action: "CREATED",
      id: log.id,
      payload: log,
    })

    return log

  }

  // Mueve una entrada a otra franja — el caso de "la registré en el
  // slot equivocado, la arrastro a la correcta" (ver
  // UpdateActivityLogDto). Mismo criterio de ownership que remove():
  // el dueño puede mover la suya, ACTIVITY_LOG_READ_ANY no alcanza
  // para mover entradas ajenas. Se reusa el permiso ACTIVITY_LOG_CREATE
  // (mover tu propio registro a otro slot es, en efecto, la misma
  // acción que crearlo ahí) en vez de sembrar un permiso nuevo solo
  // para esto — si más adelante esto crece a un editor completo
  // (activityType/project/note), ahí sí conviene separarlo.
  async update(id: string, dto: UpdateActivityLogDto, user: CurrentUserType) {

    const existing = await this.prisma.activityLog.findUnique({
      where: { id },
      select: { id: true, userId: true, source: true },
    })

    if (!existing) {
      throw new NotFoundException("Entrada de bitácora no encontrada")
    }

    if (existing.userId !== user.id) {
      throw new ForbiddenException("No podés mover una entrada de bitácora ajena.")
    }

    // Los AUTO (TASK_STARTED/TASK_COMPLETED) no pertenecen a
    // ninguna franja manual — no tiene sentido "arrastrarlos", y
    // permitirlo rompería el @@unique([workflowStepId, activityTypeId])
    // si alguna vez se los toca por otro lado.
    if (existing.source === "AUTO") {
      throw new ForbiddenException(
        "Las entradas automáticas no se pueden mover de franja.",
      )
    }

    const log = await this.prisma.activityLog.update({
      where: { id },
      data: { shift: dto.shift },
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

    this.realtime.publish({
      entity: "ACTIVITY_LOG",
      action: "UPDATED",
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
  // "me/today" es el nombre histórico del endpoint — sigue
  // devolviendo HOY si no se manda `date`, pero ahora también sirve
  // para navegar a un día puntual (ver DateNavigator en el
  // frontend, mismo mecanismo que la Bitácora del Equipo). Se
  // acota con un límite superior (getEndOfDayInLima) solo cuando
  // hay `date` explícito — sin eso, "hoy" se sigue comportando
  // igual que antes (sin tope, ya que no puede haber logs futuros).
  async findMyToday(userId: string, department?: ActivityDepartment, roles?: string[], date?: string) {

    if (department && roles) {
      this.assertDepartmentAccess(department, roles)
    }

    // Mediodía UTC del día pedido: evita que el parseo de la fecha
    // se corra un día para atrás/adelante por un redondeo de TZ,
    // sin importar en qué huso corra el servidor — getStartOfTodayInLima
    // solo necesita un instante que caiga dentro del día correcto en
    // Lima, no le importa la hora exacta.
    const referenceDate = date
      ? new Date(`${date}T12:00:00.000Z`)
      : new Date()

    const startOfDay = getStartOfTodayInLima(referenceDate)

    return this.prisma.activityLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: startOfDay,
          ...(date ? { lt: getEndOfDayInLima(referenceDate) } : {}),
        },
        ...(department
          ? { activityType: { department } }
          : {}),
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
  async findAll(filters: { userId?: string; projectId?: string; taskId?: string; from?: Date; to?: Date; department?: ActivityDepartment; roles?: string[] }) {

    if (filters.department && filters.roles) {
      this.assertDepartmentAccess(filters.department, filters.roles)
    }

    return this.prisma.activityLog.findMany({
      where: {
        userId: filters.userId,
        projectId: filters.projectId,
        taskId: filters.taskId,
        loggedAt: {
          gte: filters.from,
          lte: filters.to,
        },
        ...(filters.department
          ? { activityType: { department: filters.department } }
          : {}),
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