import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Res,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  NotFoundException,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Readable } from 'stream';
import { EngineeringFilesService } from '../services/engineering-files.service';
import { DxfReportService } from '../pdf/dxf-report.service';
import type { ReportMeta } from '../pdf/report-generator';

interface MultipartFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('engineering/files')
export class EngineeringFilesController {
  constructor(
    private readonly service: EngineeringFilesService,
    private readonly reportService: DxfReportService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 10 })],
        fileIsRequired: true,
      }),
    )
    file: MultipartFile,
  ) {
    return this.service.upload(file);
  }

  @Get()
  async list() {
    return this.service.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/raw')
  async getRaw(@Param('id') id: string, @Res() res: Response) {
    try {
      const buffer = await this.service.getRawDxf(id);
      res.setHeader('Content-Type', 'application/dxf');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(buffer);
    } catch (err) {
      if (err instanceof NotFoundException) {
        res.status(404).json({ message: err.message });
        return;
      }
      res.status(500).json({ message: 'Error al obtener el archivo' });
    }
  }

  @Get(':id/report')
  async generateReport(
    @Param('id') id: string,
    @Query() query: ReportMeta,
    @Query('download') download: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.service.getRawDxf(id);
    if (!buffer) {
      throw new NotFoundException(`No se encontró el archivo DXF con ID: ${id}`);
    }

    const pdfBuffer = await this.reportService.process(buffer, query);

    const disposition = download === 'true' ? 'attachment' : 'inline';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="reporte_${id}.pdf"`,
    });

    return new StreamableFile(Readable.from(pdfBuffer));
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}