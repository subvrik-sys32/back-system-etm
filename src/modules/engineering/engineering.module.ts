import { Module } from '@nestjs/common';
import { EngineeringFilesController } from './controllers/engineering-files.controller';
import { EngineeringFilesService } from './services/engineering-files.service';
import { EngineeringParserService } from './services/engineering-parser.service';
import { EngineeringPipelineService } from './services/engineering-pipeline.service';
import { LocalStorageService } from './storage/local-storage.service';

@Module({
  controllers: [EngineeringFilesController],
  providers: [
    EngineeringFilesService,
    EngineeringParserService,
    EngineeringPipelineService,
    LocalStorageService,
  ],
})
export class EngineeringModule {}