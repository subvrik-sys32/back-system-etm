import type { Point2D } from "../../nesting/engine/types"
import { CUT_COLOR } from "./classify-dxf-color"

export const CHAIN_EPS = 0.01

export function samePoint(a: Point2D, b: Point2D): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < CHAIN_EPS
}

export interface Fragment {
  points: Point2D[]
  layer: string
  color: string
  isClosingEdge: boolean
}

export interface Chain {
  points: Point2D[]
  closed: boolean
  layer: string
  color: string
}

function bucketKey(p: Point2D): string {
  const bx = Math.round(p.x / CHAIN_EPS)
  const by = Math.round(p.y / CHAIN_EPS)
  return `${bx},${by}`
}

function neighborKeys(p: Point2D): string[] {
  const bx = Math.round(p.x / CHAIN_EPS)
  const by = Math.round(p.y / CHAIN_EPS)
  const keys: string[] = []
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      keys.push(`${bx + dx},${by + dy}`)
    }
  }
  return keys
}

export function chainFragments(fragments: Fragment[]): Chain[] {
  const used = new Array(fragments.length).fill(false)
  const chains: Chain[] = []

  // Índice: bucket -> lista de [índice de fragmento, extremo] que cae ahí.
  const index = new Map<string, { fragIdx: number; isStart: boolean }[]>()
  const addToIndex = (fragIdx: number, point: Point2D, isStart: boolean) => {
    const key = bucketKey(point)
    const list = index.get(key)
    if (list) list.push({ fragIdx, isStart })
    else index.set(key, [{ fragIdx, isStart }])
  }
  fragments.forEach((f, idx) => {
    addToIndex(idx, f.points[0], true)
    addToIndex(idx, f.points[f.points.length - 1], false)
  })

  /** Busca en el índice un fragmento SIN USAR cuyo extremo toque `point`. */
  const findMatch = (point: Point2D): { fragIdx: number; matchedStart: boolean } | null => {
    for (const key of neighborKeys(point)) {
      const bucket = index.get(key)
      if (!bucket) continue
      for (const entry of bucket) {
        if (used[entry.fragIdx]) continue
        const frag = fragments[entry.fragIdx].points
        const candidatePoint = entry.isStart ? frag[0] : frag[frag.length - 1]
        if (samePoint(point, candidatePoint)) {
          return { fragIdx: entry.fragIdx, matchedStart: entry.isStart }
        }
      }
    }
    return null
  }

  for (let i = 0; i < fragments.length; i++) {
    if (used[i]) continue
    used[i] = true
    let chain = [...fragments[i].points]
    const memberIdx = [i]

    let extended = true
    while (extended) {
      extended = false
      const start = chain[0]
      const end = chain[chain.length - 1]
      if (chain.length > 2 && samePoint(start, end)) break // ya cerró

      const matchAtEnd = findMatch(end)
      if (matchAtEnd) {
        const frag = fragments[matchAtEnd.fragIdx].points
        chain = matchAtEnd.matchedStart
          ? chain.concat(frag.slice(1))
          : chain.concat([...frag].reverse().slice(1))
        used[matchAtEnd.fragIdx] = true
        memberIdx.push(matchAtEnd.fragIdx)
        extended = true
        continue
      }

      const matchAtStart = findMatch(start)
      if (matchAtStart) {
        const frag = fragments[matchAtStart.fragIdx].points
        chain = matchAtStart.matchedStart
          ? [...frag].reverse().slice(0, -1).concat(chain)
          : frag.slice(0, -1).concat(chain)
        used[matchAtStart.fragIdx] = true
        memberIdx.push(matchAtStart.fragIdx)
        extended = true
      }
    }

    const closed = chain.length > 2 && samePoint(chain[0], chain[chain.length - 1])
    const members = memberIdx.map((k) => fragments[k])
    const anyCut = members.some((f) => f.color === CUT_COLOR)
    const color = anyCut ? CUT_COLOR : members[0].color
    const layer = anyCut
      ? (members.find((f) => f.color === CUT_COLOR)?.layer ?? members[0].layer)
      : members[0].layer

    chains.push({ points: chain, closed, layer, color })
  }

  return chains
}

export function cancelDuplicateClosingEdges(fragments: Fragment[]): Fragment[] {
  const keyOf = (f: Fragment) => {
    const a = f.points[0]
    const b = f.points[f.points.length - 1]
    // Redondeo a la tolerancia de encadenado para que el orden de los
    // extremos no importe y para tolerar el mismo ruido numérico que
    // ya tolera samePoint().
    const round = (v: number) => Math.round(v / CHAIN_EPS) * CHAIN_EPS
    const pa = `${round(a.x)},${round(a.y)}`
    const pb = `${round(b.x)},${round(b.y)}`
    return pa < pb ? `${pa}|${pb}` : `${pb}|${pa}`
  }

  const byKey = new Map<string, number[]>()
  fragments.forEach((f, i) => {
    if (!f.isClosingEdge) return
    const k = keyOf(f)
    const list = byKey.get(k)
    if (list) list.push(i)
    else byKey.set(k, [i])
  })

  const cancelled = new Set<number>()
  for (const idxs of byKey.values()) {
    // Anular de a pares; si queda 1 suelto (sin pareja), se conserva.
    for (let n = 0; n + 1 < idxs.length; n += 2) {
      cancelled.add(idxs[n])
      cancelled.add(idxs[n + 1])
    }
  }

  return fragments.filter((_, i) => !cancelled.has(i))
}

export function chainAndDedupe(fragments: Fragment[]): Chain[] {
  return chainFragments(cancelDuplicateClosingEdges(fragments))
}