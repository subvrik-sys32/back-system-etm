import { parseDxf } from "./dxf-parser"
import { parseGeo } from "./geo-parser"
import { emptyCadData, type CadData } from "./types"

/**
 * Lee un archivo CAD (contenido ya como texto) y enruta al parser
 * correcto según la extensión. Equivalente a CadReader::leerArchivo.
 *
 * PDF no pasa por acá: a diferencia de DXF/GEO, un PDF es binario y
 * su parseo (pdf.js) es async — vive en pdf-parser.ts como una función
 * aparte (parsePdf/isPdfFile), llamada directo desde donde se importan
 * archivos. El original en C++ resolvía PDF invocando Inkscape.exe
 * como proceso externo para convertir a DXF primero; acá se lee el
 * PDF directo, sin depender de ningún binario externo.
 */
export function readCadFile(fileName: string, fileContent: string): CadData {
  const ext = fileName.toLowerCase().split(".").pop() ?? ""

  switch (ext) {
    case "dxf":
      return parseDxf(fileContent)
    case "geo":
      return parseGeo(fileContent)
    default:
      return emptyCadData()
  }
}

export function isSupportedCadFile(fileName: string): boolean {
  const ext = fileName.toLowerCase().split(".").pop() ?? ""
  return ext === "dxf" || ext === "geo"
}

export * from "./types"
export { parseDxf } from "./dxf-parser"
export { parseGeo } from "./geo-parser"