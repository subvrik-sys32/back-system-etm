/**
 * Puerto fiel de AI-Nesting NestingEngine.cpp (modo Rápido).
 * - Orden por área desc
 * - Variantes 0/90/180/270: rotateAround(centro) → align a (0,0)
 * - Barrido X→Y, colisión AABB con pad = max(separation, margen)/2 estilo C++
 * - Salto en Y al colisionar
 * - placePiece aplica la misma transform a outline + subEntities
 *
 * Mejoras propias (sin romper baseline):
 * - searchStep configurable (default ~1–8 adaptativo)
 * - separation independiente del margen de plancha
 * - multi-order opcional vía options (ver optimize.ts)
 */
import {
  applyToOutline,
  boundingRect,
  compose,
  rectCenter,
  rotateAround,
  scaleUniform,
  translate,
  IDENTITY,
  type Transform2D,
} from "../geometry"
import type {
  NestedSheet,
  NestingOptions,
  NestingPiece,
  NestingStrategy,
  PieceOutline,
  PlacedPiece,
  Rect,
} from "../types"

interface RotationVariant {
  angle: number
  bounds: Rect
  transform: Transform2D
}

function rotationAnglesFor(options: NestingOptions): number[] {
  const mode = options.rotationMode ?? "0-90-180-270"
  if (mode === "ninguna") return [0]
  return [0, 90, 180, 270]
}

function rectsOverlapPad(a: Rect, b: Rect, eps = 0.001): boolean {
  return !(
    a.x + a.width <= b.x + eps ||
    b.x + b.width <= a.x + eps ||
    a.y + a.height <= b.y + eps ||
    b.y + b.height <= a.y + eps
  )
}

function placePiece(
  piece: NestingPiece,
  variant: RotationVariant,
  x: number,
  y: number,
): PlacedPiece {
  const finalTransform = compose(variant.transform, translate(x, y))
  return {
    pieceId: piece.id,
    x,
    y,
    angle: variant.angle,
    outline: applyToOutline(finalTransform, piece.outline),
    subEntities: piece.subEntities?.map((sub) => ({
      outline: applyToOutline(finalTransform, sub.outline),
      color: sub.color,
      layer: sub.layer,
    })),
    color: piece.color,
  }
}

function buildVariants(
  piece: NestingPiece,
  angles: number[],
  usableWidth: number,
  usableHeight: number,
): RotationVariant[] {
  let outline = piece.outline
  let bounds = boundingRect(outline)
  let center = rectCenter(bounds)
  let scaleTransform: Transform2D = IDENTITY

  const fitsNormal =
    bounds.width <= usableWidth + 0.1 && bounds.height <= usableHeight + 0.1
  const fitsRotated =
    bounds.height <= usableWidth + 0.1 && bounds.width <= usableHeight + 0.1

  if (!fitsNormal && !fitsRotated) {
    const scaleNormal = Math.min(
      usableWidth / Math.max(bounds.width, 1e-9),
      usableHeight / Math.max(bounds.height, 1e-9),
    )
    const scaleRotated = Math.min(
      usableWidth / Math.max(bounds.height, 1e-9),
      usableHeight / Math.max(bounds.width, 1e-9),
    )
    const scaleFactor = Math.max(scaleNormal, scaleRotated) * 0.99
    if (scaleFactor > 0 && Number.isFinite(scaleFactor)) {
      scaleTransform = scaleUniform(scaleFactor)
      outline = applyToOutline(scaleTransform, outline)
      bounds = boundingRect(outline)
      center = rectCenter(bounds)
    }
  }

  const variants: RotationVariant[] = angles.map((angle) => {
    const rotTransform = rotateAround(center, angle)
    const rotated = applyToOutline(rotTransform, outline)
    const rBounds = boundingRect(rotated)
    const alignTransform = translate(-rBounds.x, -rBounds.y)
    const fullTransform = compose(
      compose(scaleTransform, rotTransform),
      alignTransform,
    )
    const aligned = applyToOutline(alignTransform, rotated)
    return {
      angle,
      bounds: boundingRect(aligned),
      transform: fullTransform,
    }
  })

  // C++: priorizar variantes más angostas
  variants.sort((a, b) => {
    if (Math.abs(a.bounds.width - b.bounds.width) > 0.1) {
      return a.bounds.width - b.bounds.width
    }
    return a.bounds.height - b.bounds.height
  })

  return variants
}

