import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  NestingRunService,
  type NestRunRequest,
} from '../services/nesting-run.service'
import { NestingJobService } from '../services/nesting-job.service'
import { CadParseService } from '../services/cad-parse.service'

@Controller('engineering')
export class NestingRunController {
  constructor(
    private readonly nesting: NestingRunService,
    private readonly jobs: NestingJobService,
    private readonly cadParse: CadParseService,
  ) {}

  /** DXF | GEO | PDF → NestingPiece[] (parser rico). */
  @Post('cad/parse')
  @UseInterceptors(FileInterceptor('file'))
  async parseCad(
    @UploadedFile() file?: { buffer: Buffer; originalname?: string },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file required')
    }
    return this.cadParse.parseUpload(file.originalname || 'upload.dxf', file.buffer)
  }

  /** Compat. */
  @Post('cad/parse-dxf')
  @UseInterceptors(FileInterceptor('file'))
  async parseDxf(
    @UploadedFile() file?: { buffer: Buffer; originalname?: string },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file required')
    }
    return this.cadParse.parseUpload(
      file.originalname || 'upload.dxf',
      file.buffer,
    )
  }
}

