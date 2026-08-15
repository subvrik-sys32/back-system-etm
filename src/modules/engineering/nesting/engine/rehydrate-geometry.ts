/**
 * Rehidrata outline + subEntities con el MISMO pipeline que
 * RectangleHeuristicStrategy / NestingEngine.cpp:
 *   scale(opcional) → rotateAround(center) → align(-bounds.topLeft) → translate(x,y)
 *
 * Si placePiece ya dejó subEntities, se respeta el placement tal cual.
 */
import {
  applyToOutline,
  boundingRect,
  compose,
  rectCenter,
  rotateAround,
  translate,
  IDENTITY,
  type Transform2D,
} from './geometry'
import type {
  NestedSheet,
  NestingPiece,
  PlacedPiece,
} from './types'

function basePieceId(id: string): string {
  const i = id.indexOf('#')
  return i >= 0 ? id.slice(0, i) : id
}

function placementTransform(
  src: NestingPiece,
  placed: PlacedPiece,
): Transform2D {
  const angle = placed.angle ?? 0
  const bounds = boundingRect(src.outline)
  const center = rectCenter(bounds)
  const rot = rotateAround(center, angle)
  const rotated = applyToOutline(rot, src.outline)
  const rBounds = boundingRect(rotated)
  const align = translate(-rBounds.x, -rBounds.y)
  return compose(compose(IDENTITY, compose(rot, align)), translate(placed.x, placed.y))
}

export function rehydrateNestedSheets(
  sheets: NestedSheet[],
  sources: NestingPiece[],
): NestedSheet[] {
  const byId = new Map<string, NestingPiece>()
  for (const p of sources) {
    byId.set(p.id, p)
  }

  return sheets.map((sheet) => ({
    ...sheet,
    pieces: sheet.pieces.map((placed) => {
      // placePiece ya transformó subEntities → no tocar
      if (placed.subEntities && placed.subEntities.length > 0) {
        return placed
      }

      const src =
        byId.get(placed.pieceId) ??
        byId.get(basePieceId(placed.pieceId))

      if (!src) return placed

      const m = placementTransform(src, placed)

      return {
        ...placed,
        outline: applyToOutline(m, src.outline),
        subEntities: src.subEntities?.map((s) => ({
          ...s,
          outline: applyToOutline(m, s.outline),
        })),
        color: placed.color ?? src.color,
      }
    }),
  }))
}
