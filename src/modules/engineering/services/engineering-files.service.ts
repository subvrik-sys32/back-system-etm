import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/database/prisma/prisma.service';
import { EngineeringPipelineService } from './engineering-pipeline.service';
import { SupabaseStorageService } from '../../../infra/storage/supabase-storage.service';

const ENGINEERING_BUCKET = 'engineering-files';

interface MultipartFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class EngineeringFilesService {
  constructor(
    private prisma: PrismaService,
    private pipeline: EngineeringPipelineService,
    private storage: SupabaseStorageService,
  ) {}

  async upload(file: MultipartFile) {
    const record = await this.prisma.engineeringFile.create({
      data: {
        originalName: file.originalname,
        filename: `${Date.now()}-${file.originalname}`,
        extension: 'dxf',
        mimeType: file.mimetype,
        size: file.size,
        status: 'PROCESSING',
      },
    });

    this.pipeline.run(record.id, file.buffer).catch(() => {});

    return record;
  }

  async findAll() {
    return this.prisma.engineeringFile.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const file = await this.prisma.engineeringFile.findUnique({ where: { id } });
    if (!file) {
      throw new NotFoundException(`Archivo con id ${id} no encontrado`);
    }
    return file;
  }

  async getRawDxf(id: string): Promise<Buffer> {
    await this.findOne(id);
    return this.storage.downloadFile(ENGINEERING_BUCKET, `${id}.dxf`);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.storage.deleteFile(ENGINEERING_BUCKET, `${id}.dxf`);
    return this.prisma.engineeringFile.delete({ where: { id } });
  }
}