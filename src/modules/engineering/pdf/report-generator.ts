/**
 * report-generator.ts
 *
 * Genera el PDF de "Reporte técnico de producción DXF" con pdfkit,
 * usando el formato de tarjeta individual por pieza (dibujo grande a
 * la izquierda + tabla de datos a la derecha), inspirado en el layout
 * de "Información pieza individual" de TruTops Boost.
 *
 * Campos derivables solo de la geometría del DXF:
 *   No. de pieza, Dimensión, Superficie (área neta), Agujeros, Cantidad
 *
 * Campos que NO se pueden derivar de un DXF (requieren datos externos
 * de negocio/ERP) y por eso son opcionales vía `meta.pieceInfo`:
 *   Nombre del plano, Cliente, Peso, Duración, Fichero de piezas
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

import { DxfGeometryResult, DxfPiece, DrawEntity, DxfLayout } from './dxf-geometry-parser';

export interface PieceExtraInfo {
  /** Nombre de plano/pieza legible para mostrar en la tarjeta (opcional). */
  nombre?: string;
  cliente?: string;
  /** kg, ya calculado externamente (área × espesor × densidad). */
  peso?: number;
  /** texto libre, ej. "00:01:25" */
  duracion?: string;
  ficheroPiezas?: string;
}

export interface ReportMeta {
  proyecto?: string;
  lote?: string;
  material?: string;
  espesor?: string;
  revision?: string;
  /**
   * Info adicional por pieza, indexada por el mismo `id` que genera
   * `parseDxfGeometry` (formato `pieza-{minX}-{minY}`). Si no se
   * provee, la tarjeta simplemente omite esos campos.
   */
  pieceInfo?: Record<string, PieceExtraInfo>;
}

const PAGE_MARGIN = 40;
const CONTENT_WIDTH = 515;
const CONTENT_BOTTOM = 780;

const CARD_HEIGHT = 155;
const CARD_GAP = 10;
const CARD_THUMB_WIDTH = 230;
const CARD_PADDING = 10;

const COLORS = {
  headerBg: '#1e1e24',
  headerTitle: '#ffffff',
  headerSubtitle: '#a0aec0',
  labelGray: '#4a5568',
  valueDark: '#1a202c',
  rule: '#e2e8f0',
  cardBorder: '#cbd5e0',
  cardLabelBg: '#f7fafc',
  drawingStroke: '#2d3748',
  layoutStroke: '#1a202c',
  footerText: '#718096',
};

export function generatePdfReportInMemory(
  result: DxfGeometryResult,
  meta: ReportMeta = {},
): Promise<Buffer> {
  const { pieces, layout } = result;

  return new Promise((resolve, reject) => {
    try {
      // bufferPages: true permite recorrer todas las páginas al final
      // para dibujar el pie de página incluso en las que se crean por
      // salto automático dentro de drawPieceCards.
      const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('error', (err: Error) => reject(err));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      drawHeader(doc);
      drawGeneralInfo(doc, meta, pieces);
      drawPieceCards(doc, pieces, meta);

      if (layout.entities.length > 0) {
        doc.addPage();
        drawLayoutPage(doc, layout);
      }

      drawFootersOnAllPages(doc);

      doc.end();
    } catch (err) {
      reject(err as Error);
    }
  });
}

// ---------------------------------------------------------------------------
// Cabecera + información general
// ---------------------------------------------------------------------------

function drawHeader(doc: any): void {
  doc.rect(PAGE_MARGIN, 40, CONTENT_WIDTH, 65).fill(COLORS.headerBg);

  doc
    .fillColor(COLORS.headerTitle)
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('REPORTE TÉCNICO DE PRODUCCIÓN DXF', 55, 53);

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(COLORS.headerSubtitle)
    .text('MÓDULO DE INGENIERÍA - SISTEMA ERP', 55, 75);
}

