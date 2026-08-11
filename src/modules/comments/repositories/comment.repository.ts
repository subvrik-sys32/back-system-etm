import { Injectable } from "@nestjs/common"
import { PrismaService } from "@/infra/database/prisma/prisma.service"
import {
  commentInclude,
  myCommentInclude,
} from "../entities/comment.entity"

@Injectable()
export class CommentRepository {

  constructor(private readonly prisma: PrismaService) {}

  findAllByTask(taskId: string) {
    return this.prisma.comment.findMany({
      where: { taskId, workflowStepId: null, deletedAt: null },
      include: commentInclude,
      orderBy: { createdAt: "desc" },
    })
  }

  findAllByWorkflowStep(workflowStepId: string) {
    return this.prisma.comment.findMany({
      where: { workflowStepId, deletedAt: null },
      include: commentInclude,
      orderBy: { createdAt: "desc" },
    })
  }

  findAllByProject(projectId: string) {
    return this.prisma.comment.findMany({
      where: { projectId, deletedAt: null },
      include: commentInclude,
      orderBy: { createdAt: "desc" },
    })
  }

  /**
   * Comentarios del usuario autenticado, con contexto
   * tarea / proyecto / proceso (mismo criterio que notificaciones).
   */
  findAllByUserId(userId: string) {
    return this.prisma.comment.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: myCommentInclude,
      orderBy: { createdAt: "desc" },
    })
  }

  findById(id: string) {
    return this.prisma.comment.findFirst({
      where: { id, deletedAt: null },
      include: commentInclude,
    })
  }

  async getWorkflowStepTaskId(workflowStepId: string) {
    const step = await this.prisma.workflowStep.findUnique({
      where: { id: workflowStepId },
      select: { taskId: true },
    })
    return step?.taskId ?? null
  }

  createForTask(
    taskId: string,
    userId: string,
    message: string,
    imageUrl?: string | null,
    parentId?: string | null,
  ) {
    return this.prisma.comment.create({
      data: {
        taskId,
        userId,
        message: message.trim(),
        workflowStepId: null,
        imageUrl,
        parentId,
      },
      include: commentInclude,
    })
  }

  createForWorkflowStep(
    taskId: string,
    workflowStepId: string,
    userId: string,
    message: string,
    imageUrl?: string | null,
    parentId?: string | null,
  ) {
    return this.prisma.comment.create({
      data: {
        taskId,
        workflowStepId,
        userId,
        message: message.trim(),
        imageUrl,
        parentId,
      },
      include: commentInclude,
    })
  }

  createForProject(
    projectId: string,
    userId: string,
    message: string,
    imageUrl?: string | null,
    parentId?: string | null,
  ) {
    return this.prisma.comment.create({
      data: {
        projectId,
        userId,
        message: message.trim(),
        imageUrl,
        parentId,
      },
      include: commentInclude,
    })
  }

  update(id: string, message: string) {
    return this.prisma.comment.update({
      where: { id },
      data: { message: message.trim() },
      include: commentInclude,
    })
  }

  softDelete(id: string) {
    return this.prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  countByTaskId(taskId: string) {
    // Solo comentarios de la tarea, no de sus procesos
    // (createForWorkflowStep también setea taskId).
    return this.prisma.comment.count({
      where: { taskId, workflowStepId: null, deletedAt: null },
    })
  }

  countByProjectId(projectId: string) {
    return this.prisma.comment.count({
      where: { projectId, deletedAt: null },
    })
  }

  countByWorkflowStepId(workflowStepId: string) {
    return this.prisma.comment.count({
      where: { workflowStepId, deletedAt: null },
    })
  }
}
