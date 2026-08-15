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

  /** Sync nest (compat). */
  @Post('nest')
  @UsePipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: false,
    }),
  )
  run(@Body() body: NestRunRequest) {
    return this.nesting.run(body)
  }

  /** Async job. */
  @Post('nest/jobs')
  @UsePipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: false,
    }),
  )
  createJob(@Body() body: NestRunRequest) {
    return this.jobs.create(body)
  }

  @Get('nest/jobs/:id')
  getJob(@Param('id') id: string) {
    return this.jobs.get(id)
  }

  @Post('nest/jobs/:id/cancel')
  cancelJob(@Param('id') id: string) {
    return this.jobs.cancel(id)
  }

  /** DXF | GEO → NestingPiece[] (multi-pieza DXF). PDF se parsea en el cliente. */
  @Post('cad/parse')
  @UseInterceptors(FileInterceptor('file'))
  async parseCad(
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
