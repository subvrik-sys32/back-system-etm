import { Module } from "@nestjs/common"

import { CadAiController } from "./cad-ai.controller"
import { CadAiService } from "./cad-ai.service"
import { OpenaiVisionService } from "./services/openai-vision.service"
import { ImagePreprocessService } from "./services/image-preprocess.service"
import { OpencvProcessService } from "./services/opencv-process.service"
import { DxfGeneratorService } from "./services/dxf-generator.service"
import { SkillStorageService } from "./services/skill-storage.service"

@Module({
  controllers: [CadAiController],
  providers: [
    CadAiService,
    OpenaiVisionService,
    ImagePreprocessService,
    OpencvProcessService,
    DxfGeneratorService,
    SkillStorageService,
  ],
})
export class CadAiModule {}
