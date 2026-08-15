import { RectangleHeuristicStrategy } from "./strategies/rectangle-heuristic"
import { PolygonPackingStrategy } from "./strategies/polygon-packing"
import { boundingRect } from "./geometry"
import type { NestedSheet, NestingOptions, NestingPiece, NestingStrategy } from "./types"

const rectangleStrategy = new RectangleHeuristicStrategy()
const polygonStrategy = new PolygonPackingStrategy()

function thicknessKey(p: NestingPiece): string {
  const t = p.thicknessMm
  if (t == null || !(t > 0)) return "sin-espesor"
  return (Math.round(t * 100) / 100).toFixed(2)
}

function sheetScore(sheets: NestedSheet[], sheetW: number, sheetH: number): number {
  // Menos planchas gana; en empate, más piezas en la última = mejor empaquetado
  const n = sheets.length
  if (n === 0) return Number.POSITIVE_INFINITY
  const last = sheets[n - 1]!
  const areaUsed = last.pieces.reduce((acc, p) => {
    const b = boundingRect(p.outline)
    return acc + b.width * b.height
  }, 0)
  return n * sheetW * sheetH - areaUsed
}

/**
 * PATH B ligero (NestLib-style): en mode fast, prueba 1–3 órdenes
 * y se queda con el mejor score. precise usa una sola pasada polígono.
 */
function runWithOptionalMultiStart(
  pieces: NestingPiece[],
  options: NestingOptions,
  strategy: NestingStrategy,
): NestedSheet[] {
  const base = strategy.optimize(pieces, options)
  if (options.mode === "precise" || pieces.length < 4) {
    return base
  }

  // Orden invertido (pequeñas primero) — a veces mejora el relleno del final
  const byAreaAsc = [...pieces].sort((a, b) => {
    const A = boundingRect(a.outline)
    const B = boundingRect(b.outline)
    return A.width * A.height - B.width * B.height
  })
  const alt1 = strategy.optimize(byAreaAsc, {
    ...options,
    onProgress: undefined,
  })

  const w = options.sheet.width
  const h = options.sheet.height
  let best = base
  let bestScore = sheetScore(base, w, h)
  const s1 = sheetScore(alt1, w, h)
  if (s1 < bestScore) {
    best = alt1
    bestScore = s1
  }

  return best
}

export function optimize(
  pieces: NestingPiece[],
  options: NestingOptions,
  strategy?: NestingStrategy,
): NestedSheet[] {
  const chosen =
    strategy ??
    (options.mode === "precise" ? polygonStrategy : rectangleStrategy)

  if (pieces.length === 0) return []

  const buckets = new Map<string, NestingPiece[]>()
  for (const p of pieces) {
    const k = thicknessKey(p)
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k)!.push(p)
  }

  const keys = [...buckets.keys()].sort((a, b) => {
    if (a === "sin-espesor") return 1
    if (b === "sin-espesor") return -1
    return parseFloat(a) - parseFloat(b)
  })

  if (keys.length === 1) {
    const k = keys[0]!
    const sheets = runWithOptionalMultiStart(buckets.get(k)!, options, chosen)
    const thicknessMm = k === "sin-espesor" ? undefined : parseFloat(k)
    return sheets
      .filter((s) => s.pieces.length > 0)
      .map((s) => ({ ...s, thicknessMm }))
  }

  const all: NestedSheet[] = []
  const nKeys = keys.length

  for (let gi = 0; gi < nKeys; gi++) {
    if (options.signal?.cancelled) break
    const k = keys[gi]!
    const groupPieces = buckets.get(k)!
    const thicknessMm = k === "sin-espesor" ? undefined : parseFloat(k)

    const groupSheets = runWithOptionalMultiStart(groupPieces, {
      ...options,
      onProgress: (local) => {
        options.onProgress?.((gi + local) / nKeys)
      },
    }, chosen)

    for (const s of groupSheets) {
      all.push({ ...s, thicknessMm })
    }
  }

  options.onProgress?.(1)
  return all.filter((s) => s.pieces.length > 0)
}

export * from "./types"
export { RectangleHeuristicStrategy } from "./strategies/rectangle-heuristic"
export { PolygonPackingStrategy } from "./strategies/polygon-packing"
