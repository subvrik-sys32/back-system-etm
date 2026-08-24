/**
 * dxf-geometry-parser.ts
 *
 * Convierte las entidades crudas de `dxf-parser` en piezas individuales
 * listas para el reporte PDF / nesting.
 *
 * DECISIÓN CLAVE (v2): las piezas NO se agrupan por `layer`. En un DXF
 * de corte anidado real, todas las piezas suelen vivir en la misma capa
 * (o en un puñado de capas por función: corte/doblez/grabado), así que
 * agrupar por capa produce UNA sola "pieza" gigante (el layout completo)
 * en vez de piezas individuales. En su lugar:
 *
 *   1. Se agrupan las entidades por CONECTIVIDAD GEOMÉTRICA: líneas,
 *      arcos y polilíneas abiertas que comparten un extremo (dentro de
 *      una tolerancia) se consideran parte del mismo contorno. Una
 *      polilínea cerrada ya es un contorno completo por sí sola.
 *   2. Cada contorno resultante es un candidato a "pieza".
 *   3. Si el bounding box de un contorno queda completamente dentro del
 *      bounding box de otro contorno más grande, se reclasifica como
 *      un AGUJERO/detalle interno de ese contorno mayor (no como pieza
 *      independiente).
 *   4. Los CIRCLE (que no tienen extremos que conectar) se asignan como
 *      agujero de la pieza cuyo bounding box los contiene.
 *   5. Piezas con la misma geometría (ancho, alto, agujeros) se
 *      fusionan sumando su "Cantidad".
 *
 * v3 (fidelidad geométrica):
 *   - LWPOLYLINE/POLYLINE respetan **bulge** (arcos entre vértices).
 *   - Radios de CIRCLE/ARC se toman en valor absoluto.
 *
 * Notas sobre dxf-parser:
 *  - El centro de CIRCLE y ARC viene en `entity.center`, no en `position`.
 *  - Los ángulos de ARC ya vienen en RADIANES.
 *  - Vértices de LWPOLYLINE pueden traer `bulge` (tan(θ/4)).
 */

export interface DrawEntity {
  kind: 'line' | 'polyline' | 'circle' | 'arc'
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  points?: { x: number; y: number }[]
  closed?: boolean
  cx?: number
  cy?: number
  r?: number
  start?: number
  end?: number
  layer?: string
  colorCode?: number
}

export interface DxfPiece {
  id: string
  width: number
  height: number
  holes: number
  count: number
  area: number
  entities: DrawEntity[]
}

export interface DxfLayout {
  entities: DrawEntity[]
  width: number
  height: number
}

export interface DxfGeometryResult {
  pieces: DxfPiece[]
  layout: DxfLayout
}

interface Point {
  x: number
  y: number
}

interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/** Tolerancia para considerar que dos puntos son "el mismo" extremo. */
const POINT_TOLERANCE = 0.01 // mm
const ARC_SAMPLE_POINTS = 16
const BULGE_SEGMENTS_PER_CIRCLE = 64

// ---------------------------------------------------------------------------
// Entrada pública
// ---------------------------------------------------------------------------

export function parseDxfGeometry(rawEntities: any[]): DxfGeometryResult {
  if (!rawEntities || rawEntities.length === 0) {
    return { pieces: [], layout: { entities: [], width: 0, height: 0 } }
  }

  const { segments, circles, allForLayout } = collectEntities(rawEntities)

  const contours = groupIntoContours(segments)
  const {
    outerContours,
    holeCountByContour,
    holeAreaByContour,
    holeContoursByOuter,
  } = classifyContours(contours)
  assignCirclesToContours(
    circles,
    outerContours,
    holeCountByContour,
    holeAreaByContour,
  )

  const rawPieces = outerContours.map((c) =>
    buildPiece(c, holeCountByContour, holeAreaByContour, holeContoursByOuter),
  )
  const pieces = mergeDuplicates(
    rawPieces.filter((p) => p.width > 0 && p.height > 0),
  )

  const layout = buildLayout(allForLayout)

  return { pieces, layout }
}

// ---------------------------------------------------------------------------
// Paso 1: normalizar entidades crudas de dxf-parser a DrawEntity + puntos
// ---------------------------------------------------------------------------

