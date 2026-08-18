import { point } from '../geometry/point'
import { line } from '../geometry/line'
import { circle } from '../geometry/circle'
import { arc } from '../geometry/arc'
import {
  createGeometryModel,
  type GeometryModel,
  type GeometryEntity,
} from '../model/geometry-model'

export type TiraHolesInput = {
  diameter: number
  insetFromEnd: number
  countPerEnd: 1 | 2
  spacing?: number
}

export type TiraBendsInput = {
  positions: number[]
}

export type TiraGeneratorInput = {
  length: number
  width: number
  endRadius?: number
  holes?: TiraHolesInput
  bends?: TiraBendsInput
  thicknessMm?: number
  material?: string
  name?: string
}

export function generateTira(input: TiraGeneratorInput): GeometryModel {
  const { length, width } = input
  if (!(length > 0) || !(width > 0)) {
    throw new Error(`Tira length/width must be > 0 (got ${length} x ${width})`)
  }

  const rawR = input.endRadius ?? 0
  if (rawR < 0) throw new Error(`endRadius must be >= 0 (got ${rawR})`)
  if (rawR > width / 2 + 1e-9) {
    throw new Error(
      `endRadius (${rawR}) cannot exceed width/2 (${width / 2}) — adjust radius or width`,
    )
  }
  const R = rawR
  const entities: GeometryEntity[] = []

  if (R <= 0) {
    entities.push(
      line(point(0, 0), point(length, 0), 'CUT'),
      line(point(length, 0), point(length, width), 'CUT'),
      line(point(length, width), point(0, width), 'CUT'),
      line(point(0, width), point(0, 0), 'CUT'),
    )
  } else {
    const cy = width / 2
    entities.push(line(point(R, 0), point(length - R, 0), 'CUT'))
    entities.push(arc(point(length - R, cy), R, -90, 90, 'CUT'))
    entities.push(line(point(length - R, width), point(R, width), 'CUT'))
    entities.push(arc(point(R, cy), R, 90, 270, 'CUT'))
  }

  if (input.holes) {
    const { diameter, insetFromEnd, countPerEnd } = input.holes
    if (!(diameter > 0)) throw new Error(`Hole diameter must be > 0`)
    if (!(insetFromEnd >= 0)) throw new Error(`insetFromEnd must be >= 0`)
    const r = diameter / 2
    if (insetFromEnd - r < 0 || insetFromEnd + r > length) {
      throw new Error(
        `Holes do not fit on length: d=${diameter}, inset=${insetFromEnd}, L=${length}`,
      )
    }
    const xs = [insetFromEnd, length - insetFromEnd]
    const ys: number[] =
      countPerEnd === 1
        ? [width / 2]
        : (() => {
            const spacing = input.holes!.spacing ?? width / 2
            const y0 = width / 2 - spacing / 2
            const y1 = width / 2 + spacing / 2
            if (y0 - r < 0 || y1 + r > width) {
              throw new Error(
                `Holes do not fit on width: d=${diameter}, spacing=${spacing}, W=${width}`,
              )
            }
            return [y0, y1]
          })()
    for (const x of xs) {
      for (const y of ys) {
        entities.push(circle(point(x, y), r, 'HOLE'))
      }
    }
  }

  if (input.bends?.positions?.length) {
    for (const x of input.bends.positions) {
      if (!(x > 0) || !(x < length)) {
        throw new Error(`Bend position must be inside (0, length): ${x}`)
      }
      entities.push(line(point(x, 0), point(x, width), 'BEND'))
    }
  }

  return createGeometryModel(entities, 'mm')
}

export const DEFAULT_TIRA_DEMO: TiraGeneratorInput = {
  length: 211.25,
  width: 13.6,
  endRadius: 7,
  holes: { diameter: 4, insetFromEnd: 8, countPerEnd: 1 },
  bends: { positions: [20.16, 51.97, 159.28, 191.1] },
  thicknessMm: 1.5,
  material: 'St37',
  name: 'tira-demo',
}
