import type { GeometryEntity, GeometryModel } from '../../model/geometry-model'
import type { Point2D } from '../../geometry/point'

/**
 * Exportador DXF R12 mínimo a partir de GeometryModel.
 *
 * - Solo entidades de corte/dibujo (LINE, CIRCLE, ARC, POLYLINE).
 * - No conoce "placa", nesting ni UI.
 * - Ángulos de ARC: el modelo usa grados CCW desde +X (DXF); se
 *   escriben en grados como exige el formato.
 */

function pair(code: number, value: string | number): string {
  return `${code}\n${value}\n`
}

function entityLayer(e: { layer?: string }): string {
  return e.layer && e.layer.length > 0 ? e.layer : '0'
}

function writeLine(e: Extract<GeometryEntity, { type: 'LINE' }>): string {
  return (
    pair(0, 'LINE') +
    pair(8, entityLayer(e)) +
    pair(10, e.start.x) +
    pair(20, e.start.y) +
    pair(30, 0) +
    pair(11, e.end.x) +
    pair(21, e.end.y) +
    pair(31, 0)
  )
}

function writeCircle(e: Extract<GeometryEntity, { type: 'CIRCLE' }>): string {
  return (
    pair(0, 'CIRCLE') +
    pair(8, entityLayer(e)) +
    pair(10, e.center.x) +
    pair(20, e.center.y) +
    pair(30, 0) +
    pair(40, e.radius)
  )
}

function writeArc(e: Extract<GeometryEntity, { type: 'ARC' }>): string {
  return (
    pair(0, 'ARC') +
    pair(8, entityLayer(e)) +
    pair(10, e.center.x) +
    pair(20, e.center.y) +
    pair(30, 0) +
    pair(40, e.radius) +
    pair(50, e.startAngle) +
    pair(51, e.endAngle)
  )
}

function writePolyline(e: Extract<GeometryEntity, { type: 'POLYLINE' }>): string {
  // LWPOLYLINE (más compacto y estándar en CAD modernos)
  const closedFlag = e.closed ? 1 : 0
  let out =
    pair(0, 'LWPOLYLINE') +
    pair(8, entityLayer(e)) +
    pair(90, e.points.length) +
    pair(70, closedFlag)

  for (const p of e.points) {
    out += pair(10, p.x) + pair(20, p.y)
  }
  return out
}

function writeEntity(e: GeometryEntity): string {
  switch (e.type) {
    case 'LINE':
      return writeLine(e)
    case 'CIRCLE':
      return writeCircle(e)
    case 'ARC':
      return writeArc(e)
    case 'POLYLINE':
      return writePolyline(e)
    default: {
      const _exhaustive: never = e
      return _exhaustive
    }
  }
}

/**
 * Serializa GeometryModel → texto DXF R12-compatible.
 */
export function exportGeometryToDxf(model: GeometryModel): string {
  let body = ''
  for (const e of model.entities) {
    body += writeEntity(e)
  }

  // HEADER mínimo + ENTITIES + EOF
  return (
    pair(0, 'SECTION') +
    pair(2, 'HEADER') +
    pair(9, '$INSUNITS') +
    pair(70, model.units === 'mm' ? 4 : 0) + // 4 = millimeters
    pair(0, 'ENDSEC') +
    pair(0, 'SECTION') +
    pair(2, 'ENTITIES') +
    body +
    pair(0, 'ENDSEC') +
    pair(0, 'EOF')
  )
}

export function exportGeometryToDxfBuffer(model: GeometryModel): Buffer {
  return Buffer.from(exportGeometryToDxf(model), 'utf8')
}

/** Conteo rápido de entidades escritas (sanity en tests). */
export function countDxfEntityMarkers(dxf: string): {
  line: number
  circle: number
  arc: number
  lwpolyline: number
} {
  const lines = dxf.split('\n')
  let line = 0
  let circle = 0
  let arc = 0
  let lwpolyline = 0
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].trim() !== '0') continue
    const name = lines[i + 1]?.trim()
    if (name === 'LINE') line++
    else if (name === 'CIRCLE') circle++
    else if (name === 'ARC') arc++
    else if (name === 'LWPOLYLINE') lwpolyline++
  }
  return { line, circle, arc, lwpolyline }
}

// re-export point type for callers that build tests
export type { Point2D }
