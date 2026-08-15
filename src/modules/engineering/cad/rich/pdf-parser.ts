import type { Point2D } from "../../nesting/engine/types"
import type { CadData, CadEntity } from "./types"

// pt -> mm. Los PDF miden todo en puntos (1/72"), pero el resto del
// motor de nesting trabaja en milímetros (igual que los DXF, que ya
// vienen en mm) — sin esta conversión, una pieza importada de PDF
// quedaría ~2.8x más grande que su tamaño real.
const PT_TO_MM = 25.4 / 72

// Códigos de sub-operación dentro del array plano que arma
// constructPath (OPS.constructPath) — confirmados empíricamente
// contra pdf.js 6.2.108, no documentados públicamente con este detalle:
//   0 = moveTo   (2 args: x, y)
//   1 = lineTo   (2 args: x, y)
//   2 = curveTo  (6 args: cp1x, cp1y, cp2x, cp2y, x, y — Bézier cúbica)
//   4 = closePath (0 args)
// El operador "re" (rectángulo) no tiene código propio: pdf.js ya lo
// descompone en moveTo + 3×lineTo + closePath antes de llegar acá.
const OP_MOVE = 0
const OP_LINE = 1
const OP_CURVE = 2
const OP_CLOSE = 4

const OPS_CONSTRUCT_PATH = 91 // OPS.constructPath — fijo en pdf.js, no cambia entre versiones menores

const BEZIER_SEGMENTS = 12 // puntos por curva; suficiente para que no se note el tesselado a la escala de una pieza de chapa

interface PdfPathSegment {
  points: Point2D[]
  strokeColor: string
}

function cubicBezierPoint(t: number, p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D): Point2D {
  const mt = 1 - t
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)))
  const hex = (v: number) => clamp(v).toString(16).padStart(2, "0")
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase()
}

/**
 * Recorre la operator list de una página y arma un path por cada
 * subtrazo (cada moveTo abre uno nuevo), tesselando curvas a
 * segmentos. Sigue el color de trazo activo (setStrokeRGBColor /
 * setStrokeGray) para que las piezas conserven algo de la
 * clasificación por color, igual que en DXF.
 */
function extractPathsFromOperatorList(fnArray: number[], argsArray: unknown[][], opsConstants: Record<string, number>): PdfPathSegment[] {
  const paths: PdfPathSegment[] = []
  let currentColor = "#22C55E" // verde por defecto, igual que la clasificación "corte" de DXF

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i]

    if (fn === opsConstants.setStrokeRGBColor) {
      const [r, g, b] = argsArray[i] as number[]
      currentColor = rgbToHex(r / 255, g / 255, b / 255)
      continue
    }
    if (fn === opsConstants.setStrokeGray) {
      const [gray] = argsArray[i] as number[]
      currentColor = rgbToHex(gray, gray, gray)
      continue
    }

    if (fn !== OPS_CONSTRUCT_PATH) continue

    const args = argsArray[i] as [unknown, unknown[], unknown]
    const flatContainer = args[1][0]
    // El array plano puede venir como Array real o como objeto con
    // claves numéricas (JSON-serializado desde un typed array) según
    // el contexto de ejecución — Object.values respeta el orden
    // ascendente de claves numéricas en JS, así que es seguro en
    // ambos casos.
    const flat: number[] = Array.isArray(flatContainer) ? flatContainer : Object.values(flatContainer as Record<string, number>)

    let current: Point2D | null = null
    let subpathStart: Point2D | null = null
    let points: Point2D[] = []

    const flushSubpath = () => {
      if (points.length >= 2) {
        paths.push({ points, strokeColor: currentColor })
      }
      points = []
    }

    let idx = 0
    while (idx < flat.length) {
      const op = flat[idx]

      if (op === OP_MOVE) {
        flushSubpath()
        const p = { x: flat[idx + 1], y: flat[idx + 2] }
        current = p
        subpathStart = p
        points = [p]
        idx += 3
      } else if (op === OP_LINE) {
        const p = { x: flat[idx + 1], y: flat[idx + 2] }
        points.push(p)
        current = p
        idx += 3
      } else if (op === OP_CURVE) {
        const cp1 = { x: flat[idx + 1], y: flat[idx + 2] }
        const cp2 = { x: flat[idx + 3], y: flat[idx + 4] }
        const end = { x: flat[idx + 5], y: flat[idx + 6] }
        if (current) {
          for (let s = 1; s <= BEZIER_SEGMENTS; s++) {
            points.push(cubicBezierPoint(s / BEZIER_SEGMENTS, current, cp1, cp2, end))
          }
        }
        current = end
        idx += 7
      } else if (op === OP_CLOSE) {
        if (subpathStart) points.push(subpathStart)
        idx += 1
      } else {
        // Sub-operación no reconocida (variantes de curva con menos
        // puntos de control, principalmente) — se salta de a un valor
        // para no trabar el recorrido; en la práctica los exports CAM
        // a PDF (el caso real de uso acá) rara vez las usan.
        idx += 1
      }
    }

    flushSubpath()
  }

  return paths
}

function boundsOf(points: Point2D[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Lee un PDF vectorial (típicamente exportado desde un CAM/CAD, no un
 * escaneo) y extrae su geometría de trazo como piezas. El original en
 * C++ (PdfVectorParser) resolvía esto invocando Inkscape.exe como
 * proceso externo para convertir a DXF primero — acá se lee el PDF
 * directo con pdf.js, sin depender de ningún binario externo.
 *
 * Async por naturaleza (pdf.js parsea de forma asíncrona) — a
 * diferencia de parseDxf/parseGeo que son síncronos, por eso vive
 * fuera del router síncrono de cad-reader.ts.
 */
export async function parsePdf(fileName: string, data: ArrayBuffer): Promise<CadData> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const { getDocument, OPS } = pdfjs

  const doc = await getDocument({ data, useSystemFonts: true, disableWorker: true }).promise

  const allEntities: CadEntity[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const opList = await page.getOperatorList()
    const [, , , pageHeightPt] = page.view // [x0, y0, x1, y1] en pt

    const paths = extractPathsFromOperatorList(opList.fnArray, opList.argsArray as unknown[][], OPS as unknown as Record<string, number>)

    for (const path of paths) {
      const outline = {
        points: path.points.map((p) => ({
          x: p.x * PT_TO_MM,
          // Y invertido: PDF tiene el origen abajo-izquierda (como
          // DXF), el resto del motor asume Y hacia abajo.
          y: (pageHeightPt - p.y) * PT_TO_MM,
        })),
      }
      allEntities.push({ outline, layer: `page-${pageNum}`, color: path.strokeColor })
    }
  }

  if (allEntities.length === 0) {
    return { outline: { points: [] }, entities: [], width: 0, height: 0, valid: false }
  }

  const allPoints = allEntities.flatMap((e) => e.outline.points)
  const bounds = boundsOf(allPoints)

  return {
    outline: { points: allPoints },
    entities: allEntities,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    valid: true,
  }
}

export function isPdfFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".pdf")
}