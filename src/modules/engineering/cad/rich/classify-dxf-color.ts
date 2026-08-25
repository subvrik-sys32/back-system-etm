const MARK_LAYER_SUBSTRINGS = [
  "DOBLEZ",
  "BEND",
  "MARCA",
  "MARK",
  "NO CORT",
  "NOCORT",
  "SCORE",
  "PLEGAD",
  "FOLD",
  "ETCH",
  "TEXT",
  "BIEGE",
  "SIGN",
  "GRAV",
  "LEYENDA",
  "FORM",
  "-BL",
  "_BL", // SPI "Bend Lines" (dobleces)
  "-INF",
  "_INF", // SPI "Information" (marcas/textos)
  "-BT",
  "_BT", // SPI "Bend Text" (textos)
  "-BM",
  "_BM", // SPI "Bend Marks" (marcas)
]

const MARK_NUMERIC_LAYERS = new Set(["2", "3", "4", "5", "99"])
const MARK_COLOR_CODES = new Set([2, 6, 30]) // ACI: 2=amarillo, 6=magenta, 30=naranja

export const MARK_COLOR = "#FFA500" // naranja láser (marcado/doblez)
export const CUT_COLOR = "#00FF00" // verde brillante (corte)

/**
 * Puerto exacto de `clasificarColor` en DxfParser.cpp. Clasifica una
 * entidad como marca/doblez (naranja) o corte (verde) según el nombre
 * de su capa, su código de capa numérico, o su código de color ACI.
 */
export function classifyDxfColor(layer: string, colorCode: number): string {
  const upperLayer = layer.toUpperCase()

  const isMarkLayer = MARK_LAYER_SUBSTRINGS.some((s) => upperLayer.includes(s))
  const isNumericMarkLayer = MARK_NUMERIC_LAYERS.has(layer)
  const isMarkColor = MARK_COLOR_CODES.has(colorCode)

  if (isMarkLayer || isNumericMarkLayer || isMarkColor) {
    return MARK_COLOR
  }

  return CUT_COLOR
}
