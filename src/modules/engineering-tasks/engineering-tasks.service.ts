import { Injectable, NotFoundException } from "@nestjs/common"
import { EngineeringProcessCode } from "@prisma/client"

import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { NotificationsService } from "@/modules/notifications/notifications.service"

import { CreateEngineeringTaskDto } from "./dto/create-engineering-task.dto"
import { UpdateEngineeringTaskDto } from "./dto/update-engineering-task.dto"

const include = {
  project: {
    select: {
      id: true,
      projectCode: true,
      name: true,
      client: { select: { id: true, name: true, color: true } },
    },
  },
  assignee: { select: { id: true, name: true, color: true, icon: true } },
} as const

@Injectable()
export class EngineeringTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  findAll(filters: {
    projectId?: string
    processCode?: EngineeringProcessCode
    assigneeId?: string
  }) {
    return this.prisma.engineeringTask.findMany({
      where: {
        deletedAt: null,
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.processCode ? { processCode: filters.processCode } : {}),
        ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      },
      include,
      orderBy: [
        { processCode: "asc" },
        { position: "asc" },
        { taskNumber: "asc" },
      ],
    })
  }

  async findOne(id: string) {
    const row = await this.prisma.engineeringTask.findFirst({
      where: { id, deletedAt: null },
      include,
    })
    if (!row) throw new NotFoundException("Engineering task not found")
    return row
  }

  async create(dto: CreateEngineeringTaskDto, userId: string) {
    const max = await this.prisma.engineeringTask.aggregate({
      _max: { taskNumber: true },
    })
    const taskNumber = (max._max.taskNumber ?? 0) + 1

    const row = await this.prisma.engineeringTask.create({
      data: {
        taskNumber,
        title: dto.title,
        projectId: dto.projectId,
        processCode: dto.processCode,
        assigneeId: dto.assigneeId,
        note: dto.note,
        createdById: userId,
        updatedById: userId,
      },
      include,
    })

    if (dto.assigneeId) {
      await this.notifications
        .notifyEngineeringTaskAssigned({
          assigneeId: dto.assigneeId,
          actorId: userId,
          engineeringTaskId: row.id,
          projectId: row.projectId,
          messageSnippet: `#${String(row.taskNumber).padStart(3, "0")} · ${row.title}`,
        })
        .catch(() => {})
    }

    return row
  }

  async update(id: string, dto: UpdateEngineeringTaskDto, userId: string) {
    const prev = await this.findOne(id)

    const row = await this.prisma.engineeringTask.update({
      where: { id },
      data: {
        ...dto,
        updatedById: userId,
      },
      include,
    })

    // Solo si el DTO toca assigneeId
    if (Object.prototype.hasOwnProperty.call(dto, "assigneeId")) {
      const nextId = dto.assigneeId ?? null
      const prevId = prev.assigneeId ?? null

      if (prevId && prevId !== nextId) {
        await this.notifications
          .retractEngineeringTaskAssigned(id, prevId)
          .catch(() => {})
      }

      if (nextId && nextId !== prevId) {
        await this.notifications
          .notifyEngineeringTaskAssigned({
            assigneeId: nextId,
            actorId: userId,
            engineeringTaskId: row.id,
            projectId: row.projectId,
            messageSnippet: `#${String(row.taskNumber).padStart(3, "0")} · ${row.title}`,
          })
          .catch(() => {})
      }
    }

    return row
  }

  async remove(id: string, userId: string) {
    const prev = await this.findOne(id)
    if (prev.assigneeId) {
      await this.notifications
        .retractEngineeringTaskAssigned(id, prev.assigneeId)
        .catch(() => {})
    }
    return this.prisma.engineeringTask.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: userId,
      },
      include,
    })
  }
}
