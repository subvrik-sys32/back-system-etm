import { BadRequestException, Injectable } from "@nestjs/common"
import { WorkflowStatus } from "@prisma/client"

import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { RealtimeService } from "@/modules/realtime/realtime.service"
import { ActivityLogService } from "@/modules/activity-log/activity-log.service"
import { NotificationsService } from "@/modules/notifications/notifications.service"

import { WorkflowActionDto } from "./dto/workflow-action.dto"
import { UpdateWorkflowStepDto } from "./dto/update-workflow-step.dto"

import { OperatorCacheService } from "./services/operator-cache.service"

import {
  getStepForComplete,
  getStepForReview,
  getStepForReopen,
  getStepForStart,
  getStepForUpdate,
} from "./queries/workflow.queries"

import {
  updateWorkflowStep,
  reviewTransaction,
  reopenTransaction,
} from "./mutations/workflow.mutations"

import {
  validateCompleted,
  validateCompletePayload,
  validateEditable,
  validateOperatorAssigned,
  validatePaused,
  validatePending,
  validateProgress,
  validateReopen,
} from "./validators/workflow.validators"

type WorkflowDelta = {
  taskId: string
  updated: unknown[]
}

@Injectable()
export class WorkflowService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly operatorCache: OperatorCacheService,
    private readonly activityLog: ActivityLogService,
    private readonly notifications: NotificationsService,
  ) {}

  private publishDelta(
    { taskId, updated }: WorkflowDelta,
    userId: string,
  ) {

    const payload = { taskId, updated }

    this.realtime.publish({
      entity: "WORKFLOW",
      action: "UPDATED",
      id: taskId,
      payload,
      excludeUserId: userId,
    })

    this.realtime.publish({
      entity: "PROCESS",
      action: "UPDATED",
      id: taskId,
      payload,
      excludeUserId: userId,
    })

    return payload

  }

  private async transitionStatus(
    id: string,
    userId: string,
    expected: (status: WorkflowStatus) => void,
    data: (step: {
      status: WorkflowStatus
      operatorId: string | null
      startedAt: Date | null
    }) => Record<string, unknown>,
    // Opcional: pause/resume no lo pasan y siguen exactamente
    // igual que antes. Se dispara después de publishDelta (la
    // transición ya quedó persistida y publicada), pensado para
    // efectos secundarios tipo auto-registro en la Bitácora (ver
    // start() más abajo) que no deben bloquear ni poder tumbar la
    // respuesta si fallan.
    onSuccess?: (step: {
      id: string
      taskId: string
      status: WorkflowStatus
      operatorId: string | null
      startedAt: Date | null
      processCode: string
      task: { projectId: string }
    }) => void,
  ) {

    const step = await getStepForStart(
      this.prisma,
      id,
    )

    expected(step.status)

    const payload = data(step)

    const result = await updateWorkflowStep(
      this.prisma,
      this.operatorCache,
      id,
      payload,
    )

    const published = this.publishDelta(
      result,
      userId,
    )

    onSuccess?.(step)

    return published

  }

  async update(
    id: string,
    dto: UpdateWorkflowStepDto,
    userId: string,
  ) {

    const step = await getStepForUpdate(
      this.prisma,
      id,
    )

    validateEditable(
      step.status,
    )

    // Un operario PUEDE estar en PROGRESS en una tarea y seguir
    // asignado (sin iniciar) en otras. El conflicto de "ya trabaja
    // en otro proceso" solo aplica al *iniciar* (start), no al
    // setear operatorId desde el select de la fila.
    //
    // Asignación desde la fila (ProcessOperatorCell): SÍ notifica,
    // con actor = quien cambió el select. No es frágil:
    //  1) si había operario/invitación previa → retract de su noti
    //  2) limpia invite fields
    //  3) assignedById = actor (queda trazado quién asignó)
    //  4) solo notifica al NUEVO operario (no al vaciar a null)
    //  5) fallo de noti no tumba el PATCH
    const operatorChanging =
      dto.operatorId !== undefined && dto.operatorId !== step.operatorId

    const patch: Record<string, unknown> = {
      ...(dto.operatorId !== undefined && { operatorId: dto.operatorId }),
      ...(dto.piecesOutput !== undefined && { piecesOutput: dto.piecesOutput }),
      ...(dto.plRtReal !== undefined && { plRtReal: dto.plRtReal }),
      ...(dto.paintKgReal !== undefined && { paintKgReal: dto.paintKgReal }),
    }

    if (operatorChanging) {
      patch.invitedOperatorId = null
      patch.invitedById = null
      patch.invitedAt = null
      // Quién asignó desde la fila (o null si se desasignó).
      patch.assignedById = dto.operatorId ? userId : null

      // Destinatario de la noti anterior: invitado pendiente o el
      // operario que estaba puesto (haya sido por fila o convocatoria).
      const previousRecipient =
        step.invitedOperatorId ?? step.operatorId ?? null

      if (previousRecipient && previousRecipient !== dto.operatorId) {
        await this.notifications
          .retractTaskAssignment(step.id, previousRecipient)
          .catch(() => {})
      }
    }

    const result = await updateWorkflowStep(
      this.prisma,
      this.operatorCache,
      id,
      patch,
    )

    if (operatorChanging && dto.operatorId) {
      await this.notifications.notifyTaskAssignment({
        operatorId: dto.operatorId,
        actorId: userId,
        taskId: step.taskId,
        workflowStepId: step.id,
        type: "TASK_ASSIGNED",
        messageSnippet: "Te asignaron una tarea",
      }).catch(() => {
        // no crítico — la asignación ya se persistió
      })
    }

    return this.publishDelta(
      result,
      userId,
    )

  }

  async start(
    id: string,
    userId: string,
  ) {

    return this.transitionStatus(

      id,

      userId,

      status => {
        validatePending(status)
      },

      step => {

        validateOperatorAssigned(
          step.operatorId,
          "Debe asignar un operario antes de iniciar el proceso.",
        )

        return {
          status: WorkflowStatus.PROGRESS,
          startedAt: step.startedAt ?? new Date(),
        }

      },

      // Auto-registro en la Bitácora de Producción al iniciar —
      // mismo patrón "fire and forget" que complete(): si falla
      // (tipo fijo no sembrado en este ambiente, etc.), no debe
      // tumbar la respuesta de "proceso iniciado", que ya es la
      // parte crítica y ya se persistió arriba. El operatorId ya
      // se validó como asignado más arriba
      // (validateOperatorAssigned), así que siempre hay a quién
      // atribuirle el registro.
      step => {

        this.activityLog
          .createFromTaskStart({
            userId: step.operatorId as string,
            taskId: step.taskId,
            projectId: step.task.projectId,
            workflowStepId: step.id,
          })
          .catch(() => {
            // Error ya se pierde acá a propósito — ver comentario
            // de arriba.
          })

      },

    )

  }

  async pause(
    id: string,
    userId: string,
  ) {

    return this.transitionStatus(
      id,
      userId,
      status => validateProgress(status),
      () => ({
        status: WorkflowStatus.PAUSED,
      }),
    )

  }

  async resume(
    id: string,
    userId: string,
  ) {

    return this.transitionStatus(
      id,
      userId,
      status => validatePaused(status),
      () => ({
        status: WorkflowStatus.PROGRESS,
      }),
    )

  }

  async complete(
    id: string,
    dto: WorkflowActionDto,
    userId: string,
  ) {

    const step = await getStepForComplete(
      this.prisma,
      id,
    )

    validateProgress(step.status)

    validateOperatorAssigned(
      step.operatorId,
      "Debe registrar un operario.",
    )

    validateCompletePayload(
      step.processCode,
      dto,
    )

    const result = await updateWorkflowStep(
      this.prisma,
      this.operatorCache,
      id,
      {
        status: WorkflowStatus.COMPLETED,
        completedAt: new Date(),
        piecesOutput: dto.piecesOutput ?? null,
        plRtReal: dto.plRtReal ?? null,
        paintKgReal: dto.paintKgReal ?? null,
      },
    )

    // Auto-registro en la Bitácora de Producción — deliberadamente
    // "fire and forget": si por lo que sea falla (tipo fijo no
    // sembrado en este ambiente, etc.), no debe tumbar la respuesta
    // de "tarea completada", que ya es la parte crítica y ya se
    // persistió arriba. El operatorId ya se validó como asignado
    // más arriba (validateOperatorAssigned), así que siempre hay a
    // quién atribuirle el registro.
    this.activityLog
      .createFromTaskCompletion({
        userId: step.operatorId as string,
        taskId: step.taskId,
        projectId: step.task.projectId,
        workflowStepId: step.id,
      })
      .catch(() => {
        // Error ya se pierde acá a propósito — ver comentario de
        // arriba. Si en el futuro hace falta observabilidad de
        // esto, es el lugar para loguearlo.
      })

    return this.publishDelta(
      result,
      userId,
    )

  }

  async review(
    id: string,
    userId: string,
  ) {

    const step = await getStepForReview(
      this.prisma,
      id,
    )

    validateCompleted(
      step.status,
    )

    const nextStep = step.task.workflowSteps.find(
      item => item.order === step.order + 1,
    )

    const eligibleNextId =
      nextStep && nextStep.status === WorkflowStatus.QUEUE
        ? nextStep.id
        : undefined

    const result = await reviewTransaction(
      this.prisma,
      id,
      eligibleNextId,
    )

    return this.publishDelta(
      result,
      userId,
    )

  }

  async reopen(
    id: string,
    userId: string,
  ) {

    const step = await getStepForReopen(
      this.prisma,
      id,
    )

    validateReopen(
      step.status,
    )

    const nextStep = step.task.workflowSteps.find(
      item => item.order === step.order + 1,
    )

    const eligibleNextId =
      nextStep && (
        nextStep.status === WorkflowStatus.PENDING ||
        nextStep.status === WorkflowStatus.QUEUE
      )
        ? nextStep.id
        : undefined

    const result = await reopenTransaction(
      this.prisma,
      id,
      eligibleNextId,
    )

    return this.publishDelta(
      result,
      userId,
    )

  }

  // "Convocar" desde TaskAreaPanel — a propósito NO pasa por
  // transitionStatus/validators: no es una transición de estado del
  // workflow (QUEUE→PENDING→...), es metadata de asignación que
  // puede pasar en cualquier status. mode "ASSIGN" pone operatorId
  // ya mismo (mismo campo que ya usa ProcessOperatorCell al iniciar,
  // solo que acá con assignedById puesto para distinguir "me lo
  // asignaron" de "lo tomé yo"); mode "INVITE" NO toca operatorId,
  // solo deja la invitación pendiente hasta que el operario la
  // acepte desde su Mis tareas.
  async summon(
    stepIds: string[],
    operatorId: string,
    mode: "ASSIGN" | "INVITE",
    actorId: string,
  ) {

    const steps = await this.prisma.workflowStep.findMany({
      where: { id: { in: stepIds } },
      select: { id: true, taskId: true },
    })

    if (steps.length === 0) {
      throw new BadRequestException("No se encontraron los pasos indicados")
    }

    const invitedAt = new Date()

    // El patch real que se le acaba de aplicar a CADA step — sin
    // esto, propagateWorkflowUpdate (el que usan workflowHandler y
    // processHandler en el frontend) recibe {taskId} sin `updated`
    // y no hace nada: mismo bug que ACTIVITY_LOG, silencioso, cero
    // error en consola. Los demás usuarios mirando la misma tarea
    // se quedaban sin ver el cambio hasta refrescar la página.
    const patch =
      mode === "ASSIGN"
        ? {
            operatorId,
            assignedById: actorId,
            invitedOperatorId: null,
            invitedById: null,
            invitedAt: null,
          }
        : {
            invitedOperatorId: operatorId,
            invitedById: actorId,
            invitedAt,
          }

    await this.prisma.workflowStep.updateMany({
      where: { id: { in: stepIds } },
      data: patch,
    })

    for (const step of steps) {

      // Una notificación por tarea convocada — igual que
      // notifyComment, el fallo de esto no debería tumbar la
      // asignación real (que ya se persistió arriba).
      await this.notifications.notifyTaskAssignment({
        operatorId,
        actorId,
        taskId: step.taskId,
        workflowStepId: step.id,
        // Convocatoria del panel: siempre TASK_SUMMONED para que el
        // front diga "te convocó" (la fila usa TASK_ASSIGNED → "te asignó").
        // actorId queda en la noti → se ve quién lo hizo.
        type: "TASK_SUMMONED",
        messageSnippet:
          mode === "ASSIGN"
            ? "Te convocaron a una tarea"
            : "Te convocaron a una tarea — revisa Mis tareas",
      }).catch(() => {
        // no crítico, ver comentario arriba
      })

      this.publishDelta(
        { taskId: step.taskId, updated: [{ id: step.id, ...patch }] },
        actorId,
      )

    }

    return { success: true, count: steps.length }

  }

  async acceptInvite(stepId: string, userId: string) {

    const step = await this.prisma.workflowStep.findUnique({
      where: { id: stepId },
      select: { id: true, taskId: true, invitedOperatorId: true, invitedById: true },
    })

    if (!step || step.invitedOperatorId !== userId) {
      throw new BadRequestException("No tenés una invitación pendiente para este paso")
    }

    await this.prisma.workflowStep.update({
      where: { id: stepId },
      data: {
        operatorId: userId,
        assignedById: step.invitedById,
        invitedOperatorId: null,
        invitedById: null,
        invitedAt: null,
      },
    })

    // Avisar al convocante + retirar TASK_SUMMONED del operario.
    // Antes no se notificaba a nadie: el convocante no se enteraba
    // y la invitación le quedaba colgada al operario en la campana.
    if (step.invitedById) {
      await this.notifications.notifyInviteResponse({
        inviterId: step.invitedById,
        actorId: userId,
        taskId: step.taskId,
        workflowStepId: step.id,
        accepted: true,
      }).catch(() => {
        // no crítico — la aceptación ya se persistió arriba
      })
    }

    this.publishDelta(
      {
        taskId: step.taskId,
        updated: [{
          id: step.id,
          operatorId: userId,
          assignedById: step.invitedById,
          invitedOperatorId: null,
          invitedById: null,
          invitedAt: null,
        }],
      },
      userId,
    )

    return { success: true }

  }

  async declineInvite(stepId: string, userId: string) {

    const step = await this.prisma.workflowStep.findUnique({
      where: { id: stepId },
      select: { id: true, taskId: true, invitedOperatorId: true, invitedById: true },
    })

    if (!step || step.invitedOperatorId !== userId) {
      throw new BadRequestException("No tenés una invitación pendiente para este paso")
    }

    await this.prisma.workflowStep.update({
      where: { id: stepId },
      data: {
        invitedOperatorId: null,
        invitedById: null,
        invitedAt: null,
      },
    })

    if (step.invitedById) {
      await this.notifications.notifyInviteResponse({
        inviterId: step.invitedById,
        actorId: userId,
        taskId: step.taskId,
        workflowStepId: step.id,
        accepted: false,
      }).catch(() => {
        // no crítico — el rechazo ya se persistió arriba
      })
    }

    this.publishDelta(
      {
        taskId: step.taskId,
        updated: [{ id: step.id, invitedOperatorId: null, invitedById: null, invitedAt: null }],
      },
      userId,
    )

    return { success: true }

  }

  // "Desconvocar" — el supervisor deshace lo que hizo summon(),
  // sea ASSIGN (operatorId puesto ya mismo) o INVITE (invitación
  // pendiente): limpia los campos correspondientes Y borra la
  // notificación que se había mandado, para que no le quede
  // colgada a alguien que ya no tiene nada que ver con esto.
  async unsummon(stepId: string, actorId: string) {

    const step = await this.prisma.workflowStep.findUnique({
      where: { id: stepId },
      select: {
        id: true,
        taskId: true,
        operatorId: true,
        assignedById: true,
        invitedOperatorId: true,
      },
    })

    if (!step) {
      throw new BadRequestException("Paso no encontrado")
    }

    // A quién afecta esto — el destinatario de la notificación que
    // hay que retirar. Si fue INVITE, es el invitado; si fue ASSIGN
    // (via Convocar, no autoasignación normal), es el operatorId
    // actual.
    const affectedUserId = step.invitedOperatorId ?? (step.assignedById ? step.operatorId : null)

    if (!affectedUserId) {
      throw new BadRequestException("Este paso no tiene ninguna convocatoria activa para deshacer")
    }

    const clearedFields = {
      invitedOperatorId: null,
      invitedById: null,
      invitedAt: null,
    }

    const patch = step.assignedById
      ? { operatorId: null, assignedById: null, ...clearedFields }
      : clearedFields

    await this.prisma.workflowStep.update({
      where: { id: stepId },
      data: patch,
    })

    await this.notifications.retractTaskAssignment(step.id, affectedUserId).catch(() => {
      // no crítico — el cambio real (arriba) ya se persistió; si
      // esto falla, la notificación le queda colgada al operario
      // pero la convocatoria en sí ya se deshizo.
    })

    this.publishDelta(
      { taskId: step.taskId, updated: [{ id: step.id, ...patch }] },
      actorId,
    )

    return { success: true }

  }

}