interface SegmentEntity {
  entity: DrawEntity
  /** Todos los puntos de la entidad (para bbox / área). */
  points: Point[]
  /** Extremos usables para conectar con otras entidades (vacío = no conecta). */
  endpoints: Point[]
}

interface CircleEntity {
  entity: DrawEntity
  center: Point
}

/**
 * bulge = tan(θ/4). Convierte el arco entre p1→p2 en puntos (sin incluir p1).
 * Misma fórmula que cad/rich/geometry-sampling.ts.
 */
function sampleBulgePoints(p1: Point, p2: Point, bulge: number): Point[] {
  if (Math.abs(bulge) < 1e-6) return [p2]
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const chord = Math.hypot(dx, dy)
  if (chord < 1e-6) return [p2]

  const theta = 4 * Math.atan(bulge)
  const radius = Math.abs(chord / (2 * Math.sin(theta / 2)))
  if (!Number.isFinite(radius) || radius < 1e-9) return [p2]

  const sagitta = (chord / 2) * ((1 - bulge * bulge) / (2 * bulge))
  const alpha = Math.atan2(dy, dx)
  const cx = (p1.x + p2.x) / 2 - sagitta * Math.sin(alpha)
  const cy = (p1.y + p2.y) / 2 + sagitta * Math.cos(alpha)

  const start = Math.atan2(p1.y - cy, p1.x - cx)
  const sweep = theta
  const n = Math.max(
    2,
    Math.round((Math.abs(sweep) / (Math.PI * 2)) * BULGE_SEGMENTS_PER_CIRCLE),
  )
  const pts: Point[] = []
  for (let i = 1; i <= n; i++) {
    const a = start + (sweep * i) / n
    pts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) })
  }
  return pts
}

/** Expande vértices DXF (con bulge opcional) a polilínea densa. */
function expandPolylineVertices(vertices: any[]): Point[] {
  if (!vertices?.length) return []
  const verts = vertices
    .filter((v: any) => v && v.x !== undefined && v.y !== undefined)
    .map((v: any) => ({
      x: Number(v.x),
      y: Number(v.y),
      bulge: Number(v.bulge ?? 0),
    }))
  if (verts.length < 2) {
    return verts.map((v) => ({ x: v.x, y: v.y }))
  }

  const out: Point[] = [{ x: verts[0].x, y: verts[0].y }]
  for (let i = 0; i < verts.length - 1; i++) {
    const a = verts[i]
    const b = verts[i + 1]
    if (Math.abs(a.bulge) < 1e-6) {
      out.push({ x: b.x, y: b.y })
    } else {
      out.push(
        ...sampleBulgePoints(
          { x: a.x, y: a.y },
          { x: b.x, y: b.y },
          a.bulge,
        ),
      )
    }
  }
  return out
}

