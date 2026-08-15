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

@Injectable()
export class NestingJobService {
  private readonly jobs = new Map<string, NestJobRecord>()
  private readonly flags = new Map<string, { cancelled: boolean }>()

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
    const flag = { cancelled: false }
    this.flags.set(id, flag)
    setImmediate(() => this.execute(id, body, flag))
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
    const flag = this.flags.get(id)
    if (flag) flag.cancelled = true
    rec.status = 'cancelled'
    rec.updatedAt = Date.now()
    return rec
  }

  private execute(
    id: string,
    body: NestRunRequest,
    flag: { cancelled: boolean },
  ) {
    const rec = this.jobs.get(id)
    if (!rec) return
    if (flag.cancelled) {
      rec.status = 'cancelled'
      rec.updatedAt = Date.now()
      return
    }

    rec.status = 'running'
    rec.progress = 0.02
    rec.updatedAt = Date.now()

    try {
      const result = this.nesting.run(body, {
        signal: flag,
        onProgress: (p) => {
          if (flag.cancelled) return
          rec.progress = Math.min(0.99, Math.max(0.02, p))
          rec.updatedAt = Date.now()
        },
      })
      if (flag.cancelled) {
        rec.status = 'cancelled'
        rec.updatedAt = Date.now()
        return
      }
      rec.result = result
      rec.progress = 1
      rec.status = 'done'
      rec.updatedAt = Date.now()
    } catch (err) {
      if (flag.cancelled) {
        rec.status = 'cancelled'
      } else {
        rec.status = 'error'
        rec.error = err instanceof Error ? err.message : 'Nesting failed'
      }
      rec.updatedAt = Date.now()
    } finally {
      this.flags.delete(id)
      const hourAgo = Date.now() - 3600_000
      for (const [jid, j] of this.jobs) {
        if (j.updatedAt < hourAgo) this.jobs.delete(jid)
      }
    }
  }
}
