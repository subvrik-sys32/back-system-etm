import type { NestingPiece, Point2D } from '../nesting/engine/types'
import type { DrawEntity, DxfPiece } from '../pdf/dxf-geometry-parser'

function entityPoints(e: DrawEntity): Point2D[] {
  if (e.kind === 'polyline' && e.points?.length) {
    return e.points.map((p) => ({ x: p.x, y: p.y }))
  }
  if (e.kind === 'line' && e.x1 != null && e.y1 != null && e.x2 != null && e.y2 != null) {
    return [
      { x: e.x1, y: e.y1 },
      { x: e.x2, y: e.y2 },
    ]
  }
  if (e.kind === 'circle' && e.cx != null && e.cy != null && e.r != null) {
    const n = 24
    const pts: Point2D[] = []
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2
      pts.push({ x: e.cx + e.r * Math.cos(a), y: e.cy + e.r * Math.sin(a) })
    }
    return pts
  }
  if (
    e.kind === 'arc' &&
    e.cx != null &&
    e.cy != null &&
    e.r != null &&
    e.start != null &&
    e.end != null
  ) {
    const n = 16
    const pts: Point2D[] = []
    let a0 = e.start
    let a1 = e.end
    if (a1 < a0) a1 += Math.PI * 2
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n
      pts.push({ x: e.cx + e.r * Math.cos(a), y: e.cy + e.r * Math.sin(a) })
    }
    return pts
  }
  return []
}

function boundsOutline(points: Point2D[]) {
  if (!points.length) {
    return {
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: 0, y: 0 },
      ],
    }
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return {
    points: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
      { x: minX, y: minY },
    ],
  }
}

/** Multi-pieza: cada DxfPiece del geometry-parser → NestingPiece. */
export function dxfPiecesToNestingPieces(pieces: DxfPiece[]): NestingPiece[] {
  return pieces.map((p) => {
    const allPts: Point2D[] = []
    const subEntities: NonNullable<NestingPiece['subEntities']> = []
    for (const e of p.entities) {
      const pts = entityPoints(e)
      if (!pts.length) continue
      allPts.push(...pts)
      subEntities.push({
        outline: { points: pts },
        color: '#22c55e',
      })
    }
    return {
      id: p.id,
      outline: boundsOutline(allPts),
      subEntities: subEntities.length ? subEntities : undefined,
      quantity: Math.max(1, p.count || 1),
    }
  })
}
