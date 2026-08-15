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

  /** Sync (compat). */
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

  /** Async: devuelve jobId; poll GET nest/jobs/:id */
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

  /**
   * Primer escalón CAD-on-back: DXF → NestingPiece[].
   * multipart field "file".
   */
  @Post('cad/parse-dxf')
  @UseInterceptors(FileInterceptor('file'))
  parseDxf(@UploadedFile() file?: { buffer: Buffer; originalname?: string }) {
    if (!file?.buffer?.length) {
      return { error: 'file required' }
    }
    return this.cadParse.parseDxfBuffer(file.buffer, file.originalname || 'upload.dxf')
  }
}
