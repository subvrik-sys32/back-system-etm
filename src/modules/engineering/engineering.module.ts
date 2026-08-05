import { Module } from '@nestjs/common';
import { EngineeringFilesController } from './controllers/engineering-files.controller';
import { NestingProjectsController } from './controllers/nesting-projects.controller';
import { EngineeringFilesService } from './services/engineering-files.service';
import { EngineeringParserService } from './services/engineering-parser.service';
import { EngineeringPipelineService } from './services/engineering-pipeline.service';
import { DxfReportService } from './pdf/dxf-report.service';

@Module({
  controllers: [EngineeringFilesController, NestingProjectsController],
  providers: [
    EngineeringFilesService,
    EngineeringParserService,
    EngineeringPipelineService,
    DxfReportService,
  ],
  exports: [DxfReportService, EngineeringFilesService],
})
export class EngineeringModule {}