function collectEntities(rawEntities: any[]): {
  segments: SegmentEntity[]
  circles: CircleEntity[]
  allForLayout: DrawEntity[]
} {
  const segments: SegmentEntity[] = []
  const circles: CircleEntity[] = []
  const allForLayout: DrawEntity[] = []

  for (const e of rawEntities) {
    switch (e.type) {
      case 'CIRCLE': {
        const r: number = Math.abs(e.radius || 0)
        if (r < 1e-9) break
        const cx: number = e.center?.x ?? 0
        const cy: number = e.center?.y ?? 0
        const entity: DrawEntity = {
          kind: 'circle',
          cx,
          cy,
          r,
          layer: e.layer,
          colorCode: e.color,
        }
        circles.push({ entity, center: { x: cx, y: cy } })
        allForLayout.push(entity)
        break
      }

      case 'ARC': {
        const r: number = Math.abs(e.radius || 0)
        if (r < 1e-9) break
        const cx: number = e.center?.x ?? 0
        const cy: number = e.center?.y ?? 0
        const start: number = e.startAngle ?? 0
        const end: number = e.endAngle ?? Math.PI * 2
        const entity: DrawEntity = {
          kind: 'arc',
          cx,
          cy,
          r,
          start,
          end,
          layer: e.layer,
          colorCode: e.color,
        }
        allForLayout.push(entity)

        const sampled = sampleArc(cx, cy, r, start, end)
        segments.push({
          entity,
          points: sampled,
          endpoints: [sampled[0], sampled[sampled.length - 1]],
        })
        break
      }

      case 'LWPOLYLINE':
      case 'POLYLINE': {
        const points = expandPolylineVertices(e.vertices || [])
        if (points.length < 2) break

        const flaggedClosed = !!e.shape || !!e.closed
        const visuallyClosed = samePoint(points[0], points[points.length - 1])
        const closed = flaggedClosed || visuallyClosed

        const entity: DrawEntity = {
          kind: 'polyline',
          points,
          closed,
          layer: e.layer,
          colorCode: e.color,
        }
        allForLayout.push(entity)

        segments.push({
          entity,
          points,
          // Una polilínea cerrada ya es un contorno completo: no necesita
          // conectarse con nada más, así que no exponemos extremos.
          endpoints: closed ? [] : [points[0], points[points.length - 1]],
        })
        break
      }

      case 'LINE': {
        const a = e.vertices?.[0] ?? e.start
        const b = e.vertices?.[1] ?? e.end
        if (!a || !b || a.x === undefined || b.x === undefined) break

        const entity: DrawEntity = {
          kind: 'line',
          x1: a.x,
          y1: a.y,
          x2: b.x,
          y2: b.y,
          layer: e.layer,
          colorCode: e.color,
        }
        allForLayout.push(entity)

        segments.push({
          entity,
          points: [
            { x: a.x, y: a.y },
            { x: b.x, y: b.y },
          ],
          endpoints: [
            { x: a.x, y: a.y },
            { x: b.x, y: b.y },
          ],
        })
        break
      }

      default:
        // HATCH, SPLINE, INSERT (ya explotado en cad-parse), DIMENSION, TEXT…
        break
    }
  }

  return { segments, circles, allForLayout }
}

function sampleArc(
  cx: number,
  cy: number,
  r: number,
  start: number,
  end: number,
): Point[] {
  const pts: Point[] = []
  let a0 = start
  let a1 = end
  if (a1 < a0) a1 += Math.PI * 2
  for (let i = 0; i <= ARC_SAMPLE_POINTS; i++) {
    const t = a0 + ((a1 - a0) * i) / ARC_SAMPLE_POINTS
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) })
  }
  return pts
}

function samePoint(a: Point, b: Point): boolean {
  return (
    Math.abs(a.x - b.x) <= POINT_TOLERANCE &&
    Math.abs(a.y - b.y) <= POINT_TOLERANCE
  )
}

// ---------------------------------------------------------------------------
// Paso 2: agrupar segmentos en contornos por conectividad (Union-Find)
// ---------------------------------------------------------------------------

interface Contour {
  members: SegmentEntity[]
  bounds: Bounds
  /** true si el contorno es exactamente una única polilínea cerrada. */
  isSingleClosedPolyline: boolean
}

function groupIntoContours(segments: SegmentEntity[]): Contour[] {
  const n = segments.length
  if (n === 0) return []

  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }

  const pointIndex = new Map<string, number[]>()
  const keyFor = (p: Point) =>
    `${Math.round(p.x / POINT_TOLERANCE)}:${Math.round(p.y / POINT_TOLERANCE)}`

  segments.forEach((seg, idx) => {
    for (const ep of seg.endpoints) {
      const key = keyFor(ep)
      const bucket = pointIndex.get(key)
      if (bucket) {
        for (const other of bucket) union(idx, other)
        bucket.push(idx)
      } else {
        pointIndex.set(key, [idx])
      }
    }
  })

  const groups = new Map<number, SegmentEntity[]>()
  segments.forEach((seg, idx) => {
    const root = find(idx)
    const arr = groups.get(root)
    if (arr) arr.push(seg)
    else groups.set(root, [seg])
  })

  return Array.from(groups.values()).map((members) => {
    const bounds = boundsOf(members.flatMap((m) => m.points))
    const isSingleClosedPolyline =
      members.length === 1 &&
      members[0].entity.kind === 'polyline' &&
      !!members[0].entity.closed
    return { members, bounds, isSingleClosedPolyline }
  })
}

function boundsOf(points: Point[]): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY }
}

// ---------------------------------------------------------------------------
// Paso 3: distinguir contornos "pieza" de contornos "agujero/detalle interno"
// ---------------------------------------------------------------------------

