import type { GeometryModel, GeometryEntity } from '../model/geometry-model'
import type { NestingPiece, PieceOutline, SubEntity } from '../../nesting/engine/types'

const SEGMENTS_PER_FULL_CIRCLE = 64

function sampleCircle(
  cx: number,
  cy: number,
  r: number,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  for (let i = 0; i <= SEGMENTS_PER_FULL_CIRCLE; i++) {
    const a = (2 * Math.PI * i) / SEGMENTS_PER_FULL_CIRCLE
    points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return points
}

function sampleArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): { x: number; y: number }[] {
  let end = endDeg
  if (end <= startDeg) end += 360
  const sweep = end - startDeg
  const segments = Math.max(
    2,
    Math.round((sweep / 360) * SEGMENTS_PER_FULL_CIRCLE),
  )
  const points: { x: number; y: number }[] = []
  for (let i = 0; i <= segments; i++) {
    const deg = startDeg + (sweep * i) / segments
    const rad = (deg * Math.PI) / 180
    points.push({ x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) })
  }
  return points
}

function entityToOutline(e: GeometryEntity): PieceOutline | null {
  switch (e.type) {
    case 'LINE':
      return { points: [e.start, e.end] }
    case 'CIRCLE':
      return { points: sampleCircle(e.center.x, e.center.y, e.radius) }
    case 'ARC':
      return {
        points: sampleArc(
          e.center.x,
          e.center.y,
          e.radius,
          e.startAngle,
          e.endAngle,
        ),
      }
    case 'POLYLINE':
      return { points: [...e.points] }
    default:
      return null
  }
}

export type GeometryAsNestingPieceOptions = {
  id?: string
  quantity?: number
  color?: string
  thicknessMm?: number
}

/**
 * GeometryModel → NestingPiece para POST /engineering/nest.
 */
export function geometryModelToNestingPiece(
  model: GeometryModel,
  opts: GeometryAsNestingPieceOptions = {},
): NestingPiece {
  const { minX, minY, maxX, maxY } = model.bounds
  const outline: PieceOutline = {
    points: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
      { x: minX, y: minY },
    ],
  }

  const subEntities: SubEntity[] = []
  for (const e of model.entities) {
    const o = entityToOutline(e)
    if (!o || o.points.length < 2) continue
    subEntities.push({
      outline: o,
      color: e.type === 'CIRCLE' || e.type === 'ARC' ? '#f97316' : '#22c55e',
      layer: e.type === 'CIRCLE' || e.type === 'ARC' ? 'HOLE' : 'CUT',
    })
  }

  return {
    id: opts.id ?? `plate-${Date.now()}`,
    outline,
    subEntities,
    color: opts.color ?? '#22c55e',
    quantity: opts.quantity ?? 1,
    thicknessMm: opts.thicknessMm,
  }
}