export class RectangleHeuristicStrategy implements NestingStrategy {
  optimize(inputPieces: NestingPiece[], options: NestingOptions): NestedSheet[] {
    const { sheet, signal, onProgress } = options
    const sheets: NestedSheet[] = []
    const separation = Math.max(0, options.separation ?? 0)
    // C++ usa margen/2 en rects de colisión entre piezas.
    // Aquí: max(separation, 0) como gap; el margen de plancha solo limita el área útil.
    const pad = separation / 2

    const expanded: NestingPiece[] = []
    for (const p of inputPieces) {
      const q = Math.max(1, p.quantity ?? 1)
      for (let k = 0; k < q; k++) {
        expanded.push(
          q === 1 ? p : { ...p, id: `${p.id}#${k}`, quantity: 1 },
        )
      }
    }
    if (expanded.length === 0) return sheets

    const sorted = [...expanded].sort((a, b) => {
      const boxA = boundingRect(a.outline)
      const boxB = boundingRect(b.outline)
      return boxB.width * boxB.height - boxA.width * boxA.height
    })

    const usableWidth = sheet.width - 2 * sheet.margin
    const usableHeight = sheet.height - 2 * sheet.margin
    const limitX = sheet.width - sheet.margin
    const limitY = sheet.height - sheet.margin
    const angles = rotationAnglesFor(options)

    const autoStep = Math.min(
      8,
      Math.max(1, Math.min(usableWidth, usableHeight) / 120),
    )
    const searchStep = options.searchStep ?? autoStep

    // Bounds colocados por plancha (con pad), como puestasBounds en C++
    const sheetPlacedPads: Rect[][] = []

    for (let i = 0; i < sorted.length; i++) {
      if (signal?.cancelled) break
      onProgress?.(i / Math.max(1, sorted.length))

      const piece = sorted[i]
      const variants = buildVariants(piece, angles, usableWidth, usableHeight)
      let colocada = false

      for (let si = 0; si < sheets.length; si++) {
        const puestas = sheetPlacedPads[si]!

        for (let x = sheet.margin; x <= limitX + 0.001; x += searchStep) {
          for (let y = sheet.margin; y <= limitY + 0.001; ) {
            let minSaltoY = limitY
            let varianteColocada = false

            for (const variant of variants) {
              if (x + variant.bounds.width > limitX + 0.001) continue
              if (y + variant.bounds.height > limitY + 0.001) continue

              const test: Rect = {
                x: x - pad,
                y: y - pad,
                width: variant.bounds.width + 2 * pad,
                height: variant.bounds.height + 2 * pad,
              }

              let colision = false
              let colisionSaltoY = 0

              for (const puesta of puestas) {
                if (rectsOverlapPad(test, puesta)) {
                  colision = true
                  const saltoY = puesta.y + puesta.height - test.y
                  if (saltoY > colisionSaltoY) colisionSaltoY = saltoY
                }
              }

              if (!colision) {
                const pp = placePiece(piece, variant, x, y)
                sheets[si]!.pieces.push(pp)
                sheetPlacedPads[si]!.push({
                  x: x - pad,
                  y: y - pad,
                  width: variant.bounds.width + 2 * pad,
                  height: variant.bounds.height + 2 * pad,
                })
                colocada = true
                varianteColocada = true
                break
              }

              if (colisionSaltoY > 0 && colisionSaltoY < minSaltoY) {
                minSaltoY = colisionSaltoY
              }
            }

            if (varianteColocada) break
            if (minSaltoY >= limitY - y) break
            y += Math.max(searchStep, minSaltoY)
          }
          if (colocada) break
        }
        if (colocada) break
      }

      if (!colocada) {
        let mejor = variants[0]!
        for (const v of variants) {
          if (
            v.bounds.width <= usableWidth + 0.1 &&
            v.bounds.height <= usableHeight + 0.1
          ) {
            mejor = v
            break
          }
        }

        const x = sheet.margin
        const y = sheet.margin
        const pp = placePiece(piece, mejor, x, y)
        sheets.push({ pieces: [pp] })
        sheetPlacedPads.push([
          {
            x: x - pad,
            y: y - pad,
            width: mejor.bounds.width + 2 * pad,
            height: mejor.bounds.height + 2 * pad,
          },
        ])
      }
    }

    onProgress?.(1)
    return sheets.filter((s) => s.pieces.length > 0)
  }
}
