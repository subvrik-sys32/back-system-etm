import { Injectable } from "@nestjs/common"

import { PrismaService } from "@/infra/database/prisma/prisma.service"

import { operatorSelect, OperatorLite } from "../constants/operator-select.constant"

const TTL_MS = 60_000

@Injectable()
export class OperatorCacheService {

  private cache = new Map<string, { data: OperatorLite; expiresAt: number }>()

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async get(id: string): Promise<OperatorLite | null> {

    const hit = this.cache.get(id)

    if (hit && hit.expiresAt > Date.now()) {
      return hit.data
    }

    const operator = await this.prisma.user.findUnique({
      where: { id },
      select: operatorSelect,
    })

    if (operator) {
      this.cache.set(id, {
        data: operator,
        expiresAt: Date.now() + TTL_MS,
      })
    }

    return operator

  }

  invalidate(id: string): void {
    this.cache.delete(id)
  }

}