function drawGeneralInfo(doc: any, meta: ReportMeta, pieces: DxfPiece[]): number {
  doc.fillColor('#000000');
  doc.fontSize(11).font('Helvetica-Bold').text('Información General', PAGE_MARGIN, 130);
  doc.moveTo(PAGE_MARGIN, 145).lineTo(555, 145).strokeColor(COLORS.rule).lineWidth(1).stroke();

  const totalPiezas = pieces.reduce((sum, p) => sum + p.count, 0);

  const rows: [string, string][] = [
    ['Proyecto de Referencia:', meta.proyecto || 'Proyecto No Especificado'],
    ['Lote / Identificador:', meta.lote || 'Lote Único'],
    ['Material (código):', meta.material || '—'],
    ['Espesor:', meta.espesor || '—'],
    ['Piezas detectadas (geometría):', String(totalPiezas)],
    ['Tipos de pieza distintos:', String(pieces.length)],
  ];

  let y = 160;
  for (const [label, value] of rows) {
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.labelGray).text(label, PAGE_MARGIN, y);
    doc.font('Helvetica-Bold').fillColor(COLORS.valueDark).text(value, 220, y);
    y += 16;
  }

  return y + 10;
}

// ---------------------------------------------------------------------------
// Tarjetas individuales por pieza
// ---------------------------------------------------------------------------

function drawPieceCards(doc: any, pieces: DxfPiece[], meta: ReportMeta): void {
  let y = 260;

  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text('Información pieza individual', PAGE_MARGIN, y);
  y += 20;

  if (pieces.length === 0) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.labelGray)
      .text('No se logró extraer perfiles válidos del plano.', PAGE_MARGIN, y);
    return;
  }

  pieces.forEach((piece, index) => {
    if (y + CARD_HEIGHT > CONTENT_BOTTOM) {
      doc.addPage();
      y = 40;
    }
    drawSingleCard(doc, piece, index + 1, y, meta.pieceInfo?.[piece.id]);
    y += CARD_HEIGHT + CARD_GAP;
  });
}

function drawSingleCard(
  doc: any,
  piece: DxfPiece,
  pieceNumber: number,
  y: number,
  extra?: PieceExtraInfo,
): void {
  const cardX = PAGE_MARGIN;
  const cardW = CONTENT_WIDTH;

  // Marco de la tarjeta
  doc.rect(cardX, y, cardW, CARD_HEIGHT).strokeColor(COLORS.cardBorder).lineWidth(1).stroke();

  // Divisor vertical entre dibujo y datos
  const dividerX = cardX + CARD_THUMB_WIDTH;
  doc.moveTo(dividerX, y).lineTo(dividerX, y + CARD_HEIGHT).strokeColor(COLORS.cardBorder).stroke();

  // Dibujo de la pieza (columna izquierda)
  drawPieceThumbnail(doc, piece, {
    x: cardX + CARD_PADDING,
    y: y + CARD_PADDING,
    w: CARD_THUMB_WIDTH - CARD_PADDING * 2,
    h: CARD_HEIGHT - CARD_PADDING * 2,
  });

  // Tabla de datos (columna derecha)
  const rows: [string, string][] = [
    ['No. de pieza:', String(pieceNumber)],
    ['Nombre del plano:', extra?.nombre || '—'],
    ['Cliente:', extra?.cliente || '—'],
    ['Cantidad:', String(piece.count)],
    ['Dimensión:', `${piece.width.toFixed(1)}mm x ${piece.height.toFixed(1)}mm`],
    ['Superficie:', `${piece.area.toLocaleString('en-US')}mm²`],
    ['Agujeros:', String(piece.holes)],
  ];
  if (extra?.peso !== undefined) rows.push(['Peso:', `${extra.peso.toFixed(3)}kg`]);
  if (extra?.duracion) rows.push(['Duración:', extra.duracion]);
  if (extra?.ficheroPiezas) rows.push(['Fichero piezas:', extra.ficheroPiezas]);

  const rowH = (CARD_HEIGHT - CARD_PADDING * 2) / rows.length;
  const labelX = dividerX + CARD_PADDING;
  const valueX = dividerX + 120;
  const valueW = cardX + cardW - valueX - CARD_PADDING;

  rows.forEach(([label, value], i) => {
    const rowY = y + CARD_PADDING + i * rowH;

    if (i % 2 === 0) {
      doc.rect(dividerX, rowY, cardW - CARD_THUMB_WIDTH, rowH).fill(COLORS.cardLabelBg);
    }

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.labelGray)
      .text(label, labelX, rowY + rowH / 2 - 5, { width: 105 });

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COLORS.valueDark)
      .text(value, valueX, rowY + rowH / 2 - 5, { width: valueW });
  });
}

