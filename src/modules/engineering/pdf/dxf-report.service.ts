import { Injectable, Logger } from '@nestjs/common';
import DxfParser from 'dxf-parser';
import { parseDxfGeometry } from './dxf-geometry-parser';
import { generatePdfReportInMemory, ReportMeta } from './report-generator';

@Injectable()
export class DxfReportService {
  private readonly logger = new Logger(DxfReportService.name);

  /**
   * Parsea el DXF y genera el PDF de reporte técnico en memoria.
   * @param fileBuffer contenido crudo del archivo .dxf
   * @param meta metadatos externos (proyecto, lote, etc.) que no se
   *             pueden derivar de la geometría del archivo
   */
  async process(fileBuffer: Buffer, meta: ReportMeta): Promise<Buffer> {
    const parser = new DxfParser();
    const dxf = parser.parseSync(fileBuffer.toString('utf-8'));
    const entities: any[] = dxf?.entities ?? [];

    if (entities.length === 0) {
      this.logger.warn('El DXF no contiene entidades parseables.');
    }

    const geometry = parseDxfGeometry(entities);
    return generatePdfReportInMemory(geometry, meta);
  }
}