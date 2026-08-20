import { Injectable, BadRequestException } from "@nestjs/common"
import { OpenaiVisionService } from "./services/openai-vision.service"
import { DxfGeneratorService } from "./services/dxf-generator.service"
import { SkillStorageService } from "./services/skill-storage.service"
import type { PlanGeometry, Entity, Skill } from "./types/entity.types"

@Injectable()
export class CadAiService {

  constructor(
    private readonly vision: OpenaiVisionService,
    private readonly dxfGen: DxfGeneratorService,
    private readonly skills: SkillStorageService,
  ) {}

  async analyze(imageBase64: string, mimeType: string): Promise<{
    geometry: PlanGeometry
    dxf: string
  }> {
    const geometry = await this.vision.analyzeImage(imageBase64, mimeType)
    const dxf = this.dxfGen.geometryToDxf(geometry)
    return { geometry, dxf }
  }

  async iterate(geometry: PlanGeometry, feedback: string, selectedEntities?: Entity[]): Promise<{
    geometry: PlanGeometry
    dxf: string
  }> {
    const updated = await this.vision.iterateGeometry(geometry, feedback, selectedEntities)
    const dxf = this.dxfGen.geometryToDxf(updated)
    return { geometry: updated, dxf }
  }

  async generate(prompt: string): Promise<{
    geometry: PlanGeometry
    dxf: string
  }> {
    const geometry = await this.vision.generateFromText(prompt)
    const dxf = this.dxfGen.geometryToDxf(geometry)
    return { geometry, dxf }
  }

  exportDxf(geometry: PlanGeometry): string {
    return this.dxfGen.geometryToDxf(geometry)
  }

  async listSkills(): Promise<Skill[]> {
    return this.skills.listSkills()
  }

  async getSkill(id: number): Promise<Skill> {
    const skill = await this.skills.getSkill(id)
    if (!skill) throw new BadRequestException("Skill not found")
    return skill
  }

  async createSkill(body: {
    name: string
    description?: string
    geometry: PlanGeometry
    thumbnailPath?: string
  }): Promise<Skill> {
    if (!body.name || !body.geometry) {
      throw new BadRequestException("Missing name or geometry")
    }

    const { parameters, template } = await this.vision.extractParameters(body.geometry)

    return this.skills.createSkill(
      body.name,
      body.description || "",
      body.geometry,
      body.thumbnailPath,
      parameters,
      template,
    )
  }

  async deleteSkill(id: number): Promise<void> {
    await this.skills.deleteSkill(id)
  }

  async generateFromSkill(id: number, params: Record<string, number | string>): Promise<{
    geometry: PlanGeometry
    dxf: string
  }> {
    const skill = await this.getSkill(id)
    const geometry = this.skills.applyParameters(skill.template, skill.parameters, params)
    const dxf = this.dxfGen.geometryToDxf(geometry)
    return { geometry, dxf }
  }

}
