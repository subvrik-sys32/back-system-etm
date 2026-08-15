import { NestingRunService } from './nesting-run.service'

describe('NestingRunService', () => {
  const service = new NestingRunService()

  function rect(id: string, w: number, h: number, holes = 0) {
    const outline = {
      points: [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
        { x: 0, y: 0 },
      ],
    }
    const subEntities: {
      outline: { points: { x: number; y: number }[] }
      color?: string
    }[] = [{ outline, color: '#0f0' }]
    for (let i = 0; i < holes; i++) {
      const cx = w * (0.25 + i * 0.25)
      const cy = h / 2
      const r = Math.min(w, h) * 0.08
      const pts: { x: number; y: number }[] = []
      for (let k = 0; k <= 12; k++) {
        const a = (k / 12) * Math.PI * 2
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
      }
      subEntities.push({ outline: { points: pts }, color: '#0f0' })
    }
    return { id, outline, subEntities, quantity: 1 }
  }

  it('acomoda dos rectángulos en una plancha', () => {
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
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('preserva agujeros (subEntities) tras el pack fast', () => {
    const result = service.run({
      pieces: [rect('plate', 200, 150, 4)],
      options: {
        sheet: { width: 500, height: 400, margin: 10 },
        mode: 'fast',
        separation: 5,
        searchStep: 5,
      },
    })
    const placed = result.sheets[0].pieces[0]
    expect(placed.subEntities?.length).toBe(5)
  })

  it('rechaza body inválido', () => {
    expect(() =>
      service.run({
        pieces: [],
        options: { sheet: { width: 100, height: 100, margin: 0 } },
      } as any),
    ).toThrow()
  })
})
