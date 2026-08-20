import { Injectable } from "@nestjs/common"
import type { Entity, PlanGeometry } from "../types/entity.types"

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0"
  const s = n.toFixed(4)
  if (s.includes(".")) {
    const trimmed = s.replace(/0+$/, "").replace(/\.$/, "")
    return trimmed === "" || trimmed === "-0" ? "0" : trimmed
  }
  return s
}

function sanitizeLayer(layer: string | undefined, fallback: string): string {
  const raw = (layer || fallback).toUpperCase()
  return raw.replace(/[<>/\\":;?*|=,`]/g, "_").replace(/\s+/g, "_") || fallback
}

function getLayer(entity: Entity): string {
  const defaults: Record<string, string> = {
    fold: "FOLD",
    text: "TEXT",
    dimension: "DIM",
  }
  return sanitizeLayer(entity.layer, defaults[entity.type] ?? "CUT")
}

interface BBox { minX: number; minY: number; maxX: number; maxY: number }

function emptyBBox(): BBox {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
}

function growBBox(b: BBox, x: number, y: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  b.minX = Math.min(b.minX, x)
  b.minY = Math.min(b.minY, y)
  b.maxX = Math.max(b.maxX, x)
  b.maxY = Math.max(b.maxY, y)
}

function entityBBox(e: Entity, b: BBox): void {
  switch (e.type) {
    case "line":
    case "fold":
    case "dimension":
      growBBox(b, e.start[0], e.start[1])
      growBBox(b, e.end[0], e.end[1])
      break
    case "circle":
      growBBox(b, e.center[0] - e.radius, e.center[1] - e.radius)
      growBBox(b, e.center[0] + e.radius, e.center[1] + e.radius)
      break
    case "arc":
      growBBox(b, e.center[0] - e.radius, e.center[1] - e.radius)
      growBBox(b, e.center[0] + e.radius, e.center[1] + e.radius)
      break
    case "polyline":
      for (const p of e.points) growBBox(b, p[0], p[1])
      break
    case "rectangle":
      growBBox(b, e.x, e.y)
      growBBox(b, e.x + e.width, e.y + e.height)
      break
    case "slot": {
      const half = Math.max(e.length, e.width) / 2
      growBBox(b, e.center[0] - half, e.center[1] - half)
      growBBox(b, e.center[0] + half, e.center[1] + half)
      break
    }
    case "ellipse": {
      const r = Math.max(e.radiusX, e.radiusY)
      growBBox(b, e.center[0] - r, e.center[1] - r)
      growBBox(b, e.center[0] + r, e.center[1] + r)
      break
    }
    case "text":
      growBBox(b, e.position[0], e.position[1])
      growBBox(b, e.position[0] + e.text.length * e.height * 0.7, e.position[1] + e.height)
      break
  }
}

let _handleCounter = 0x20
function nextHandle(): string {
  _handleCounter += 1
  return _handleCounter.toString(16).toUpperCase()
}

function dxfLine(h: string, layer: string, x1: number, y1: number, x2: number, y2: number): string {
  return `0\nLINE\n5\n${h}\n8\n${layer}\n10\n${fmt(x1)}\n20\n${fmt(y1)}\n30\n0.0\n11\n${fmt(x2)}\n21\n${fmt(y2)}\n31\n0.0`
}

function dxfCircle(h: string, layer: string, cx: number, cy: number, r: number): string {
  return `0\nCIRCLE\n5\n${h}\n8\n${layer}\n10\n${fmt(cx)}\n20\n${fmt(cy)}\n30\n0.0\n40\n${fmt(r)}`
}

function dxfArc(h: string, layer: string, cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const norm = (a: number) => ((a % 360) + 360) % 360
  return `0\nARC\n5\n${h}\n8\n${layer}\n10\n${fmt(cx)}\n20\n${fmt(cy)}\n30\n0.0\n40\n${fmt(r)}\n50\n${fmt(norm(startDeg))}\n51\n${fmt(norm(endDeg))}`
}

function dxfText(h: string, layer: string, x: number, y: number, height: number, text: string, angleDeg: number): string {
  return `0\nTEXT\n5\n${h}\n8\n${layer}\n10\n${fmt(x)}\n20\n${fmt(y)}\n30\n0.0\n40\n${fmt(height)}\n1\n${text.replace(/[\r\n]+/g, " ")}\n50\n${fmt(angleDeg)}\n7\nSTANDARD`
}

function entityToDxfLines(entity: Entity): string[] {
  const layer = getLayer(entity)
  const out: string[] = []

  switch (entity.type) {
    case "line":
      out.push(dxfLine(nextHandle(), layer, entity.start[0], entity.start[1], entity.end[0], entity.end[1]))
      break

    case "circle":
      out.push(dxfCircle(nextHandle(), layer, entity.center[0], entity.center[1], entity.radius))
      break

    case "arc":
      out.push(dxfArc(nextHandle(), layer, entity.center[0], entity.center[1], entity.radius, entity.startAngle, entity.endAngle))
      break

    case "polyline": {
      const pts = entity.points
      for (let i = 0; i < pts.length - 1; i++) {
        out.push(dxfLine(nextHandle(), layer, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]))
      }
      if (entity.closed && pts.length > 2) {
        out.push(dxfLine(nextHandle(), layer, pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1]))
      }
      break
    }

    case "rectangle": {
      const { x, y, width, height } = entity
      out.push(dxfLine(nextHandle(), layer, x, y, x + width, y))
      out.push(dxfLine(nextHandle(), layer, x + width, y, x + width, y + height))
      out.push(dxfLine(nextHandle(), layer, x + width, y + height, x, y + height))
      out.push(dxfLine(nextHandle(), layer, x, y + height, x, y))
      break
    }

    case "slot": {
      const { center, length, width, angle } = entity
      const halfLen = Math.max(0, length / 2 - width / 2)
      const r = width / 2
      const rad = (angle * Math.PI) / 180
      const dx = Math.cos(rad)
      const dy = Math.sin(rad)
      const nx = -dy
      const ny = dx

      const c1x = center[0] - halfLen * dx
      const c1y = center[1] - halfLen * dy
      const c2x = center[0] + halfLen * dx
      const c2y = center[1] + halfLen * dy

      const ax = c1x + r * nx; const ay = c1y + r * ny
      const bx = c2x + r * nx; const by = c2y + r * ny
      const cx = c2x - r * nx; const cy = c2y - r * ny
      const ddx = c1x - r * nx; const ddy = c1y - r * ny

      out.push(dxfLine(nextHandle(), layer, ax, ay, bx, by))
      out.push(dxfArc(nextHandle(), layer, c2x, c2y, r, (angle * 1) % 360, (angle + 180) % 360))
      out.push(dxfLine(nextHandle(), layer, cx, cy, ddx, ddy))
      out.push(dxfArc(nextHandle(), layer, c1x, c1y, r, (angle + 180) % 360, (angle + 360) % 360))
      break
    }

    case "ellipse": {
      const { center, radiusX, radiusY, angle } = entity
      const rad = (angle * Math.PI) / 180
      const seg = 32
      for (let i = 0; i < seg; i++) {
        const t1 = (2 * Math.PI * i) / seg
        const t2 = (2 * Math.PI * (i + 1)) / seg
        const x1 = center[0] + radiusX * Math.cos(t1) * Math.cos(rad) - radiusY * Math.sin(t1) * Math.sin(rad)
        const y1 = center[1] + radiusX * Math.cos(t1) * Math.sin(rad) + radiusY * Math.sin(t1) * Math.cos(rad)
        const x2 = center[0] + radiusX * Math.cos(t2) * Math.cos(rad) - radiusY * Math.sin(t2) * Math.sin(rad)
        const y2 = center[1] + radiusX * Math.cos(t2) * Math.sin(rad) + radiusY * Math.sin(t2) * Math.cos(rad)
        out.push(dxfLine(nextHandle(), layer, x1, y1, x2, y2))
      }
      break
    }

    case "fold": {
      const foldLayer = sanitizeLayer("FOLD", "FOLD")
      out.push(`0\nLINE\n5\n${nextHandle()}\n8\n${foldLayer}\n6\nDASHED\n10\n${fmt(entity.start[0])}\n20\n${fmt(entity.start[1])}\n30\n0.0\n11\n${fmt(entity.end[0])}\n21\n${fmt(entity.end[1])}\n31\n0.0`)
      break
    }

    case "text":
      out.push(dxfText(nextHandle(), layer, entity.position[0], entity.position[1], entity.height, entity.text, entity.angle))
      break

    case "dimension": {
      const [x1, y1] = entity.start
      const [x2, y2] = entity.end
      const dx = x2 - x1
      const dy = y2 - y1
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const nx = -uy
      const ny = ux
      const off = entity.offset || 0
      const tick = 2.0

      out.push(dxfLine(nextHandle(), layer, x1, y1, x2, y2))

      const arrow = (px: number, py: number, dirSign: 1 | -1) => {
        const a1 = Math.atan2(uy, ux) + (dirSign === 1 ? Math.PI - Math.PI / 6 : -Math.PI / 6)
        const a2 = Math.atan2(uy, ux) + (dirSign === 1 ? Math.PI + Math.PI / 6 : Math.PI / 6)
        out.push(dxfLine(nextHandle(), layer, px, py, px + Math.cos(a1) * tick, py + Math.sin(a1) * tick))
        out.push(dxfLine(nextHandle(), layer, px, py, px + Math.cos(a2) * tick, py + Math.sin(a2) * tick))
      }
      arrow(x1, y1, 1)
      arrow(x2, y2, -1)

      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI
      out.push(dxfText(nextHandle(), layer, (x1 + x2) / 2 + nx * off, (y1 + y2) / 2 + ny * off, 3.0, entity.text ?? "", angleDeg))
      break
    }
  }

  return out
}

