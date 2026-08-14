import type { Line2D } from '../geometry/line'
import type { Circle2D } from '../geometry/circle'
import type { Arc2D } from '../geometry/arc'
import type { Polyline2D } from '../geometry/polyline'
import type { BoundingBox } from '../geometry/bounds'
import { boundsOfEntities, emptyBounds, isEmptyBounds } from '../geometry/bounds'

export type GeometryEntity = Line2D | Circle2D | Arc2D | Polyline2D

export type LengthUnit = 'mm'

/**
 * Modelo geométrico puro — sin UI, sin DXF, sin nesting.
 * Es el contrato que generadores producen y que exporters/renderers consumen.
 */
export type GeometryModel = {
  units: LengthUnit
  entities: GeometryEntity[]
  bounds: BoundingBox
}

export function createGeometryModel(
  entities: GeometryEntity[],
  units: LengthUnit = 'mm',
): GeometryModel {
  const bounds = entities.length ? boundsOfEntities(entities) : emptyBounds()
  return { units, entities, bounds }
}

export function entityCount(model: GeometryModel): {
  lines: number
  circles: number
  arcs: number
  polylines: number
  total: number
} {
  let lines = 0
  let circles = 0
  let arcs = 0
  let polylines = 0
  for (const e of model.entities) {
    switch (e.type) {
      case 'LINE':
        lines++
        break
      case 'CIRCLE':
        circles++
        break
      case 'ARC':
        arcs++
        break
      case 'POLYLINE':
        polylines++
        break
    }
  }
  return {
    lines,
    circles,
    arcs,
    polylines,
    total: model.entities.length,
  }
}

export function hasValidBounds(model: GeometryModel): boolean {
  return !isEmptyBounds(model.bounds)
}
