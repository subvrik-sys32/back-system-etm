/**
 * dxf-geometry-parser.ts
 *
 * Convierte las entidades crudas de `dxf-parser` en piezas individuales
 * listas para el reporte PDF.
 *
 * DECISIÓN CLAVE (v2): las piezas NO se agrupan por `layer`. En un DXF
 * de corte anidado real, todas las piezas suelen vivir en la misma capa
 * (o en un puñado de capas por función: corte/doblez/grabado), así que
 * agrupar por capa produce UNA sola "pieza" gigante (el layout completo)
 * en vez de piezas individuales. En su lugar:
 *
 *   1. Se agrupan las entidades por CONECTIVIDAD GEOMÉTRICA: líneas,
 *      arcos y polilíneas abiertas que comparten un extremo (dentro de
 *      una tolerancia) se consideran parte del mismo contorno. Una
 *      polilínea cerrada ya es un contorno completo por sí sola.
 *   2. Cada contorno resultante es un candidato a "pieza".
 *   3. Si el bounding box de un contorno queda completamente dentro del
 *      bounding box de otro contorno más grande, se reclasifica como
 *      un AGUJERO/detalle interno de ese contorno mayor (no como pieza
 *      independiente).
 *   4. Los CIRCLE (que no tienen extremos que conectar) se asignan como
 *      agujero de la pieza cuyo bounding box los contiene.
 *   5. Piezas con la misma geometría (ancho, alto, agujeros) se
 *      fusionan sumando su "Cantidad".
 *
 * Notas sobre dxf-parser:
 *  - El centro de CIRCLE y ARC viene en `entity.center`, no en `position`.
 *  - Los ángulos de ARC ya vienen en RADIANES.
 */

export interface DrawEntity {
  kind: 'line' | 'polyline' | 'circle' | 'arc';
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  points?: { x: number; y: number }[];
  closed?: boolean;
  cx?: number;
  cy?: number;
  r?: number;
  start?: number;
  end?: number;
}

export interface DxfPiece {
  id: string;
  width: number;
  height: number;
  holes: number;
  count: number;
  area: number;
  entities: DrawEntity[];
}

export interface DxfLayout {
  entities: DrawEntity[];
  width: number;
  height: number;
}

export interface DxfGeometryResult {
  pieces: DxfPiece[];
  layout: DxfLayout;
}