function buildHeader(bbox: BBox): string {
  const minX = Number.isFinite(bbox.minX) ? bbox.minX : 0
  const minY = Number.isFinite(bbox.minY) ? bbox.minY : 0
  const maxX = Number.isFinite(bbox.maxX) ? bbox.maxX : 100
  const maxY = Number.isFinite(bbox.maxY) ? bbox.maxY : 100
  return [
    "0", "SECTION", "2", "HEADER",
    "9", "$ACADVER", "1", "AC1009",
    "9", "$INSBASE", "10", "0.0", "20", "0.0", "30", "0.0",
    "9", "$EXTMIN", "10", fmt(minX), "20", fmt(minY), "30", "0.0",
    "9", "$EXTMAX", "10", fmt(maxX), "20", fmt(maxY), "30", "0.0",
    "9", "$LTSCALE", "40", "1.0",
    "9", "$LUNITS", "70", "2",
    "9", "$LUPREC", "70", "4",
    "9", "$TEXTSIZE", "40", "2.5",
    "9", "$TEXTSTYLE", "7", "STANDARD",
    "9", "$CLAYER", "8", "0",
    "9", "$CELTYPE", "6", "BYLAYER",
    "9", "$CECOLOR", "62", "256",
    "9", "$HANDLING", "70", "1",
    "9", "$HANDSEED", "5", "FFFF",
    "0", "ENDSEC",
  ].join("\n")
}

