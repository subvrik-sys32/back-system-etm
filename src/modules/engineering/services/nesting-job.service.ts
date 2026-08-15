import { Injectable, NotFoundException } from '@nestjs/common'
import {
  NestingRunService,
  type NestRunRequest,
  type NestRunResponse,
} from './nesting-run.service'
import { randomUUID } from 'crypto'

export type NestJobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled'

export type NestJobRecord = {
  id: string
  status: NestJobStatus
  progress: number
  createdAt: number
  updatedAt: number
  error?: string
  result?: NestRunResponse
}

/**
 * Jobs in-memory (proceso Nest). Suficiente para progress real en un solo nodo.
 * Para multi-instancia: Redis/Bull en una fase posterior.
 */
@Injectable()
export class NestingJobService {
  private readonly jobs = new Map<string, NestJobRecord>()
  private readonly controllers = new Map<string, AbortController>()

  constructor(private readonly nesting: NestingRunService) {}

  create(body: NestRunRequest): NestJobRecord {
    const id = randomUUID()
    const now = Date.now()
    const rec: NestJobRecord = {
      id,
      status: 'queued',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    }
    this.jobs.set(id, rec)

    const ac = new AbortController()
    this.controllers.set(id, ac)

    // No bloquear el request HTTP
    setImmediate(() => this.execute(id, body, ac))

    return rec
  }

  get(id: string): NestJobRecord {
    const rec = this.jobs.get(id)
    if (!rec) throw new NotFoundException(`Nest job ${id} not found`)
    return rec
  }

  cancel(id: string): NestJobRecord {
    const rec = this.get(id)
    if (rec.status === 'done' || rec.status === 'error') return rec
    this.controllers.get(id)?.abort()
    rec.status = 'cancelled'
    rec.updatedAt = Date.now()
    return rec
  }

  private execute(id: string, body: NestRunRequest, ac: AbortController) {
    const rec = this.jobs.get(id)
    if (!rec) return
    if (ac.signal.aborted) {
      rec.status = 'cancelled'
      rec.updatedAt = Date.now()
      return
    }

    rec.status = 'running'
    rec.progress = 0.05
    rec.updatedAt = Date.now()

    const tick = setInterval(() => {
      if (rec.status !== 'running') return
      if (rec.progress < 0.9) {
        rec.progress = rec.progress + (0.9 - rec.progress) * 0.15
        rec.updatedAt = Date.now()
      }
    }, 200)

    try {
      // El motor actual es sync; el progress simulado cubre la espera.
      // Cuando optimize acepte signal, se cablea cancel real mid-pack.
      if (ac.signal.aborted) {
        rec.status = 'cancelled'
        return
      }
      const result = this.nesting.run(body)
      if (ac.signal.aborted) {
        rec.status = 'cancelled'
        return
      }
      rec.result = result
      rec.progress = 1
      rec.status = 'done'
      rec.updatedAt = Date.now()
    } catch (err) {
      rec.status = 'error'
      rec.error = err instanceof Error ? err.message : 'Nesting failed'
      rec.updatedAt = Date.now()
    } finally {
      clearInterval(tick)
      this.controllers.delete(id)
      // GC suave: borrar jobs viejos (>1h)
      const hourAgo = Date.now() - 3600_000
      for (const [jid, j] of this.jobs) {
        if (j.updatedAt < hourAgo) this.jobs.delete(jid)
      }
    }
  }
}