const HOLE_MAX_RATIO = 0.25
const CHILDREN_SUM_MAX_RATIO = 0.6

function classifyContours(contours: Contour[]): {
  outerContours: Contour[]
  holeCountByContour: Map<Contour, number>
  holeAreaByContour: Map<Contour, number>
  holeContoursByOuter: Map<Contour, Contour[]>
} {
  const holeCountByContour = new Map<Contour, number>()
  const holeAreaByContour = new Map<Contour, number>()
  const holeContoursByOuter = new Map<Contour, Contour[]>()

  const byAreaDesc = [...contours].sort(
    (a, b) => bboxArea(b.bounds) - bboxArea(a.bounds),
  )

  const outer: Contour[] = []
  const excluded = new Set<Contour>()
  const demoted = new Set<Contour>()

  for (const candidate of byAreaDesc) {
    if (demoted.has(candidate) || excluded.has(candidate)) continue

    const children = byAreaDesc.filter(
      (c) =>
        c !== candidate &&
        !demoted.has(c) &&
        !excluded.has(c) &&
        contains(candidate.bounds, c.bounds),
    )

    if (children.length === 0) {
      outer.push(candidate)
      continue
    }

    const candidateArea = bboxArea(candidate.bounds)
    const maxChildArea = Math.max(...children.map((c) => bboxArea(c.bounds)))
    const sumChildArea = children.reduce(
      (sum, c) => sum + bboxArea(c.bounds),
      0,
    )

    const looksLikeContainer =
      maxChildArea > candidateArea * HOLE_MAX_RATIO ||
      sumChildArea > candidateArea * CHILDREN_SUM_MAX_RATIO

    if (looksLikeContainer) {
      excluded.add(candidate)
      continue
    }

    outer.push(candidate)
    const holeContours: Contour[] = []
    for (const child of children) {
      demoted.add(child)
      holeContours.push(child)
      holeCountByContour.set(
        candidate,
        (holeCountByContour.get(candidate) || 0) + 1,
      )
      const area = contourArea(child)
      if (area > 0) {
        holeAreaByContour.set(
          candidate,
          (holeAreaByContour.get(candidate) || 0) + area,
        )
      }
    }
    holeContoursByOuter.set(candidate, holeContours)
  }

  return {
    outerContours: outer,
    holeCountByContour,
    holeAreaByContour,
    holeContoursByOuter,
  }
}

function bboxArea(b: Bounds): number {
  return Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxY - b.minY)
}

function contains(outer: Bounds, inner: Bounds): boolean {
  const margin = POINT_TOLERANCE
  return (
    inner.minX >= outer.minX - margin &&
    inner.maxX <= outer.maxX + margin &&
    inner.minY >= outer.minY - margin &&
    inner.maxY <= outer.maxY + margin &&
    (inner.minX > outer.minX + margin ||
      inner.maxX < outer.maxX - margin ||
      inner.minY > outer.minY + margin ||
      inner.maxY < outer.maxY - margin)
  )
}

function contourArea(c: Contour): number {
  if (c.isSingleClosedPolyline) {
    return Math.abs(shoelace(c.members[0].points))
  }
  return bboxArea(c.bounds)
}

