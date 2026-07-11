import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infra/database/prisma/prisma.service';
import { EngineeringParserService } from './engineering-parser.service';
import { LocalStorageService } from '../storage/local-storage.service';

@Injectable()
export class EngineeringPipelineService {
  private readonly logger = new Logger(EngineeringPipelineService.name);

  constructor(
    private parser: EngineeringParserService,
    private storage: LocalStorageService,
    private prisma: PrismaService,
  ) {}

  async run(id: string, buffer: Buffer): Promise<void> {
    try {
      // Guardamos el DXF original: el frontend lo va a renderizar tal cual
      await this.storage.save(`${id}.dxf`, buffer);

      const metadata = await this.parser.extractMetadata(buffer);

      await this.prisma.engineeringFile.update({
        where: { id },
        data: {
          status: 'READY',
          metadata: metadata as any,
        },
      });
    } catch (err) {
      this.logger.error(`Fallo al procesar archivo ${id}`, (err as Error).stack);
      await this.prisma.engineeringFile.update({
        where: { id },
        data: {
          status: 'FAILED',
          metadata: { error: (err as Error).message } as any,
        },
      });
    }
  }
}