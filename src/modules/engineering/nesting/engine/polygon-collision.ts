import type { PieceOutline, Point2D, SubEntity } from "./types"

export function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y
    const xj = polygon[j].x,
      yj = polygon[j].y
    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-15) + xi
    ) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Normalizado a distancia perpendicular real en mm (no al producto
 * cruzado sin normalizar) — con coordenadas grandes y aristas cortas
 * (muescas/tabs de piezas), un umbral fijo sobre el cruce crudo no
 * alcanza contra el ruido de punto flotante.
 */
function orient(a: Point2D, b: Point2D, c: Point2D): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len = Math.hypot(abx, aby) || 1
  const v = (aby * (c.x - b.x) - abx * (c.y - b.y)) / len
  if (Math.abs(v) < 1e-4) return 0
  return v > 0 ? 1 : 2
}

function segmentsProperIntersect(a1: Point2D, a2: Point2D, b1: Point2D, b2: Point2D): boolean {
  const o1 = orient(a1, a2, b1)
  const o2 = orient(a1, a2, b2)
  const o3 = orient(b1, b2, a1)
  const o4 = orient(b1, b2, a2)
  if (o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0) return false
  return o1 !== o2 && o3 !== o4
}

export function bbox(pts: Point2D[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

export function areaAbs(pts: Point2D[]): number {
  let a = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j].x * pts[i].y - pts[i].x * pts[j].y
  }
  return Math.abs(a) * 0.5
}

/** Distancia del punto al borde más cercano del polígono. */
function distToPolygonBoundary(point: Point2D, polygon: Point2D[]): number {
  let min = Infinity
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j]
    const b = polygon[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    let t = len2 > 1e-12 ? ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2 : 0
    t = Math.max(0, Math.min(1, t))
    const d = Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
    if (d < min) min = d
  }
  return min
}

/**
 * Un punto justo SOBRE el borde (piezas en unilínea, separación 0)
 * puede leer "inside" por error de precisión del ray-casting — exige
 * más de `eps` de distancia a cualquier arista para contar como
 * overlap real, no solo contacto.
 */
function pointStrictlyInsidePolygon(point: Point2D, polygon: Point2D[], eps: number): boolean {
  if (!pointInPolygon(point, polygon)) return false
  return distToPolygonBoundary(point, polygon) > eps
}

/** Tolerancia de "está tocando el borde, no es overlap real" en mm. */
const TOUCH_EPS = 0.05

/** Solape de sólidos (contacto de borde OK). */
export function solidsOverlap(a: Point2D[], b: Point2D[]): boolean {
  if (a.length < 3 || b.length < 3) return false
  const A = bbox(a)
  const B = bbox(b)
  if (A.maxX <= B.minX || B.maxX <= A.minX || A.maxY <= B.minY || B.maxY <= A.minY) return false

  for (let i = 0; i < a.length; i++) {
    const a1 = a[i],
      a2 = a[(i + 1) % a.length]
    for (let j = 0; j < b.length; j++) {
      if (segmentsProperIntersect(a1, a2, b[j], b[(j + 1) % b.length])) return true
    }
  }
  const samples = [0, 0.25, 0.5, 0.75].map((t) => a[Math.min(a.length - 1, (t * a.length) | 0)])
  for (const p of samples) if (pointStrictlyInsidePolygon(p, b, TOUCH_EPS)) return true
  const samplesB = [0, 0.25, 0.5, 0.75].map((t) => b[Math.min(b.length - 1, (t * b.length) | 0)])
  for (const p of samplesB) if (pointStrictlyInsidePolygon(p, a, TOUCH_EPS)) return true
  return false
}

export interface SolidWithHoles {
  outer: Point2D[]
  holes: Point2D[][]
  box: { minX: number; minY: number; maxX: number; maxY: number }
}

