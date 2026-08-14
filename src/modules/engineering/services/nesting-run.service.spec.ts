import { NestingRunService } from './nesting-run.service'

describe('NestingRunService', () => {
  const service = new NestingRunService()

  it('acomoda dos rectángulos en una plancha', () => {
    const rect = (id: string, w: number, h: number) => ({
      id,
      outline: {
        points: [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w, y: h },
          { x: 0, y: h },
        ],
      },
      quantity: 1,
    })

    const result = service.run({
      pieces: [rect('a', 100, 80), rect('b', 100, 80)],
      options: {
        sheet: { width: 300, height: 200, margin: 5 },
        mode: 'fast',
        separation: 5,
      },
    })

    expect(result.sheetCount).toBeGreaterThanOrEqual(1)
    expect(result.sheets[0].pieces.length).toBe(2)
    expect(result.pieceCount).toBe(2)
  })
})
