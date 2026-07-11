import { Injectable, Logger } from '@nestjs/common';
import DxfParser from 'dxf-parser';

interface ParsedMetadata {
  version: string;
  entityCount: number;
  layers: string[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
}

@Injectable()
export class EngineeringParserService {
  private readonly logger = new Logger(EngineeringParserService.name);

  async extractMetadata(buffer: Buffer): Promise<ParsedMetadata> {
    const parser = new DxfParser();
    let dxf: any;

    try {
      dxf = parser.parseSync(buffer.toString('utf-8'));
    } catch (err) {
      this.logger.warn(`No se pudo extraer metadata del DXF: ${(err as Error).message}`);
      return { version: 'unknown', entityCount: 0, layers: [], bounds: null };
    }

    if (!dxf) {
      return { version: 'unknown', entityCount: 0, layers: [], bounds: null };
    }

    const layerTable = dxf.tables?.layer?.layers ?? {};
    const entities: any[] = dxf.entities ?? [];

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const entity of entities) {
      const points: { x: number; y: number }[] =
        entity.vertices ?? (entity.center ? [entity.center] : []);
      for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }

    return {
      version: dxf.header?.$ACADVER ?? '1.0',
      entityCount: entities.length,
      layers: Object.keys(layerTable),
      bounds: isFinite(minX) ? { minX, minY, maxX, maxY } : null,
    };
  }
}