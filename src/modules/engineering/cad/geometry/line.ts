import type { Point2D } from './point'

export type Line2D = {
  type: 'LINE'
  start: Point2D
  end: Point2D
}

export function line(start: Point2D, end: Point2D): Line2D {
  return { type: 'LINE', start, end }
}
