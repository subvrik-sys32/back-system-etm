/** Punto 2D en unidades del modelo (mm por convención del ERP). */
export type Point2D = {
  x: number
  y: number
}

export function point(x: number, y: number): Point2D {
  return { x, y }
}

export function distance(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.hypot(dx, dy)
}
