import { RectangleHeuristicStrategy } from "./strategies/rectangle-heuristic"
import { PolygonPackingStrategy } from "./strategies/polygon-packing"
import type { NestedSheet, NestingOptions, NestingPiece, NestingStrategy } from "./types"

const rectangleStrategy = new RectangleHeuristicStrategy()
const polygonStrategy = new PolygonPackingStrategy()

function thicknessKey(p: NestingPiece): string {
  const t = p.thicknessMm
  if (t == null || !(t > 0)) return "sin-espesor"
  return (Math.round(t * 100) / 100).toFixed(2)
}

export function optimize(
  pieces: NestingPiece[],
  options: NestingOptions,
  strategy?: NestingStrategy
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
    const k = keys[0]
    const sheets = chosen.optimize(buckets.get(k)!, options)
    const thicknessMm = k === "sin-espesor" ? undefined : parseFloat(k)
    return sheets.filter((s) => s.pieces.length > 0).map((s) => ({ ...s, thicknessMm }))
  }

  const all: NestedSheet[] = []
  const nKeys = keys.length

  for (let gi = 0; gi < nKeys; gi++) {
    if (options.signal?.cancelled) break
    const k = keys[gi]
    const groupPieces = buckets.get(k)!
    const thicknessMm = k === "sin-espesor" ? undefined : parseFloat(k)

    const groupSheets = chosen.optimize(groupPieces, {
      ...options,
      onProgress: (local) => {
        options.onProgress?.((gi + local) / nKeys)
      },
    })

    for (const s of groupSheets) {
      all.push({ ...s, thicknessMm })
    }
  }

  options.onProgress?.(1)
  // Nunca devolver planchas vacías (0% fantasmas en tabs)
  return all.filter((s) => s.pieces.length > 0)
}

export * from "./types"
export { RectangleHeuristicStrategy } from "./strategies/rectangle-heuristic"
export { PolygonPackingStrategy } from "./strategies/polygon-packing"