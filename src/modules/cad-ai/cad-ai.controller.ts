import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { CadAiService } from "./cad-ai.service"
import type { PlanGeometry, Entity } from "./types/entity.types"

@Controller("cad-ai")
export class CadAiController {

  constructor(private readonly service: CadAiService) {}

  @Post("analyze")
  @UseInterceptors(FileInterceptor("image", {
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async analyze(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("No image file provided")

    const allowed = ["image/png", "image/jpeg", "image/webp", "image/bmp"]
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException("Invalid image format")
    }

    const imageBase64 = file.buffer.toString("base64")
    return this.service.analyze(imageBase64, file.mimetype)
  }

  @Post("iterate")
  async iterate(
    @Body() body: { geometry: PlanGeometry; feedback: string; selectedEntities?: Entity[] },
  ) {
    if (!body.geometry || !body.feedback) {
      throw new BadRequestException("Missing geometry or feedback")
    }
    return this.service.iterate(body.geometry, body.feedback, body.selectedEntities)
  }

  @Post("generate")
  async generate(@Body() body: { prompt: string }) {
    if (!body.prompt) throw new BadRequestException("Missing prompt")
    return this.service.generate(body.prompt)
  }

  @Post("export-dxf")
  async exportDxf(@Body() body: { geometry: PlanGeometry }) {
    if (!body.geometry) throw new BadRequestException("Missing geometry")
    return { dxf: this.service.exportDxf(body.geometry) }
  }

  @Get("skills")
  async listSkills() {
    return this.service.listSkills()
  }

  @Post("skills")
  async createSkill(@Body() body: {
    name: string
    description?: string
    geometry: PlanGeometry
    thumbnailPath?: string
  }) {
    return this.service.createSkill(body)
  }

  @Get("skills/:id")
  async getSkill(@Param("id") id: string) {
    return this.service.getSkill(Number(id))
  }

  @Delete("skills/:id")
  async deleteSkill(@Param("id") id: string) {
    await this.service.deleteSkill(Number(id))
    return { success: true }
  }

  @Post("skills/:id/generate")
  async generateFromSkill(
    @Param("id") id: string,
    @Body() params: Record<string, number | string>,
  ) {
    return this.service.generateFromSkill(Number(id), params)
  }

}
