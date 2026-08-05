import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

export type NestingProjectMeta = {
  type: 'nesting-project';
  name: string;
  formatVersion: number;
  pieceCount: number;
  sheetCount: number;
  hasNesting: boolean;
};

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
    if (!file) throw new NotFoundException(`Archivo con id ${id} no encontrado`);
    return file;
  }

  async getRawDxf(id: string): Promise<Buffer> {
    await this.findOne(id);
    return this.storage.downloadFile(ENGINEERING_BUCKET, `${id}.dxf`);
  }

  async remove(id: string) {
    const file = await this.findOne(id);
    const storageName = file.extension === 'json' ? `${id}.json` : `${id}.dxf`;
    try {
      await this.storage.deleteFile(ENGINEERING_BUCKET, storageName);
    } catch { /* ignore */ }
    return this.prisma.engineeringFile.delete({ where: { id } });
  }

  async listNestingProjects() {
    return this.prisma.engineeringFile.findMany({
      where: { extension: 'json' },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async saveNestingProject(body: {
    name?: string;
    project: Record<string, unknown>;
    id?: string;
  }) {
    const project = body.project;
    if (!project || typeof project !== 'object') {
      throw new BadRequestException('Falta el cuerpo `project`.');
    }
    const formatVersion = Number(project.formatVersion ?? 0);
    if (formatVersion !== 1 && formatVersion !== 2) {
      throw new BadRequestException(
        `formatVersion no soportado (${formatVersion}). Use 1 o 2.`,
      );
    }

    const name =
      (body.name?.trim() ||
        (typeof project.name === 'string' ? project.name.trim() : '') ||
        'Proyecto nesting') + '';

    const pieces = Array.isArray(project.pieces) ? project.pieces : [];
    const sheets = Array.isArray(project.sheets) ? project.sheets : [];
    const rows = Array.isArray(project.rows) ? project.rows : pieces;

    const meta: NestingProjectMeta = {
      type: 'nesting-project',
      name,
      formatVersion,
      pieceCount: rows.length,
      sheetCount: sheets.length,
      hasNesting: sheets.length > 0,
    };

    const json = JSON.stringify(project);
    const buffer = Buffer.from(json, 'utf8');

    if (body.id) {
      const existing = await this.findOne(body.id);
      if (existing.extension !== 'json') {
        throw new BadRequestException('El id no corresponde a un proyecto de nesting.');
      }
      await this.storage.uploadFile(
        ENGINEERING_BUCKET,
        `${body.id}.json`,
        buffer,
        'application/json',
      );
      return this.prisma.engineeringFile.update({
        where: { id: body.id },
        data: {
          originalName: `${name}.json`,
          filename: `${Date.now()}-${name}.json`,
          size: buffer.length,
          status: 'READY',
          metadata: meta,
        },
      });
    }

    const record = await this.prisma.engineeringFile.create({
      data: {
        originalName: `${name}.json`,
        filename: `${Date.now()}-${name}.json`,
        extension: 'json',
        mimeType: 'application/json',
        size: buffer.length,
        status: 'READY',
        metadata: meta,
      },
    });

    await this.storage.uploadFile(
      ENGINEERING_BUCKET,
      `${record.id}.json`,
      buffer,
      'application/json',
    );

    return record;
  }

  async getNestingProjectJson(id: string): Promise<object> {
    const file = await this.findOne(id);
    if (file.extension !== 'json') {
      throw new BadRequestException('El archivo no es un proyecto de nesting JSON.');
    }
    const buffer = await this.storage.downloadFile(ENGINEERING_BUCKET, `${id}.json`);
    try {
      return JSON.parse(buffer.toString('utf8')) as object;
    } catch {
      throw new BadRequestException('El JSON del proyecto está corrupto.');
    }
  }
}
