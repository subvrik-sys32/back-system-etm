import { Injectable } from "@nestjs/common"
import { PrismaService } from "@/infra/database/prisma/prisma.service"

const EMPTY_PROCESS_COUNTS = {
  CT: 0,
  PL: 0,
  SD: 0,
  PT: 0,
  EN: 0,
  DS: 0,
}

@Injectable()
export class SidebarService {

  constructor(private readonly prisma: PrismaService) {}

  async getCounts() {

    const [
      projectsCount,
      activeTasksCount,
      processGroups,
    ] = await Promise.all([

      this.prisma.project.count({
        where: {
          deletedAt: null,
          status: {
            code: { not: "COMPLETED" },
          },
        },
      }),

      this.prisma.task.count({
        where: {
          deletedAt: null,
          workflowSteps: {
            some: {
              status: { not: "REVIEWED" },
            },
          },
        },
      }),

      this.prisma.workflowStep.groupBy({
        by: ["processCode"],
        where: {
          status: { not: "REVIEWED" },
          task: { deletedAt: null },
        },
        _count: true,
      }),

    ])

    const processCounts = { ...EMPTY_PROCESS_COUNTS }

    for (const group of processGroups) {

      if (group.processCode in processCounts) {
        processCounts[group.processCode as keyof typeof processCounts] = group._count
      }

    }

    return {
      projectsCount,
      activeTasksCount,
      processCounts,
    }

  }

}