function shoelace(points: Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

// ---------------------------------------------------------------------------
// Paso 4: asignar círculos (agujeros) a la pieza que los contiene
// ---------------------------------------------------------------------------

function assignCirclesToContours(
  circles: CircleEntity[],
  outerContours: Contour[],
  holeCountByContour: Map<Contour, number>,
  holeAreaByContour: Map<Contour, number>,
): void {
  for (const circle of circles) {
    const parent = outerContours.find((c) =>
      pointInBounds(circle.center, c.bounds),
    )
    if (!parent) continue

    holeCountByContour.set(parent, (holeCountByContour.get(parent) || 0) + 1)
    const r = circle.entity.r || 0
    holeAreaByContour.set(
      parent,
      (holeAreaByContour.get(parent) || 0) + Math.PI * r * r,
    )

    ;(parent as any)._extraCircles = (parent as any)._extraCircles || []
    ;(parent as any)._extraCircles.push(circle.entity)
  }
}

function pointInBounds(p: Point, b: Bounds): boolean {
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY
}

// ---------------------------------------------------------------------------
// Paso 5: construir la pieza final (normalizada a su propio origen)
// ---------------------------------------------------------------------------

function buildPiece(
  contour: Contour,
  holeCountByContour: Map<Contour, number>,
  holeAreaByContour: Map<Contour, number>,
  holeContoursByOuter: Map<Contour, Contour[]>,
): DxfPiece {
  const { minX, minY, maxX, maxY } = contour.bounds
  const width = maxX - minX
  const height = maxY - minY

  const ownEntities = contour.members.map((m) =>
    normalize(m.entity, minX, minY),
  )
  const extraCircles: DrawEntity[] = (
    (contour as any)._extraCircles || []
  ).map((e: DrawEntity) => normalize(e, minX, minY))

  const holeContours = holeContoursByOuter.get(contour) || []
  const holeEntities: DrawEntity[] = holeContours.flatMap((hc) =>
    hc.members.map((m) => normalize(m.entity, minX, minY)),
  )

  const outerArea = contourArea(contour)
  const holesArea = holeAreaByContour.get(contour) || 0
  const netArea = Math.max(0, outerArea - holesArea)

  return {
    id: `pieza-${Math.round(minX)}-${Math.round(minY)}`,
    width: round2(width),
    height: round2(height),
    holes: holeCountByContour.get(contour) || 0,
    count: 1,
    area: round2(netArea),
    entities: [...ownEntities, ...holeEntities, ...extraCircles],
  }
}

function normalize(e: DrawEntity, minX: number, minY: number): DrawEntity {
  const layer = e.layer
  const colorCode = e.colorCode
  switch (e.kind) {
    case 'circle':
      return {
        kind: 'circle',
        cx: e.cx! - minX,
        cy: e.cy! - minY,
        r: e.r,
        layer,
        colorCode,
      }
    case 'arc':
      return {
        kind: 'arc',
        cx: e.cx! - minX,
        cy: e.cy! - minY,
        r: e.r,
        start: e.start,
        end: e.end,
        layer,
        colorCode,
      }
    case 'polyline':
      return {
        kind: 'polyline',
        points: e.points!.map((p) => ({ x: p.x - minX, y: p.y - minY })),
        closed: e.closed,
        layer,
        colorCode,
      }
    case 'line':
      return {
        kind: 'line',
        x1: e.x1! - minX,
        y1: e.y1! - minY,
        x2: e.x2! - minX,
        y2: e.y2! - minY,
        layer,
        colorCode,
      }
    default:
      return e
  }
}

function round2(n: number): number {
  return parseFloat(n.toFixed(2))
}

function mergeDuplicates(pieces: DxfPiece[]): DxfPiece[] {
  const map = new Map<string, DxfPiece>()

  for (const p of pieces) {
    const key = `${p.width.toFixed(1)}x${p.height.toFixed(1)}-${p.holes}`
    const existing = map.get(key)
    if (existing) {
      existing.count += 1
    } else {
      map.set(key, { ...p })
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.width * b.height - a.width * a.height,
  )
}

// ---------------------------------------------------------------------------
// Layout completo
// ---------------------------------------------------------------------------

function buildLayout(allEntities: DrawEntity[]): DxfLayout {
  const points: Point[] = []
  for (const e of allEntities) {
    switch (e.kind) {
      case 'circle':
        points.push(
          { x: e.cx! - e.r!, y: e.cy! - e.r! },
          { x: e.cx! + e.r!, y: e.cy! + e.r! },
        )
        break
      case 'arc':
        points.push(
          { x: e.cx! - e.r!, y: e.cy! - e.r! },
          { x: e.cx! + e.r!, y: e.cy! + e.r! },
        )
        break
      case 'polyline':
        points.push(...e.points!)
        break
      case 'line':
        points.push({ x: e.x1!, y: e.y1! }, { x: e.x2!, y: e.y2! })
        break
    }
  }

  if (points.length === 0) return { entities: [], width: 0, height: 0 }

  const bounds = boundsOf(points)
  const normalized = allEntities.map((e) =>
    normalize(e, bounds.minX, bounds.minY),
  )

  return {
    entities: normalized,
    width: round2(bounds.maxX - bounds.minX),
    height: round2(bounds.maxY - bounds.minY),
  }
}