export function extractSolidWithHoles(
  outline: PieceOutline,
  subEntities?: SubEntity[]
): SolidWithHoles {
  const rings: Point2D[][] = []
  // `outline.points` es el respaldo "fusionado" (todos los puntos de
  // todas las entidades originales, concatenados en orden de parseo,
  // SIN encadenar) — antes se agregaba SIEMPRE como candidato más, a
  // competir por área contra los subEntities ya correctamente
  // encadenados. Como es una secuencia arbitraria (no un polígono
  // real, puede autointersectarse), su "área" por la fórmula del
  // shoelace es impredecible y a veces resultaba MAYOR que el
  // contorno real — eligiendo el respaldo roto como "exterior" de la
  // pieza en vez del contorno de verdad. Ahora solo se usa si de
  // verdad no hay subEntities (el respaldo documentado en el tipo:
  // "solo si no hay subOutlines").
  if (subEntities && subEntities.length > 0) {
    for (const s of subEntities) {
      if (s.outline.points.length >= 3) rings.push(s.outline.points)
    }
  } else if (outline.points.length >= 3) {
    rings.push(outline.points)
  }
  if (rings.length === 0) {
    return { outer: [], holes: [], box: { minX: 0, minY: 0, maxX: 0, maxY: 0 } }
  }

  let outerIdx = 0
  let best = -1
  for (let i = 0; i < rings.length; i++) {
    const ar = areaAbs(rings[i])
    if (ar > best) {
      best = ar
      outerIdx = i
    }
  }
  const outer = rings[outerIdx]
  const holes: Point2D[][] = []
  for (let i = 0; i < rings.length; i++) {
    if (i === outerIdx) continue
    const r = rings[i]
    if (areaAbs(r) >= best * 0.98) continue
    const cx = r.reduce((s, p) => s + p.x, 0) / r.length
    const cy = r.reduce((s, p) => s + p.y, 0) / r.length
    if (pointInPolygon({ x: cx, y: cy }, outer)) holes.push(r)
  }
  return { outer, holes, box: bbox(outer) }
}

/**
 * ¿El sólido móvil colisiona con un sólido ya colocado?
 * Permitido si el móvil está completamente dentro de un hueco del otro.
 *
 * `separation` (mm): gap mínimo entre contornos. Se aplica expandiendo los
 * AABB: si al sumar `separation` aún se "tocan", se considera colisión
 * (aunque los polígonos no se crucen). Contacto exacto a distancia
 * `separation` se permite (umbral estricto `>`).
 */
export function solidCollidesWith(moving: Point2D[], placed: SolidWithHoles, separation = 0): boolean {
  if (moving.length < 3 || placed.outer.length < 3) return false

  // Completamente dentro de un hueco → OK (nesting en calado)
  for (const hole of placed.holes) {
    if (fullyInsideHole(moving, hole)) return false
  }

  // Intersección real de polígonos
  if (solidsOverlap(moving, placed.outer)) return true

  // Gap mínimo: AABB de `moving` vs AABB de `placed` expandido mentalmente
  // por `separation`. Si gap < separation → colisión.
  if (separation > 0) {
    const mb = bbox(moving)
    const pb = placed.box
    const s = separation
    const far =
      mb.maxX + s <= pb.minX ||
      pb.maxX + s <= mb.minX ||
      mb.maxY + s <= pb.minY ||
      pb.maxY + s <= mb.minY
    if (!far) return true
  }

  return false
}

export function translatePoints(pts: Point2D[], dx: number, dy: number): Point2D[] {
  return pts.map((p) => ({ x: p.x + dx, y: p.y + dy }))
}

/** ¿Todos los puntos de `pts` están dentro de `hole`? */
function fullyInsideHole(pts: Point2D[], hole: Point2D[]): boolean {
  if (pts.length < 1 || hole.length < 3) return false
  for (const p of pts) {
    if (!pointInPolygon(p, hole)) return false
  }
  return true
}

/**
 * Colisión entre dos piezas colocadas respetando calados:
 * si A está enteramente en un hueco de B (o al revés), NO es colisión.
 * Usar en UI de solape; no confundir con nesting en ventana.
 */
export function piecesCollide(
  a: { outline: { points: Point2D[] }; subEntities?: SubEntity[] },
  b: { outline: { points: Point2D[] }; subEntities?: SubEntity[] },
  separation = 0
): boolean {
  const sa = extractSolidWithHoles(a.outline, a.subEntities)
  const sb = extractSolidWithHoles(b.outline, b.subEntities)
  const outerA = sa.outer.length >= 3 ? sa.outer : a.outline.points
  const outerB = sb.outer.length >= 3 ? sb.outer : b.outline.points
  if (outerA.length < 3 || outerB.length < 3) return false

  for (const hole of sb.holes) {
    if (fullyInsideHole(outerA, hole)) return false
  }
  for (const hole of sa.holes) {
    if (fullyInsideHole(outerB, hole)) return false
  }

  if (solidsOverlap(outerA, outerB)) return true

  // Gap mínimo entre piezas (misma lógica que solidCollidesWith)
  if (separation > 0) {
    const ba = bbox(outerA)
    const bb = bbox(outerB)
    const s = separation
    const far =
      ba.maxX + s <= bb.minX ||
      bb.maxX + s <= ba.minX ||
      ba.maxY + s <= bb.minY ||
      bb.maxY + s <= ba.minY
    if (!far) return true
  }
  return false
}