import type { PieceOutline, Point2D } from "../../nesting/engine/types"

/**
 * Equivalente a CadEntidad del original: una entidad individual (línea,
 * arco, círculo o segmento de polilínea ya tesselado a puntos) con su
 * capa y color clasificado. TEXT/MTEXT: outline.points = [insertion].
 */
export interface CadEntity {
  outline: PieceOutline
  layer: string
  /** Color hexadecimal, ej. "#00FF00" (corte) o "#FFA500" (doblez/marca). */
  color: string
  /** Si está definido, es una etiqueta TEXT (no geometría de corte). */
  text?: string
  /** Altura de texto DXF (código 40), en unidades del dibujo. */
  textHeight?: number
}

/**
 * Equivalente a CadData del original: el resultado universal de leer
 * cualquier archivo CAD soportado.
 */
export interface CadData {
  /** Contorno fusionado — todas las entidades combinadas, usado para el bounding box del nesting. */
  outline: PieceOutline
  /** Entidades individuales con su capa/color, para el visor gráfico. */
  entities: CadEntity[]
  width: number
  height: number
  valid: boolean
}

export function emptyCadData(): CadData {
  return { outline: { points: [] }, entities: [], width: 0, height: 0, valid: false }
}

export function mergePoints(entities: CadEntity[]): Point2D[] {
  return entities.flatMap((e) => e.outline.points)
}
