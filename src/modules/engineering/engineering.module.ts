import { Module } from '@nestjs/common';
import { EngineeringFilesController } from './controllers/engineering-files.controller';
import { EngineeringFilesService } from './services/engineering-files.service';
import { EngineeringParserService } from './services/engineering-parser.service';
import { EngineeringPipelineService } from './services/engineering-pipeline.service';
import { LocalStorageService } from './storage/local-storage.service';
import { DxfReportService } from './pdf/dxf-report.service'; // Importa el nuevo servicio

@Module({
  controllers: [EngineeringFilesController],
  providers: [
    EngineeringFilesService,
    EngineeringParserService,
    EngineeringPipelineService,
    LocalStorageService,
    DxfReportService, // Registra el nuevo servicio
  ],
  exports: [DxfReportService], // Exporta si lo usarás en otros módulos
})
export class EngineeringModule {}