// ---------------------------------------------------------------------------
// Página de layout total anidado
// ---------------------------------------------------------------------------

function drawLayoutPage(doc: any, layout: DxfLayout): void {
  doc
    .fontSize(14)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text('Layout total de corte (anidado)', PAGE_MARGIN, 40);

  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor(COLORS.footerText)
    .text('Geometría completa del archivo DXF cargado.', PAGE_MARGIN, 62);

  const box = { x: PAGE_MARGIN, y: 90, w: CONTENT_WIDTH, h: 690 };
  drawEntitiesFitted(
  doc,
  layout.entities,
  layout.width,
  layout.height,
  box,
  0.5,
);
}

// ---------------------------------------------------------------------------
// Dibujo vectorial
// ---------------------------------------------------------------------------

function drawPieceThumbnail(
  doc: any,
  piece: DxfPiece,
  box: { x: number; y: number; w: number; h: number },
): void {
  if (!piece.entities.length || piece.width <= 0 || piece.height <= 0) return;
  drawEntitiesFitted(
  doc,
  piece.entities,
  piece.width,
  piece.height,
  box,
  0.7,
);
}

function drawEntitiesFitted(
  doc: any,
  entities: DrawEntity[],
  sourceWidth: number,
  sourceHeight: number,
  box: {
    x: number
    y: number
    w: number
    h: number
  },
  lineWidth: number,
): void {
  if (sourceWidth <= 0 || sourceHeight <= 0 || entities.length === 0) return;

  const scale = Math.min(box.w / sourceWidth, box.h / sourceHeight);
  const drawW = sourceWidth * scale;
  const drawH = sourceHeight * scale;
  const originX = box.x + (box.w - drawW) / 2;
  const originY = box.y + (box.h - drawH) / 2;

    doc.save();

    doc.lineWidth(lineWidth);

    drawEntities(
    doc,
    entities,
    originX,
    originY,
    scale,
    sourceHeight,
    );

doc.restore();
}

function drawEntities(
  doc: any,
  entities: DrawEntity[],
  originX: number,
  originY: number,
  scale: number,
  sourceHeight: number,
): void {
  const project = (x: number, y: number) => ({
    x: originX + x * scale,
    y: originY + (sourceHeight - y) * scale,
  });

  const ARC_SEGMENTS = 24;

  for (const e of entities) {
    switch (e.kind) {
      case 'line': {
        const a = project(e.x1!, e.y1!);
        const b = project(e.x2!, e.y2!);
        doc.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke();
        break;
      }

      case 'polyline': {
        const pts = e.points!.map((p) => project(p.x, p.y));
        if (pts.length < 2) break;
        doc.moveTo(pts[0].x, pts[0].y);
        for (const p of pts.slice(1)) doc.lineTo(p.x, p.y);
        if (e.closed) doc.closePath();
        doc.stroke();
        break;
      }

      case 'circle': {
        const c = project(e.cx!, e.cy!);
        doc.circle(c.x, c.y, e.r! * scale).stroke();
        break;
      }

      case 'arc': {
        let started = false;
        for (let i = 0; i <= ARC_SEGMENTS; i++) {
          const t = e.start! + ((e.end! - e.start!) * i) / ARC_SEGMENTS;
          const px = e.cx! + e.r! * Math.cos(t);
          const py = e.cy! + e.r! * Math.sin(t);
          const p = project(px, py);
          if (!started) {
            doc.moveTo(p.x, p.y);
            started = true;
          } else {
            doc.lineTo(p.x, p.y);
          }
        }
        doc.stroke();
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Pie de página
// ---------------------------------------------------------------------------

function drawFootersOnAllPages(doc: any): void {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc
      .fontSize(8)
      .fillColor(COLORS.footerText)
      .text(
        'Este documento es un reporte generado de manera automática a partir del análisis geométrico del archivo vectorial DXF cargado en el ERP.',
        PAGE_MARGIN,
        800,
        { align: 'center', width: CONTENT_WIDTH },
      );
  }
}