interface Point {
  x: number;
  y: number;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Tolerancia para considerar que dos puntos son "el mismo" extremo. */
const POINT_TOLERANCE = 0.01; // mm
const ARC_SAMPLE_POINTS = 16;

// ---------------------------------------------------------------------------
// Entrada pública
// ---------------------------------------------------------------------------

export function parseDxfGeometry(rawEntities: any[]): DxfGeometryResult {
  if (!rawEntities || rawEntities.length === 0) {
    return { pieces: [], layout: { entities: [], width: 0, height: 0 } };
  }

  const { segments, circles, allForLayout } = collectEntities(rawEntities);

  const contours = groupIntoContours(segments);
  const { outerContours, holeCountByContour, holeAreaByContour } = classifyContours(contours);
  assignCirclesToContours(circles, outerContours, holeCountByContour, holeAreaByContour);

  const rawPieces = outerContours.map((c) => buildPiece(c, holeCountByContour, holeAreaByContour));
  const pieces = mergeDuplicates(rawPieces.filter((p) => p.width > 0 && p.height > 0));

  const layout = buildLayout(allForLayout);

  return { pieces, layout };
}

// ---------------------------------------------------------------------------
// Paso 1: normalizar entidades crudas de dxf-parser a DrawEntity + puntos
// ---------------------------------------------------------------------------

interface SegmentEntity {
  entity: DrawEntity;
  /** Todos los puntos de la entidad (para bbox / área). */
  points: Point[];
  /** Extremos usables para conectar con otras entidades (vacío = no conecta). */
  endpoints: Point[];
}

interface CircleEntity {
  entity: DrawEntity;
  center: Point;
}

function collectEntities(rawEntities: any[]): {
  segments: SegmentEntity[];
  circles: CircleEntity[];
  allForLayout: DrawEntity[];
} {
  const segments: SegmentEntity[] = [];
  const circles: CircleEntity[] = [];
  const allForLayout: DrawEntity[] = [];

  for (const e of rawEntities) {
    switch (e.type) {
      case 'CIRCLE': {
        const r: number = e.radius || 0;
        const cx: number = e.center?.x ?? 0;
        const cy: number = e.center?.y ?? 0;
        const entity: DrawEntity = { kind: 'circle', cx, cy, r };
        circles.push({ entity, center: { x: cx, y: cy } });
        allForLayout.push(entity);
        break;
      }

      case 'ARC': {
        const r: number = e.radius || 0;
        const cx: number = e.center?.x ?? 0;
        const cy: number = e.center?.y ?? 0;
        const start: number = e.startAngle ?? 0;
        const end: number = e.endAngle ?? Math.PI * 2;
        const entity: DrawEntity = { kind: 'arc', cx, cy, r, start, end };
        allForLayout.push(entity);

        const sampled = sampleArc(cx, cy, r, start, end);
        segments.push({
          entity,
          points: sampled,
          endpoints: [sampled[0], sampled[sampled.length - 1]],
        });
        break;
      }

      case 'LWPOLYLINE':
      case 'POLYLINE': {
        const points: Point[] = (e.vertices || [])
          .filter((p: any) => p && p.x !== undefined && p.y !== undefined)
          .map((p: any) => ({ x: p.x, y: p.y }));
        if (points.length < 2) break;

        const flaggedClosed = !!e.shape || !!e.closed;
        const visuallyClosed = samePoint(points[0], points[points.length - 1]);
        const closed = flaggedClosed || visuallyClosed;

        const entity: DrawEntity = { kind: 'polyline', points, closed };
        allForLayout.push(entity);

        segments.push({
          entity,
          points,
          // Una polilínea cerrada ya es un contorno completo: no necesita
          // conectarse con nada más, así que no exponemos extremos.
          endpoints: closed ? [] : [points[0], points[points.length - 1]],
        });
        break;
      }

      case 'LINE': {
        const a = e.vertices?.[0] ?? e.start;
        const b = e.vertices?.[1] ?? e.end;
        if (!a || !b || a.x === undefined || b.x === undefined) break;

        const entity: DrawEntity = { kind: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y };
        allForLayout.push(entity);

        segments.push({
          entity,
          points: [
            { x: a.x, y: a.y },
            { x: b.x, y: b.y },
          ],
          endpoints: [
            { x: a.x, y: a.y },
            { x: b.x, y: b.y },
          ],
        });
        break;
      }

      default:
        // HATCH, SPLINE, INSERT, DIMENSION, TEXT, etc. no se dibujan.
        break;
    }
  }

  return { segments, circles, allForLayout };
}

function sampleArc(cx: number, cy: number, r: number, start: number, end: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= ARC_SAMPLE_POINTS; i++) {
    const t = start + ((end - start) * i) / ARC_SAMPLE_POINTS;
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
  }
  return pts;
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= POINT_TOLERANCE && Math.abs(a.y - b.y) <= POINT_TOLERANCE;
}

// ---------------------------------------------------------------------------
// Paso 2: agrupar segmentos en contornos por conectividad (Union-Find)
// ---------------------------------------------------------------------------

interface Contour {
  members: SegmentEntity[];
  bounds: Bounds;
  /** true si el contorno es exactamente una única polilínea cerrada. */
  isSingleClosedPolyline: boolean;
}

function groupIntoContours(segments: SegmentEntity[]): Contour[] {
  const n = segments.length;
  if (n === 0) return [];

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  // Índice de puntos redondeados -> entidades que tienen ese punto como extremo.
  const pointIndex = new Map<string, number[]>();
  const keyFor = (p: Point) => `${Math.round(p.x / POINT_TOLERANCE)}:${Math.round(p.y / POINT_TOLERANCE)}`;

  segments.forEach((seg, idx) => {
    for (const ep of seg.endpoints) {
      const key = keyFor(ep);
      const bucket = pointIndex.get(key);
      if (bucket) {
        for (const other of bucket) union(idx, other);
        bucket.push(idx);
      } else {
        pointIndex.set(key, [idx]);
      }
    }
  });

  const groups = new Map<number, SegmentEntity[]>();
  segments.forEach((seg, idx) => {
    const root = find(idx);
    const arr = groups.get(root);
    if (arr) arr.push(seg);
    else groups.set(root, [seg]);
  });

  return Array.from(groups.values()).map((members) => {
    const bounds = boundsOf(members.flatMap((m) => m.points));
    const isSingleClosedPolyline =
      members.length === 1 && members[0].entity.kind === 'polyline' && !!members[0].entity.closed;
    return { members, bounds, isSingleClosedPolyline };
  });
}

