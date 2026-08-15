import { Module } from '@nestjs/common'
import { EngineeringFilesController } from './controllers/engineering-files.controller'
import { NestingProjectsController } from './controllers/nesting-projects.controller'
import { CadPlateController } from './controllers/cad-plate.controller'
import { NestingRunController } from './controllers/nesting-run.controller'
import { EngineeringFilesService } from './services/engineering-files.service'
import { EngineeringParserService } from './services/engineering-parser.service'
import { EngineeringPipelineService } from './services/engineering-pipeline.service'
import { CadPlateService } from './services/cad-plate.service'
import { NestingRunService } from './services/nesting-run.service'
import { NestingJobService } from './services/nesting-job.service'
import { CadParseService } from './services/cad-parse.service'
import { DxfReportService } from './pdf/dxf-report.service'

@Module({
  controllers: [
    EngineeringFilesController,
    NestingProjectsController,
    CadPlateController,
    NestingRunController,
  ],
  providers: [
    EngineeringFilesService,
    EngineeringParserService,
    EngineeringPipelineService,
    CadPlateService,
    NestingRunService,
    NestingJobService,
    CadParseService,
    DxfReportService,
  ],
  exports: [
    DxfReportService,
    EngineeringFilesService,
    CadPlateService,
    NestingRunService,
    NestingJobService,
    CadParseService,
  ],
})
export class EngineeringModule {}
