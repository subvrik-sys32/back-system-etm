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
import {
  extractSolidWithHoles,
  solidCollidesWith,
  translatePoints,
  type SolidWithHoles,
} from "../polygon-collision"
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
  outline: PieceOutline
  bounds: Rect
  transform: Transform2D
  outerLocal: { x: number; y: number }[] // outer aligned at 0,0
}

function placePiece(
  piece: NestingPiece,
  variant: RotationVariant,
  x: number,
  y: number
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

function rotationAnglesFor(options: NestingOptions): number[] {
  const mode = options.rotationMode ?? "0-90-180-270"
  if (mode === "ninguna") return [0]
  if (mode === "libre") {
    // Compromise densidad/tiempo: cada 30° (15° era ~2× más lento)
    const angles: number[] = []
    for (let a = 0; a < 360; a += 30) angles.push(a)
    return angles
  }
  return [0, 90, 180, 270]
}

/**
 * Empaquetado por polígono real + nesting en calados (huecos).
 * Sustituye la heurística solo-AABB cuando se busca mejor aprovechamiento.
 */
export class PolygonPackingStrategy implements NestingStrategy {
  optimize(inputPieces: NestingPiece[], options: NestingOptions): NestedSheet[] {
    const { sheet, signal, onProgress } = options
    const separation = options.separation ?? 0
    // Paso adaptativo: 0.5 mm en planchas industriales genera millones de
    // pruebas y el progreso se “congela” entre piezas. Escalamos al tamaño
    // útil y dejamos un mínimo razonable para densidad.
    const usableW0 = Math.max(1, sheet.width - 2 * sheet.margin)
    const usableH0 = Math.max(1, sheet.height - 2 * sheet.margin)
    const autoStep = Math.min(8, Math.max(2, Math.min(usableW0, usableH0) / 80))
    const fineStep =
      options.searchStep ??
      (options.mode === "precise" ? Math.max(1, autoStep * 0.5) : autoStep)
    const coarseStep = Math.max(fineStep * 3, fineStep + 2)
    const angles = rotationAnglesFor(options)

    const sheets: NestedSheet[] = []
    const pieces = inputPieces.flatMap((p) => Array.from({ length: p.quantity ?? 1 }, () => p))
    if (pieces.length === 0) return sheets

    const sorted = [...pieces].sort((a, b) => {
      const boxA = boundingRect(a.outline)
      const boxB = boundingRect(b.outline)
      return boxB.width * boxB.height - boxA.width * boxA.height
    })

    const usableWidth = sheet.width - 2 * sheet.margin
    const usableHeight = sheet.height - 2 * sheet.margin
    const limitX = sheet.width - sheet.margin
    const limitY = sheet.height - sheet.margin

    // Por plancha: sólidos colocados para colisión rápida
    const sheetSolids: SolidWithHoles[][] = []

    const reportProgress = (pieceIndex: number, local = 0) => {
      const base = pieceIndex / sorted.length
      const span = 1 / sorted.length
      onProgress?.(Math.min(0.999, base + local * span))
    }

    for (let i = 0; i < sorted.length; i++) {
      if (signal?.cancelled) break
      reportProgress(i, 0)

      const piece = sorted[i]
      let outline = piece.outline
      let bounds = boundingRect(outline)
      let center = rectCenter(bounds)
      let scaleTransform: Transform2D = IDENTITY

      const fitsNormal = bounds.width <= usableWidth + 0.1 && bounds.height <= usableHeight + 0.1
      const fitsRotated = bounds.height <= usableWidth + 0.1 && bounds.width <= usableHeight + 0.1
      if (!fitsNormal && !fitsRotated) {
        const scaleNormal = Math.min(usableWidth / bounds.width, usableHeight / bounds.height)
        const scaleRotated = Math.min(usableWidth / bounds.height, usableHeight / bounds.width)
        const scaleFactor = Math.max(scaleNormal, scaleRotated) * 0.99
        scaleTransform = scaleUniform(scaleFactor)
        outline = applyToOutline(scaleTransform, outline)
        bounds = boundingRect(outline)
        center = rectCenter(bounds)
      }

      const variants: RotationVariant[] = angles.map((angle) => {
        const rotTransform = rotateAround(center, angle)
        const rotated = applyToOutline(rotTransform, outline)
        const rBounds = boundingRect(rotated)
        const alignTransform = translate(-rBounds.x, -rBounds.y)
        const aligned = applyToOutline(alignTransform, rotated)
        const fullTransform = compose(compose(scaleTransform, rotTransform), alignTransform)
        const solid = extractSolidWithHoles(aligned, piece.subEntities?.map((s) => ({
          outline: applyToOutline(fullTransform, s.outline),
          color: s.color,
          layer: s.layer,
        })))
        // outerLocal: aplicar solo scale+rot+align al outline de entrada vía aligned
        return {
          angle,
          outline: aligned,
          bounds: boundingRect(aligned),
          transform: fullTransform,
          outerLocal: solid.outer.length >= 3 ? solid.outer : aligned.points,
        }
      })

      // Preferir variantes más angostas
      variants.sort((a, b) => {
        if (Math.abs(a.bounds.width - b.bounds.width) > 0.1) return a.bounds.width - b.bounds.width
        return a.bounds.height - b.bounds.height
      })

      let placed = false

      const tryPlaceAt = (
        sheetIndex: number,
        variant: RotationVariant,
        x: number,
        y: number
      ): boolean => {
        if (x + variant.bounds.width > limitX + 0.001) return false
        if (y + variant.bounds.height > limitY + 0.001) return false
        if (x < sheet.margin - 0.001 || y < sheet.margin - 0.001) return false

        const moved = translatePoints(variant.outerLocal, x, y)
        const solids = sheetSolids[sheetIndex]
        for (const s of solids) {
          if (solidCollidesWith(moved, s, separation)) return false
        }

        // También no debe solapar con otros móviles ya puestos (mismos solids)
        const placedPiece = placePiece(piece, variant, x, y)
        sheets[sheetIndex].pieces.push(placedPiece)
        sheetSolids[sheetIndex].push(
          extractSolidWithHoles(placedPiece.outline, placedPiece.subEntities)
        )
        return true
      }

      // A) Nesting en calados de piezas ya colocadas (mejor densidad)
      for (let si = 0; si < sheets.length && !placed; si++) {
        const solids = sheetSolids[si]
        for (const host of solids) {
          if (host.holes.length === 0) continue
          for (const hole of host.holes) {
            const hb = boundingRect({ points: hole })
            for (const variant of variants) {
              if (variant.bounds.width > hb.width + 0.1 || variant.bounds.height > hb.height + 0.1) {
                continue
              }
              // Barrido grueso dentro del bbox del hueco
              for (let x = hb.x; x <= hb.x + hb.width - variant.bounds.width + 0.001 && !placed; x += fineStep) {
                for (let y = hb.y; y <= hb.y + hb.height - variant.bounds.height + 0.001; y += fineStep) {
                  const moved = translatePoints(variant.outerLocal, x, y)
                  // Debe caber entero en el hueco
                  let allIn = true
                  for (const p of moved) {
                    if (
                      p.x < sheet.margin ||
                      p.y < sheet.margin ||
                      p.x > limitX ||
                      p.y > limitY ||
                      !pointInHole(p, hole)
                    ) {
                      allIn = false
                      break
                    }
                  }
                  if (!allIn) continue
                  // No colisionar con otros sólidos (excepto estar en este hueco)
                  let ok = true
                  for (const s of solids) {
                    if (s === host) continue
                    if (solidCollidesWith(moved, s, separation)) {
                      ok = false
                      break
                    }
                  }
                  if (!ok) continue
                  const placedPiece = placePiece(piece, variant, x, y)
                  sheets[si].pieces.push(placedPiece)
                  sheetSolids[si].push(
                    extractSolidWithHoles(placedPiece.outline, placedPiece.subEntities)
                  )
                  placed = true
                  break
                }
              }
              if (placed) break
            }
            if (placed) break
          }
        }
      }

      // B) Búsqueda bottom-left en planchas existentes.
      // Multi-resolución + candidatos por esquinas de piezas ya colocadas
      // para evitar barridos de millones de celdas (progreso congelado).
      const tryGrid = (
        si: number,
        stepX: number,
        maxTrials: number
      ): boolean => {
        let trials = 0
        for (let x = sheet.margin; x <= limitX + 0.001 && !placed; x += stepX) {
          for (let y = sheet.margin; y <= limitY + 0.001 && !placed; y += stepX) {
            if (signal?.cancelled) return false
            trials++
            if (trials % 64 === 0) {
              reportProgress(i, Math.min(0.95, trials / maxTrials))
            }
            if (trials > maxTrials) return false
            for (const variant of variants) {
              if (tryPlaceAt(si, variant, x, y)) {
                placed = true
                return true
              }
            }
          }
        }
        return placed
      }

      const collectCornerCandidates = (si: number): { x: number; y: number }[] => {
        const pts: { x: number; y: number }[] = [{ x: sheet.margin, y: sheet.margin }]
        for (const pp of sheets[si].pieces) {
          const b = boundingRect(pp.outline)
          const gap = separation
          pts.push(
            { x: b.x + b.width + gap, y: b.y },
            { x: b.x, y: b.y + b.height + gap },
            { x: b.x + b.width + gap, y: b.y + b.height + gap },
            { x: Math.max(sheet.margin, b.x - gap), y: b.y },
            { x: b.x, y: Math.max(sheet.margin, b.y - gap) }
          )
        }
        // Dedup redondeado
        const seen = new Set<string>()
        const out: { x: number; y: number }[] = []
        for (const p of pts) {
          const key = `${p.x.toFixed(2)},${p.y.toFixed(2)}`
          if (seen.has(key)) continue
          seen.add(key)
          out.push(p)
        }
        return out
      }

      for (let si = 0; si < sheets.length && !placed; si++) {
        if (signal?.cancelled) break

        // 1) Candidatos por esquinas (barato y suele encontrar hueco)
        const corners = collectCornerCandidates(si)
        for (const c of corners) {
          if (placed || signal?.cancelled) break
          for (const variant of variants) {
            if (tryPlaceAt(si, variant, c.x, c.y)) {
              placed = true
              break
            }
            // micro-offsets alrededor de la esquina
            for (const ox of [0, fineStep, -fineStep, fineStep * 2]) {
              for (const oy of [0, fineStep, -fineStep, fineStep * 2]) {
                if (ox === 0 && oy === 0) continue
                if (tryPlaceAt(si, variant, c.x + ox, c.y + oy)) {
                  placed = true
                  break
                }
              }
              if (placed) break
            }
            if (placed) break
          }
        }

        // 2) Grilla gruesa
        if (!placed) {
          const maxTrialsCoarse = Math.ceil(
            ((usableWidth / coarseStep) + 2) * ((usableHeight / coarseStep) + 2) * variants.length
          )
          tryGrid(si, coarseStep, Math.min(maxTrialsCoarse, 25000))
        }

        // 3) Grilla fina solo si gruesa falló (planches casi llenas)
        if (!placed) {
          const maxTrialsFine = Math.ceil(
            ((usableWidth / fineStep) + 2) * ((usableHeight / fineStep) + 2)
          )
          tryGrid(si, fineStep, Math.min(maxTrialsFine, 25000))
        }
      }

      // C) Nueva plancha
      if (!placed) {
        let bestVariant = variants[0]
        for (const variant of variants) {
          if (variant.bounds.width <= usableWidth + 0.1 && variant.bounds.height <= usableHeight + 0.1) {
            bestVariant = variant
            break
          }
        }
        const first = placePiece(piece, bestVariant, sheet.margin, sheet.margin)
        sheets.push({ pieces: [first] })
        sheetSolids.push([extractSolidWithHoles(first.outline, first.subEntities)])
      }
    }

    onProgress?.(1)
    return sheets
  }
}

function pointInHole(p: { x: number; y: number }, hole: { x: number; y: number }[]): boolean {
  // inline PIP
  let inside = false
  for (let i = 0, j = hole.length - 1; i < hole.length; j = i++) {
    const xi = hole[i].x,
      yi = hole[i].y
    const xj = hole[j].x,
      yj = hole[j].y
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-15) + xi) {
      inside = !inside
    }
  }
  return inside
}