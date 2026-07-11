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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { EngineeringFilesService } from '../services/engineering-files.service';

interface MultipartFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('api/engineering/files')
export class EngineeringFilesController {
  constructor(private readonly service: EngineeringFilesService) {}

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

  // Sirve el DXF crudo para que el frontend lo renderice con dxf-viewer
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

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}