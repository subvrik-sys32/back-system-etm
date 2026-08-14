import type { Point2D } from './point'

export type Circle2D = {
  type: 'CIRCLE'
  center: Point2D
  radius: number
}

export function circle(center: Point2D, radius: number): Circle2D {
  if (!(radius > 0)) {
    throw new Error(`Circle radius must be > 0, got ${radius}`)
  }
  return { type: 'CIRCLE', center, radius }
}
