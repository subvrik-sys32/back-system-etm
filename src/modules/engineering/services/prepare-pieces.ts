/**
 * Pre-proceso ANTES de pack.
 * fast  → identidad (geom completa; speed = AABB en heuristic).
 * precise → Douglas-Peucker + tope de features.
 */
import type {
  NestingPiece,
  PieceOutline,
  Point2D,
} from '../nesting/engine/types'

const MAX_OUTLINE_POINTS_PRECISE = 64
const MAX_SUB_ENTITIES_PRECISE = 80
const DP_EPSILON_MM = 0.35

function dist2(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function perpendicularDistance(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-12) return Math.sqrt(dist2(p, a))
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2),
  )
  const proj = { x: a.x + t * dx, y: a.y + t * dy }
  return Math.sqrt(dist2(p, proj))
}

export function simplifyOutline(
  outline: PieceOutline,
  epsilon = DP_EPSILON_MM,
  maxPoints = MAX_OUTLINE_POINTS_PRECISE,
): PieceOutline {
  const pts = outline.points
  if (pts.length <= 3) return outline

  const keep = new Uint8Array(pts.length)
  keep[0] = 1
  keep[pts.length - 1] = 1
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [i, j] = stack.pop()!
    let maxD = 0
    let maxIdx = i
    for (let k = i + 1; k < j; k++) {
      const d = perpendicularDistance(pts[k], pts[i], pts[j])
      if (d > maxD) {
        maxD = d
        maxIdx = k
      }
    }
    if (maxD > epsilon) {
      keep[maxIdx] = 1
      if (maxIdx - i > 1) stack.push([i, maxIdx])
      if (j - maxIdx > 1) stack.push([maxIdx, j])
    }
  }

  let simplified = pts.filter((_, i) => keep[i])
  if (simplified.length > maxPoints) {
    const step = (simplified.length - 1) / (maxPoints - 1)
    const out: Point2D[] = []
    for (let i = 0; i < maxPoints; i++) {
      out.push(simplified[Math.round(i * step)])
    }
    simplified = out
  }

  const first = simplified[0]
  const last = simplified[simplified.length - 1]
  if (
    first &&
    last &&
    (first.x !== last.x || first.y !== last.y) &&
    pts.length > 1 &&
    pts[0].x === pts[pts.length - 1].x &&
    pts[0].y === pts[pts.length - 1].y
  ) {
    simplified = [...simplified, { ...first }]
  }

  return { points: simplified }
}

export type PrepareMode = 'fast' | 'precise'

export function preparePiecesForPack(
  pieces: NestingPiece[],
  mode: PrepareMode = 'fast',
): NestingPiece[] {
  if (mode === 'fast') {
    return pieces
  }

  return pieces.map((p) => {
    const outline = simplifyOutline(p.outline)
    const subEntities = (p.subEntities ?? [])
      .slice(0, MAX_SUB_ENTITIES_PRECISE)
      .map((s) => ({
        ...s,
        outline: simplifyOutline(s.outline),
      }))
    return {
      ...p,
      outline,
      subEntities: subEntities.length ? subEntities : undefined,
    }
  })
}
