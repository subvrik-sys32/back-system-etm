import type { Point2D } from './point'

/** Matriz afín 2D: [x'] = [a c e; b d f; 0 0 1] [x;y;1] */
export type Transform2D = {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export const IDENTITY: Transform2D = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
}

export function translate(tx: number, ty: number): Transform2D {
  return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty }
}

export function scaleUniform(s: number): Transform2D {
  return { a: s, b: 0, c: 0, d: s, e: 0, f: 0 }
}

/** Rotación en grados, CCW, alrededor del origen. */
export function rotateDeg(deg: number): Transform2D {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 }
}

/** Aplica m2 ∘ m1 (primero m1, luego m2). */
export function compose(m1: Transform2D, m2: Transform2D): Transform2D {
  return {
    a: m2.a * m1.a + m2.c * m1.b,
    b: m2.b * m1.a + m2.d * m1.b,
    c: m2.a * m1.c + m2.c * m1.d,
    d: m2.b * m1.c + m2.d * m1.d,
    e: m2.a * m1.e + m2.c * m1.f + m2.e,
    f: m2.b * m1.e + m2.d * m1.f + m2.f,
  }
}

export function applyToPoint(m: Transform2D, p: Point2D): Point2D {
  return {
    x: m.a * p.x + m.c * p.y + m.e,
    y: m.b * p.x + m.d * p.y + m.f,
  }
}