function buildTables(): string {
  return [
    "0", "SECTION", "2", "TABLES",

    "0", "TABLE", "2", "LTYPE", "70", "3",
    "0", "LTYPE", "2", "CONTINUOUS", "70", "0",
    "3", "Solid line", "72", "65", "73", "0", "40", "0.0",
    "0", "LTYPE", "2", "DASHED", "70", "0",
    "3", "Dashed __ __ __ __", "72", "65", "73", "2",
    "40", "0.75", "49", "0.5", "74", "0", "49", "-0.25", "74", "0",
    "0", "LTYPE", "2", "CENTER", "70", "0",
    "3", "Center ____ _ ____", "72", "65", "73", "4",
    "40", "2.0", "49", "1.25", "74", "0", "49", "-0.25", "74", "0",
    "49", "0.25", "74", "0", "49", "-0.25", "74", "0",
    "0", "ENDTAB",

    "0", "TABLE", "2", "LAYER", "70", "6",
    "0", "LAYER", "2", "0", "70", "0", "62", "7", "6", "CONTINUOUS",
    "0", "LAYER", "2", "CUT", "70", "0", "62", "1", "6", "CONTINUOUS",
    "0", "LAYER", "2", "ETCH", "70", "0", "62", "3", "6", "CONTINUOUS",
    "0", "LAYER", "2", "FOLD", "70", "0", "62", "5", "6", "DASHED",
    "0", "LAYER", "2", "TEXT", "70", "0", "62", "7", "6", "CONTINUOUS",
    "0", "LAYER", "2", "DIM", "70", "0", "62", "8", "6", "CONTINUOUS",
    "0", "ENDTAB",

    "0", "TABLE", "2", "STYLE", "70", "1",
    "0", "STYLE", "2", "STANDARD", "70", "0",
    "40", "0.0", "41", "1.0", "50", "0.0", "71", "0", "42", "2.5",
    "3", "txt",
    "0", "ENDTAB",

    "0", "TABLE", "2", "VIEW", "70", "0",
    "0", "ENDTAB",
    "0", "TABLE", "2", "UCS", "70", "0",
    "0", "ENDTAB",
    "0", "TABLE", "2", "APPID", "70", "1",
    "0", "APPID", "2", "ACAD", "70", "0",
    "0", "ENDTAB",

    "0", "ENDSEC",
  ].join("\n")
}

