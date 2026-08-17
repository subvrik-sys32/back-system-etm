import { Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "@/prisma/prisma.service"
import { CreateEngineeringTaskDto } from "./dto/create-engineering-task.dto"
import { UpdateEngineeringTaskDto } from "./dto/update-engineering-task.dto"
import { EngineeringProcessCode } from "@prisma/client"

const include = {
  project: { select: { id: true, projectCode: true, name: true } },
  assignee: { select: { id: true, name: true, color: true, icon: true } },
} as const

@Injectable()
export class EngineeringTasksService {
  constructor(private readonly prisma: PrismaService) {}

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
      orderBy: [{ processCode: "asc" }, { position: "asc" }, { taskNumber: "asc" }],
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
    return this.prisma.engineeringTask.create({
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
  }

  async update(id: string, dto: UpdateEngineeringTaskDto, userId: string) {
    await this.findOne(id)
    return this.prisma.engineeringTask.update({
      where: { id },
      data: {
        ...dto,
        updatedById: userId,
      },
      include,
    })
  }

  async remove(id: string, userId: string) {
    await this.findOne(id)
    return this.prisma.engineeringTask.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
    })
  }
}
