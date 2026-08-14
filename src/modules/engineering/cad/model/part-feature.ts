/**
 * Features semánticos (agujero, ranura, etc.).
 * El generator interpreta features → entidades geométricas.
 */
export type PartFeature =
  | {
      type: 'HOLE_GRID'
      diameter: number
      /** Centros en coords de pieza (origen esquina inferior izquierda). */
      centers: { x: number; y: number }[]
    }
  | {
      type: 'RECT_OUTER'
      width: number
      height: number
    }
