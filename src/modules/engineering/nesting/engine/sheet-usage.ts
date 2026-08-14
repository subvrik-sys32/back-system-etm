import { boundingRect } from "./geometry"
import type { NestedSheet, SheetConfig } from "./types"

const SAFETY_CAP_PERCENT = 99.9

/**
 * Puerto de la fórmula de "% Rendimiento" de GestorPlanchasDialog:
 * suma el área del bounding box de cada pieza colocada (no el área
 * real del polígono — el original también lo hace así a propósito,
 * porque los contornos DXF no siempre forman polígonos topológicamente
 * cerrados) y la divide entre el área total de la plancha. Con tope de
 * seguridad al 99.9% para no mostrar 100% exacto por redondeo.
 */
export function calculateSheetUsagePercent(sheet: NestedSheet, sheetConfig: SheetConfig): number {
  const totalArea = sheetConfig.width * sheetConfig.height
  if (totalArea <= 0) return 0

  let occupiedArea = 0
  for (const piece of sheet.pieces) {
    const bounds = boundingRect(piece.outline)
    occupiedArea += bounds.width * bounds.height
  }

  const percent = (occupiedArea / totalArea) * 100
  return Math.min(percent, SAFETY_CAP_PERCENT)
}
