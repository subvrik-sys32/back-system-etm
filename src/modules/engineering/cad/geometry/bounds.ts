import type { Point2D } from './point'
import type { GeometryEntity } from '../model/geometry-model'

export type BoundingBox = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function emptyBounds(): BoundingBox {
  return {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  }
}

export function isEmptyBounds(b: BoundingBox): boolean {
  return (
    !Number.isFinite(b.minX) ||
    !Number.isFinite(b.minY) ||
    !Number.isFinite(b.maxX) ||
    !Number.isFinite(b.maxY)
  )
}

export function boundsWidth(b: BoundingBox): number {
  return isEmptyBounds(b) ? 0 : b.maxX - b.minX
}

export function boundsHeight(b: BoundingBox): number {
  return isEmptyBounds(b) ? 0 : b.maxY - b.minY
}

function includePoint(b: BoundingBox, p: Point2D): void {
  if (p.x < b.minX) b.minX = p.x
  if (p.y < b.minY) b.minY = p.y
  if (p.x > b.maxX) b.maxX = p.x
  if (p.y > b.maxY) b.maxY = p.y
}

/** Bounds de una entidad (círculo/arco usan caja del radio completo). */
export function boundsOfEntity(entity: GeometryEntity): BoundingBox {
  const b = emptyBounds()
  switch (entity.type) {
    case 'LINE':
      includePoint(b, entity.start)
      includePoint(b, entity.end)
      break
    case 'CIRCLE':
      includePoint(b, {
        x: entity.center.x - entity.radius,
        y: entity.center.y - entity.radius,
      })
      includePoint(b, {
        x: entity.center.x + entity.radius,
        y: entity.center.y + entity.radius,
      })
      break
    case 'ARC':
      includePoint(b, {
        x: entity.center.x - entity.radius,
        y: entity.center.y - entity.radius,
      })
      includePoint(b, {
        x: entity.center.x + entity.radius,
        y: entity.center.y + entity.radius,
      })
      break
    case 'POLYLINE':
      for (const p of entity.points) includePoint(b, p)
      break
  }
  return b
}

export function unionBounds(a: BoundingBox, b: BoundingBox): BoundingBox {
  if (isEmptyBounds(a)) return { ...b }
  if (isEmptyBounds(b)) return { ...a }
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }
}

export function boundsOfEntities(entities: GeometryEntity[]): BoundingBox {
  let acc = emptyBounds()
  for (const e of entities) {
    acc = unionBounds(acc, boundsOfEntity(e))
  }
  return acc
}
