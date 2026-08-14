import { Module } from '@nestjs/common';
import { EngineeringFilesController } from './controllers/engineering-files.controller';
import { NestingProjectsController } from './controllers/nesting-projects.controller';
import { CadPlateController } from './controllers/cad-plate.controller';
import { EngineeringFilesService } from './services/engineering-files.service';
import { EngineeringParserService } from './services/engineering-parser.service';
import { EngineeringPipelineService } from './services/engineering-pipeline.service';
import { CadPlateService } from './services/cad-plate.service';
import { DxfReportService } from './pdf/dxf-report.service';

@Module({
  controllers: [
    EngineeringFilesController,
    NestingProjectsController,
    CadPlateController,
  ],
  providers: [
    EngineeringFilesService,
    EngineeringParserService,
    EngineeringPipelineService,
    CadPlateService,
    DxfReportService,
  ],
  exports: [DxfReportService, EngineeringFilesService, CadPlateService],
})
export class EngineeringModule {}
