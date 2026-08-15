import type { Point2D } from "../../nesting/engine/types"
import { emptyCadData, type CadData, type CadEntity } from "./types"
import { sampleArc, sampleCircle } from "./geometry-sampling"
import { type Fragment, chainAndDedupe } from "./chain-fragments"
import { MARK_COLOR, CUT_COLOR } from "./classify-dxf-color"

const MARK_LAYER_CODES = new Set(["2", "3", "4", "5", "99"])

function classifyGeoColor(layerCode: string): string {
  // Capa 1 es siempre corte; por descarte, cualquier otra no listada también.
  return MARK_LAYER_CODES.has(layerCode) ? MARK_COLOR : CUT_COLOR
}

function splitWhitespace(line: string): string[] {
  return line.split(/\s+/).filter(Boolean)
}

/**
 * Puerto de GeoParser::parse (C++/Qt) a TypeScript puro. Recibe el
 * contenido ya leído del archivo .geo (formato TruTops, texto plano) y
 * devuelve la misma estructura CadData que el resto del pipeline
 * espera.
 */
export function parseGeo(fileContent: string): CadData {
  const lines = fileContent.split(/\r\n|\r|\n/).map((l) => l.trim())

  // 1. Bloque de puntos: "#~31" abre, cualquier otra línea "#~..." lo cierra.
  const points = new Map<string, Point2D>()
  let inPoints = false

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("#~31")) inPoints = true
    else if (lines[i].startsWith("#~") && inPoints) inPoints = false

    if (inPoints && lines[i] === "P" && i + 2 < lines.length) {
      const id = lines[i + 1]
      const coords = splitWhitespace(lines[i + 2])
      if (coords.length >= 2) {
        points.set(id, { x: parseFloat(coords[0]), y: parseFloat(coords[1]) })
      }
    }
  }

  // 2. Bloque de geometría: líneas "#~3...1" abren, cualquier otro "#~..." cierra.
  const rawFragments: Fragment[] = []
  const allPoints: Point2D[] = []
  let inGeom = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isGeomHeader = line.startsWith("#~3") && line.endsWith("1")

    if (isGeomHeader) inGeom = true
    else if (line.startsWith("#~") && inGeom && !isGeomHeader) inGeom = false

    if (!inGeom) continue

    if (line === "LIN" && i + 2 < lines.length) {
      const layerCode = splitWhitespace(lines[i + 1])[0] ?? ""
      const refs = splitWhitespace(lines[i + 2])
      const p1 = refs[0] ? points.get(refs[0]) : undefined
      const p2 = refs[1] ? points.get(refs[1]) : undefined

      if (p1 && p2) {
        const pts = [p1, p2]
        rawFragments.push({
          points: pts,
          layer: layerCode,
          color: classifyGeoColor(layerCode),
          isClosingEdge: false,
        })
        allPoints.push(...pts)
      }
    } else if (line === "CIR" && i + 3 < lines.length) {
      const layerCode = splitWhitespace(lines[i + 1])[0] ?? ""
      const center = points.get(lines[i + 2])
      const r = parseFloat(lines[i + 3])

      if (center && r > 0.05) {
        const pts = sampleCircle(center.x, center.y, r)
        rawFragments.push({
          points: pts,
          layer: layerCode,
          color: classifyGeoColor(layerCode),
          isClosingEdge: false,
        })
        allPoints.push(...pts)
      }
    } else if (line === "ARC" && i + 3 < lines.length) {
      const layerCode = splitWhitespace(lines[i + 1])[0] ?? ""
      const refs = splitWhitespace(lines[i + 2])
      const dir = parseFloat(lines[i + 3])

      const c = refs[0] ? points.get(refs[0]) : undefined
      const p1 = refs[1] ? points.get(refs[1]) : undefined
      const p2 = refs[2] ? points.get(refs[2]) : undefined

      if (c && p1 && p2) {
        const r = Math.hypot(p1.x - c.x, p1.y - c.y)
        if (r > 0.05) {
          const startDeg = (Math.atan2(p1.y - c.y, p1.x - c.x) * 180) / Math.PI
          const endDeg = (Math.atan2(p2.y - c.y, p2.x - c.x) * 180) / Math.PI

          // dir > 0: barrido antihorario (start -> end). dir <= 0:
          // horario — se calcula la versión antihoraria invertida
          // (end -> start) y se da vuelta el arreglo de puntos, para
          // no depender de ningún ajuste de signo específico de Qt.
          const pts =
            dir > 0
              ? sampleArc(c.x, c.y, r, startDeg, endDeg)
              : sampleArc(c.x, c.y, r, endDeg, startDeg).reverse()

          rawFragments.push({
            points: pts,
            layer: layerCode,
            color: classifyGeoColor(layerCode),
            isClosingEdge: false,
          })
          allPoints.push(...pts)
        }
      }
    }
  }

  if (allPoints.length === 0) return emptyCadData()

  let minX = allPoints[0].x,
    maxX = allPoints[0].x,
    minY = allPoints[0].y,
    maxY = allPoints[0].y

  for (const p of allPoints) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  const width = maxX - minX
  const height = maxY - minY
  const normalize = (p: Point2D): Point2D => ({ x: p.x - minX, y: p.y - minY })

  // Encadenar los LIN/CIR/ARC sueltos en contornos continuos — antes
  // esto NUNCA pasaba para .geo: cada segmento quedaba como su propio
  // fragmento sin conectar con el resto (mismo bug que tenía DXF antes
  // de arreglarlo, pero intacto acá porque son parsers separados).
  const chains = chainAndDedupe(rawFragments)
  const normalizedEntities: CadEntity[] = chains.map((c) => ({
    outline: { points: c.points.map(normalize) },
    layer: c.layer,
    color: c.color,
  }))

  return {
    outline: { points: allPoints.map(normalize) },
    entities: normalizedEntities,
    width,
    height,
    valid: true,
  }
}