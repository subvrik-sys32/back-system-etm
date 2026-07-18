import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infra/database/prisma/prisma.service';
import { EngineeringParserService } from './engineering-parser.service';
import { SupabaseStorageService } from '../../../infra/storage/supabase-storage.service';

const ENGINEERING_BUCKET = 'engineering-files';

@Injectable()
export class EngineeringPipelineService {
  private readonly logger = new Logger(EngineeringPipelineService.name);

  constructor(
    private parser: EngineeringParserService,
    private storage: SupabaseStorageService,
    private prisma: PrismaService,
  ) {}

  async run(id: string, buffer: Buffer): Promise<void> {
    try {
      // Guardamos el DXF original en Supabase Storage — antes iba a
      // disco local (process.cwd()/uploads/engineering), que Render
      // BORRA en cada redeploy. Los archivos ya subidos quedaban
      // huérfanos (la base seguía apuntando a un archivo que ya no
      // existía) apenas se hacía el próximo deploy.
      await this.storage.uploadFile(
        ENGINEERING_BUCKET,
        `${id}.dxf`,
        buffer,
        'application/dxf',
      );

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