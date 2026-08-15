import type { Point2D } from "../../nesting/engine/types"

const SEGMENTS_PER_FULL_CIRCLE = 64

/**
 * Muestrea un arco como una polilínea de puntos. Convención estándar de
 * DXF: ángulos en grados, medidos en sentido antihorario (CCW) desde el
 * eje +X. El arco barre de `startDeg` a `endDeg` en sentido CCW (si
 * `endDeg < startDeg`, se le suma 360 para completar el barrido).
 */
export function sampleArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
): Point2D[] {
  const start = startDeg
  let end = endDeg
  if (end <= start) end += 360

  const sweep = end - start
  const segments = Math.max(2, Math.round((sweep / 360) * SEGMENTS_PER_FULL_CIRCLE))

  const points: Point2D[] = []
  for (let i = 0; i <= segments; i++) {
    const angleDeg = start + (sweep * i) / segments
    const angleRad = (angleDeg * Math.PI) / 180
    points.push({ x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) })
  }
  return points
}

export function sampleCircle(cx: number, cy: number, r: number): Point2D[] {
  const points: Point2D[] = []
  for (let i = 0; i <= SEGMENTS_PER_FULL_CIRCLE; i++) {
    const angleRad = (2 * Math.PI * i) / SEGMENTS_PER_FULL_CIRCLE
    points.push({ x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) })
  }
  return points
}

/**
 * Convierte un "bulge" de polilínea DXF (LWPOLYLINE) en un arco entre
 * dos vértices, y devuelve los puntos muestreados del arco (sin incluir
 * `p1`, que ya lo agrega quien llama). Fórmula estándar de conversión
 * bulge -> arco: bulge = tan(theta/4), donde theta es el ángulo
 * incluido del arco; el signo de bulge indica la dirección (positivo =
 * antihorario). Es geometría genérica, no específica de Qt, así que se
 * calcula directo sin ningún ajuste de signo "para Qt".
 */
export function sampleBulgeArc(p1: Point2D, p2: Point2D, bulge: number): Point2D[] {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const chordLen = Math.hypot(dx, dy)

  if (chordLen < 0.0001) return [p2]

  const theta = 4 * Math.atan(bulge)
  const radius = Math.abs(chordLen / (2 * Math.sin(theta / 2)))
  const sagitta = (chordLen / 2) * ((1 - bulge * bulge) / (2 * bulge))

  const alpha = Math.atan2(dy, dx)
  const arcCx = (p1.x + p2.x) / 2 - sagitta * Math.sin(alpha)
  const arcCy = (p1.y + p2.y) / 2 + sagitta * Math.cos(alpha)

  const startDeg = (Math.atan2(p1.y - arcCy, p1.x - arcCx) * 180) / Math.PI
  const sweepDeg = (theta * 180) / Math.PI

  const endDeg = startDeg + sweepDeg
  const points = sweepDeg >= 0
    ? sampleArc(arcCx, arcCy, radius, startDeg, endDeg)
    : sampleArc(arcCx, arcCy, radius, endDeg, startDeg).reverse()

  // No incluir el primer punto (ya es p1, lo agrega el que llama).
  return points.slice(1)
}