function buildBlocks(): string {
  return [
    "0", "SECTION", "2", "BLOCKS",
    "0", "BLOCK", "8", "0", "2", "$MODEL_SPACE",
    "70", "0", "10", "0.0", "20", "0.0", "30", "0.0",
    "3", "$MODEL_SPACE", "1", "",
    "0", "ENDBLK", "5", "21", "8", "0",
    "0", "BLOCK", "67", "1", "8", "0", "2", "$PAPER_SPACE",
    "70", "0", "10", "0.0", "20", "0.0", "30", "0.0",
    "3", "$PAPER_SPACE", "1", "",
    "0", "ENDBLK", "5", "53", "67", "1", "8", "0",
    "0", "ENDSEC",
  ].join("\n")
}

@Injectable()
export class DxfGeneratorService {

  geometryToDxf(geometry: PlanGeometry): string {
    _handleCounter = 0x20

    let allEntities: Entity[] = []

    const views = geometry.views || []
    const flatPattern = views.find(v => {
      const name = (v.name || "").toLowerCase()
      const label = (v.label || "").toLowerCase()
      return name === "flat_pattern" ||
        name.includes("flat") || name.includes("pattern") || name.includes("despleg") ||
        label.includes("flat") || label.includes("pattern") || label.includes("despleg") ||
        label.includes("plano")
    })

    if (flatPattern && flatPattern.entities && flatPattern.entities.length > 0) {
      allEntities = flatPattern.entities
    } else if (views.length > 0) {
      const viewWithEntities = views.find(v => v.entities && v.entities.length > 0)
      if (viewWithEntities) {
        allEntities = viewWithEntities.entities
      }
    } else if (geometry.entities && geometry.entities.length > 0) {
      allEntities = geometry.entities
    }

    const bbox = emptyBBox()
    const parts: string[] = []
    for (const e of allEntities) {
      const dxfParts = entityToDxfLines(e)
      if (dxfParts.length > 0) {
        parts.push(...dxfParts)
        entityBBox(e, bbox)
      }
    }

    const entitiesSection = `0\nSECTION\n2\nENTITIES\n${parts.join("\n")}\n0\nENDSEC`

    return `${buildHeader(bbox)}\n${buildTables()}\n${buildBlocks()}\n${entitiesSection}\n0\nEOF\n`
  }

}
