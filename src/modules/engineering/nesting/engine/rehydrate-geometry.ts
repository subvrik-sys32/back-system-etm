/**
 * Restaura outline + subEntities desde la pieza fuente.
 * preparePieces puede usar bbox sin huecos para pack; el resultado
 * visible/exportable debe ser true-shape.
 */
import type {
  NestedSheet,
  NestingPiece,
  PieceOutline,
  Point2D,
  SubEntity,
} from './types'

function rotatePoint(p: Point2D, deg: number): Point2D {
  const r = ((deg % 360) * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

function transformOutline(
  outline: PieceOutline,
  rotationDeg: number,
  tx: number,
  ty: number,
): PieceOutline {
  return {
    points: outline.points.map((p) => {
      const r = rotatePoint(p, rotationDeg)
      return { x: r.x + tx, y: r.y + ty }
    }),
  }
}

function transformSubEntities(
  subs: SubEntity[] | undefined,
  rotationDeg: number,
  tx: number,
  ty: number,
): SubEntity[] | undefined {
  if (!subs?.length) return undefined
  return subs.map((s) => ({
    ...s,
    outline: transformOutline(s.outline, rotationDeg, tx, ty),
  }))
}

function basePieceId(id: string): string {
  const i = id.indexOf('#')
  return i >= 0 ? id.slice(0, i) : id
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
      const src =
        byId.get(placed.pieceId) ??
        byId.get(basePieceId(placed.pieceId))

      if (!src) return placed

      const angle = placed.angle ?? 0
      const tx = placed.x
      const ty = placed.y

      return {
        ...placed,
        outline: transformOutline(src.outline, angle, tx, ty),
        subEntities: transformSubEntities(src.subEntities, angle, tx, ty),
        color: placed.color ?? src.color,
      }
    }),
  }))
}
