import { optimize } from './optimize'
import { RectangleHeuristicStrategy } from './strategies/rectangle-heuristic'
import type { NestingPiece, NestingOptions } from './types'
import { boundingRect } from './geometry'

function rectPiece(
  id: string,
  w: number,
  h: number,
  opts?: { quantity?: number; holes?: { cx: number; cy: number; r: number }[] },
): NestingPiece {
  const outline = {
    points: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
      { x: 0, y: 0 },
    ],
  }
  const subEntities = [
    { outline, color: '#00ff00' },
    ...(opts?.holes ?? []).map((hole) => {
      const n = 16
      const pts: { x: number; y: number }[] = []
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2
        pts.push({
          x: hole.cx + hole.r * Math.cos(a),
          y: hole.cy + hole.r * Math.sin(a),
        })
      }
      return { outline: { points: pts }, color: '#00ff00' }
    }),
  ]
  return {
    id,
    outline,
    subEntities,
    quantity: opts?.quantity ?? 1,
  }
}

function aabbOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  pad: number,
): boolean {
  return !(
    a.x + a.width + pad <= b.x ||
    b.x + b.width + pad <= a.x ||
    a.y + a.height + pad <= b.y ||
    b.y + b.height + pad <= a.y
  )
}

const baseOpts = (over?: Partial<NestingOptions>): NestingOptions => ({
  sheet: { width: 1000, height: 500, margin: 10 },
  mode: 'fast',
  separation: 5,
  rotationMode: '0-90-180-270',
  searchStep: 2,
  ...over,
})

describe('RectangleHeuristicStrategy (parity baseline)', () => {
  const strategy = new RectangleHeuristicStrategy()

  it('coloca 2 rectángulos sin solape y con subEntities', () => {
    const pieces = [
      rectPiece('a', 100, 80, { holes: [{ cx: 50, cy: 40, r: 10 }] }),
      rectPiece('b', 100, 80, { holes: [{ cx: 50, cy: 40, r: 10 }] }),
    ]
    const sheets = strategy.optimize(pieces, baseOpts())
    expect(sheets.length).toBe(1)
    expect(sheets[0].pieces.length).toBe(2)
    for (const p of sheets[0].pieces) {
      expect(p.subEntities?.length).toBeGreaterThanOrEqual(2)
    }
    const [p0, p1] = sheets[0].pieces
    const b0 = boundingRect(p0.outline)
    const b1 = boundingRect(p1.outline)
    expect(aabbOverlap(b0, b1, 4.9)).toBe(false)
  })

  it('respeta quantity expandiendo instancias', () => {
    const pieces = [rectPiece('plate', 200, 100, { quantity: 4 })]
    const sheets = strategy.optimize(pieces, baseOpts({
      sheet: { width: 450, height: 250, margin: 5 },
      separation: 5,
      searchStep: 5,
    }))
    const total = sheets.reduce((n, s) => n + s.pieces.length, 0)
    expect(total).toBe(4)
  })

  it('abre segunda plancha si no caben', () => {
    const pieces = [
      rectPiece('big1', 400, 400),
      rectPiece('big2', 400, 400),
    ]
    const sheets = strategy.optimize(pieces, baseOpts({
      sheet: { width: 500, height: 500, margin: 10 },
      separation: 5,
      searchStep: 10,
    }))
    expect(sheets.length).toBeGreaterThanOrEqual(2)
  })

  it('optimize() no pierde huecos en el resultado', () => {
    const pieces = [
      rectPiece('p', 120, 90, {
        holes: [
          { cx: 30, cy: 30, r: 8 },
          { cx: 90, cy: 60, r: 8 },
        ],
      }),
    ]
    const sheets = optimize(pieces, baseOpts())
    expect(sheets[0].pieces[0].subEntities!.length).toBe(3)
  })

  it('separa por espesor en planchas distintas', () => {
    const a = { ...rectPiece('t1', 50, 50), thicknessMm: 2 }
    const b = { ...rectPiece('t2', 50, 50), thicknessMm: 3 }
    const sheets = optimize([a, b], baseOpts())
    expect(sheets.length).toBe(2)
    const thicknesses = sheets.map((s) => s.thicknessMm).sort()
    expect(thicknesses).toEqual([2, 3])
  })
})
