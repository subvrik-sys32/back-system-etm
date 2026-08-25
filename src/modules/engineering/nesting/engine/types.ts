/**
 * Motor de nesting — capa 100% pura (sin React, sin DOM, sin Next.js).
 * Puede correr en el hilo principal, en un Web Worker, o más adelante
 * en un endpoint de servidor, sin cambiar una sola línea de este
 * módulo. Es un puerto del NestingEngine original (C++/Qt).
 */

export interface Point2D {
  x: number;
  y: number;
}

/** Rectángulo alineado a los ejes (bounding box). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Contorno de una pieza: lista de puntos que forman su silueta. */
export interface PieceOutline {
  points: Point2D[];
}

/** Un trazo individual con su color real clasificado (ej. corte vs doblez/marca) y su capa original del CAD de origen (para exportar respetando el nombre real, ej. "SPI_UNF-BL"). */
export interface SubEntity {
  outline: PieceOutline;
  color?: string;
  /** Nombre de capa original del DXF/GEO (grupo 8 en DXF). Ausente para piezas sin origen CAD real (ej. rectángulos manuales). */
  layer?: string;
  /** Etiqueta TEXT/MTEXT del DXF (ej. "PLANCHA 1"). outline.points[0] = inserción. */
  text?: string;
  /** Altura de texto DXF (código 40). */
  textHeight?: number;
}

/** Pieza de entrada para el nesting. */
export interface NestingPiece {
  id: string;
  /** Contorno fusionado — SOLO para bounding box/colisión. No dibujar como un único polígono relleno: es la unión de todas las entidades, no un trazo continuo real. */
  outline: PieceOutline;
  /** Trazos individuales reales (contorno + huecos), cada uno con su propio color clasificado (verde=corte, naranja=doblez/marca). Si no se provee (ej. rectángulo manual), se usa `outline` + `color` como único trazo. */
  subEntities?: SubEntity[];
  color?: string;
  /** Cantidad de copias de esta pieza a acomodar. Default 1. */
  quantity?: number;
  /** Espesor de chapa (mm) si se detectó en el CAD. Usado para no mezclar espesores en la misma plancha. */
  thicknessMm?: number;
}

/** Pieza ya colocada en una plancha, con su posición y rotación final. */
export interface PlacedPiece {
  pieceId: string;
  x: number;
  y: number;
  /** Grados: 0, 90, 180 o 270. */
  angle: number;
  /** Contorno fusionado ya transformado — SOLO para bounding box, no para dibujar como polígono relleno (ver NestingPiece.outline). */
  outline: PieceOutline;
  /** Trazos individuales ya transformados a la posición/rotación final, cada uno con su color real, listos para dibujar tal cual. */
  subEntities?: SubEntity[];
  color?: string;
}

/** Una plancha con sus piezas ya acomodadas. */
export interface NestedSheet {
  pieces: PlacedPiece[];
  /** Espesor del grupo (mm) con el que se nestó esta plancha. undefined = sin dato. */
  thicknessMm?: number;
}

export type NestingMode = "fast" | "precise";

export interface SheetConfig {
  width: number;
  height: number;
  margin: number;
}

export type RotationMode = "0-90-180-270" | "libre" | "ninguna";

export interface NestingOptions {
  sheet: SheetConfig;
  /** "fast" = AABB; "precise" = polígono + calados. */
  mode?: NestingMode;
  /** Separación mínima entre piezas (mm). */
  separation?: number;
  /** Ángulos permitidos (ProjectSettings.rotacionPermitida). */
  rotationMode?: RotationMode;
  /** Paso de búsqueda en mm. */
  searchStep?: number;
  /** Progreso 0-1, útil para una barra de progreso desde un worker. */
  onProgress?: (progress: number) => void;
  /** Señal de cancelación mutable: el worker la marca en `cancelled = true`. */
  signal?: { cancelled: boolean };
}

/**
 * Contrato que debe cumplir cualquier algoritmo de nesting. Hoy solo
 * existe RectangleHeuristicStrategy (basada en bounding box, igual al
 * motor C++ original). Si más adelante se necesita nesting real de
 * polígono (No-Fit-Polygon) para piezas cóncavas, se agrega una clase
 * nueva que implemente esta misma interfaz — nada del código que llama
 * a `optimize()` tiene que cambiar.
 */
export interface NestingStrategy {
  optimize(pieces: NestingPiece[], options: NestingOptions): NestedSheet[];
}