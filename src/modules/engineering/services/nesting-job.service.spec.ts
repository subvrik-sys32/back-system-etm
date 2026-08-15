import { NestingJobService } from './nesting-job.service'
import { NestingRunService } from './nesting-run.service'

describe('NestingJobService', () => {
  const nesting = new NestingRunService()
  const jobs = new NestingJobService(nesting)

  const body = {
    pieces: [
      {
        id: 'a',
        outline: {
          points: [
            { x: 0, y: 0 },
            { x: 50, y: 0 },
            { x: 50, y: 40 },
            { x: 0, y: 40 },
          ],
        },
        quantity: 1,
      },
    ],
    options: {
      sheet: { width: 200, height: 100, margin: 5 },
      mode: 'fast' as const,
      separation: 5,
    },
  }

  it('crea job y termina en done', async () => {
    const created = jobs.create(body)
    expect(created.id).toBeTruthy()
    expect(['queued', 'running', 'done']).toContain(created.status)

    await new Promise((r) => setTimeout(r, 50))
    const got = jobs.get(created.id)
    expect(got.status).toBe('done')
    expect(got.result?.sheetCount).toBeGreaterThanOrEqual(1)
    expect(got.progress).toBe(1)
  })
})