function boundsOf(points: Point[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

// ---------------------------------------------------------------------------
// Paso 3: distinguir contornos "pieza" de contornos "agujero/detalle interno"
// ---------------------------------------------------------------------------

/**
 * Una vez agrupadas las entidades en contornos por conectividad, hay que
 * decidir cuáles son PIEZAS reales y cuáles son AGUJEROS/detalles internos
 * de otra pieza. La trampa: el contorno de la CHAPA/PLANCHA completa
 * también "contiene" geométricamente a todas las piezas (todas caben
 * dentro de su bounding box), así que una regla ingenua de "si cabe
 * adentro, es un agujero" termina tratando la chapa entera como si fuera
 * una sola pieza gigante con todas las piezas reales como "agujeros".
 *
 * La distinción real: un agujero SIEMPRE es pequeño en relación a la
 * pieza que lo contiene. Si lo que "contiene" a otros contornos tiene
 * adentro algo demasiado grande para ser un agujero (más de HOLE_MAX_RATIO
 * de su propia área, o varios hijos que en conjunto superan
 * CHILDREN_SUM_MAX_RATIO), ese contenedor no es una pieza: es el borde de
 * la chapa (u otro contenedor sin relevancia productiva) y se descarta.
 * Sus hijos se re-evalúan de forma independiente en la misma pasada.
 */
const HOLE_MAX_RATIO = 0.25; // un solo "agujero" no puede superar el 25% del área de su pieza
const CHILDREN_SUM_MAX_RATIO = 0.6; // ni el conjunto de "agujeros" superar el 60%

function classifyContours(contours: Contour[]): {
  outerContours: Contour[];
  holeCountByContour: Map<Contour, number>;
  holeAreaByContour: Map<Contour, number>;
} {
  const holeCountByContour = new Map<Contour, number>();
  const holeAreaByContour = new Map<Contour, number>();

  const byAreaDesc = [...contours].sort((a, b) => bboxArea(b.bounds) - bboxArea(a.bounds));

  const outer: Contour[] = [];
  const excluded = new Set<Contour>(); // contenedores descartados (ej. borde de chapa)
  const demoted = new Set<Contour>(); // contornos reclasificados como agujero de una pieza

  for (const candidate of byAreaDesc) {
    if (demoted.has(candidate) || excluded.has(candidate)) continue;

    const children = byAreaDesc.filter(
      (c) => c !== candidate && !demoted.has(c) && !excluded.has(c) && contains(candidate.bounds, c.bounds),
    );

    if (children.length === 0) {
      outer.push(candidate);
      continue;
    }

    const candidateArea = bboxArea(candidate.bounds);
    const maxChildArea = Math.max(...children.map((c) => bboxArea(c.bounds)));
    const sumChildArea = children.reduce((sum, c) => sum + bboxArea(c.bounds), 0);

    const looksLikeContainer =
      maxChildArea > candidateArea * HOLE_MAX_RATIO || sumChildArea > candidateArea * CHILDREN_SUM_MAX_RATIO;

    if (looksLikeContainer) {
      // No es una pieza real (ej. el borde de la chapa/plancha): se
      // descarta y sus hijos se evalúan por su cuenta en el resto del loop.
      excluded.add(candidate);
      continue;
    }

    outer.push(candidate);
    for (const child of children) {
      demoted.add(child);
      holeCountByContour.set(candidate, (holeCountByContour.get(candidate) || 0) + 1);
      const area = contourArea(child);
      if (area > 0) {
        holeAreaByContour.set(candidate, (holeAreaByContour.get(candidate) || 0) + area);
      }
    }
  }

  return { outerContours: outer, holeCountByContour, holeAreaByContour };
}

function bboxArea(b: Bounds): number {
  return Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxY - b.minY);
}

/** ¿El bounding box `inner` cabe completamente dentro de `outer`? */
function contains(outer: Bounds, inner: Bounds): boolean {
  const margin = POINT_TOLERANCE;
  return (
    inner.minX >= outer.minX - margin &&
    inner.maxX <= outer.maxX + margin &&
    inner.minY >= outer.minY - margin &&
    inner.maxY <= outer.maxY + margin &&
    // Evita que un contorno se contenga "a sí mismo" cuando dos piezas
    // tienen exactamente el mismo tamaño y se comparan entre sí.
    (inner.minX > outer.minX + margin ||
      inner.maxX < outer.maxX - margin ||
      inner.minY > outer.minY + margin ||
      inner.maxY < outer.maxY - margin)
  );
}

/** Área real del contorno si es una única polilínea cerrada; si no, se
 * aproxima con el área del bounding box (simplificación razonable para
 * detalles internos formados por línea+arco combinados). */
function contourArea(c: Contour): number {
  if (c.isSingleClosedPolyline) {
    return Math.abs(shoelace(c.members[0].points));
  }
  return bboxArea(c.bounds);
}

function shoelace(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

// ---------------------------------------------------------------------------
// Paso 4: asignar círculos (agujeros) a la pieza que los contiene
// ---------------------------------------------------------------------------

function assignCirclesToContours(
  circles: CircleEntity[],
  outerContours: Contour[],
  holeCountByContour: Map<Contour, number>,
  holeAreaByContour: Map<Contour, number>,
): void {
  for (const circle of circles) {
    const parent = outerContours.find((c) => pointInBounds(circle.center, c.bounds));
    if (!parent) continue; // círculo fuera de cualquier pieza detectada: se ignora

    holeCountByContour.set(parent, (holeCountByContour.get(parent) || 0) + 1);
    const r = circle.entity.r || 0;
    holeAreaByContour.set(parent, (holeAreaByContour.get(parent) || 0) + Math.PI * r * r);

    // Se guarda temporalmente en el propio objeto de círculo para poder
    // incluirlo luego en las entidades dibujables de la pieza.
    (parent as any)._extraCircles = (parent as any)._extraCircles || [];
    (parent as any)._extraCircles.push(circle.entity);
  }
}

function pointInBounds(p: Point, b: Bounds): boolean {
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;
}

// ---------------------------------------------------------------------------
// Paso 5: construir la pieza final (normalizada a su propio origen)
// ---------------------------------------------------------------------------

function buildPiece(
  contour: Contour,
  holeCountByContour: Map<Contour, number>,
  holeAreaByContour: Map<Contour, number>,
): DxfPiece {
  const { minX, minY, maxX, maxY } = contour.bounds;
  const width = maxX - minX;
  const height = maxY - minY;

  const ownEntities = contour.members.map((m) => normalize(m.entity, minX, minY));
  const extraCircles: DrawEntity[] = ((contour as any)._extraCircles || []).map((e: DrawEntity) =>
    normalize(e, minX, minY),
  );

  const outerArea = contourArea(contour);
  const holesArea = holeAreaByContour.get(contour) || 0;
  const netArea = Math.max(0, outerArea - holesArea);

  return {
    id: `pieza-${Math.round(minX)}-${Math.round(minY)}`,
    width: round2(width),
    height: round2(height),
    holes: holeCountByContour.get(contour) || 0,
    count: 1,
    area: round2(netArea),
    entities: [...ownEntities, ...extraCircles],
  };
}

function normalize(e: DrawEntity, minX: number, minY: number): DrawEntity {
  switch (e.kind) {
    case 'circle':
      return { kind: 'circle', cx: e.cx! - minX, cy: e.cy! - minY, r: e.r };
    case 'arc':
      return { kind: 'arc', cx: e.cx! - minX, cy: e.cy! - minY, r: e.r, start: e.start, end: e.end };
    case 'polyline':
      return {
        kind: 'polyline',
        points: e.points!.map((p) => ({ x: p.x - minX, y: p.y - minY })),
        closed: e.closed,
      };
    case 'line':
      return { kind: 'line', x1: e.x1! - minX, y1: e.y1! - minY, x2: e.x2! - minX, y2: e.y2! - minY };
    default:
      return e;
  }
}

function round2(n: number): number {
  return parseFloat(n.toFixed(2));
}

/**
 * Fusiona piezas con la misma geometría (ancho, alto y cantidad de
 * agujeros) en una sola fila, sumando su cantidad.
 */
function mergeDuplicates(pieces: DxfPiece[]): DxfPiece[] {
  const map = new Map<string, DxfPiece>();

  for (const p of pieces) {
    const key = `${p.width.toFixed(1)}x${p.height.toFixed(1)}-${p.holes}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { ...p });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.width * b.height - a.width * a.height);
}

// ---------------------------------------------------------------------------
// Layout completo (todas las entidades juntas, para la página final)
// ---------------------------------------------------------------------------

function buildLayout(allEntities: DrawEntity[]): DxfLayout {
  const points: Point[] = [];
  for (const e of allEntities) {
    switch (e.kind) {
      case 'circle':
        points.push({ x: e.cx! - e.r!, y: e.cy! - e.r! }, { x: e.cx! + e.r!, y: e.cy! + e.r! });
        break;
      case 'arc':
        points.push({ x: e.cx! - e.r!, y: e.cy! - e.r! }, { x: e.cx! + e.r!, y: e.cy! + e.r! });
        break;
      case 'polyline':
        points.push(...e.points!);
        break;
      case 'line':
        points.push({ x: e.x1!, y: e.y1! }, { x: e.x2!, y: e.y2! });
        break;
    }
  }

  if (points.length === 0) return { entities: [], width: 0, height: 0 };

  const bounds = boundsOf(points);
  const normalized = allEntities.map((e) => normalize(e, bounds.minX, bounds.minY));

  return {
    entities: normalized,
    width: round2(bounds.maxX - bounds.minX),
    height: round2(bounds.maxY - bounds.minY),
  };
}