import { Injectable, Logger } from "@nestjs/common"
import { SupabaseStorageService } from "@/infra/storage/supabase-storage.service"
import type { Skill, SkillParameter, PlanGeometry } from "../types/entity.types"

const SKILLS_BUCKET = "cad-ai-skills" 
const SKILLS_FILE = "skills.json"

function isNotFoundError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error)
  return (
    /object not found/i.test(msg) ||
    /not found/i.test(msg) ||
    /no such file/i.test(msg) ||
    /404/.test(msg)
  )
}

@Injectable()
export class SkillStorageService {

  private readonly logger = new Logger("SkillStorage")

  private cachedSkills: Skill[] | null = null

  constructor(private readonly storage: SupabaseStorageService) {}

  async listSkills(): Promise<Skill[]> {
    if (this.cachedSkills) return this.cachedSkills

    try {
      const buffer = await this.storage.downloadFile(SKILLS_BUCKET, SKILLS_FILE)
      const text = buffer.toString("utf-8")
      this.cachedSkills = JSON.parse(text) as Skill[]
      return this.cachedSkills
    } catch (error) {
      // Primera ejecución / bucket vacío: no es error fatal.
      if (isNotFoundError(error)) {
        this.logger.warn(
          `${SKILLS_BUCKET}/${SKILLS_FILE} no existe — se inicializa vacío`,
        )
        this.cachedSkills = []
        try {
          await this.persist([])
        } catch (persistError) {
          this.logger.warn(
            "No se pudo crear skills.json inicial (el listado seguirá vacío)",
            persistError,
          )
        }
        return this.cachedSkills
      }

      this.logger.error("Failed to load skills file", error)
      this.cachedSkills = []
      return []
    }
  }

  async getSkill(id: number): Promise<Skill | null> {
    const skills = await this.listSkills()
    return skills.find(s => s.id === id) ?? null
  }

  async createSkill(
    name: string,
    description: string,
    geometry: PlanGeometry,
    thumbnailPath?: string,
    parameters?: SkillParameter[],
    template?: PlanGeometry,
  ): Promise<Skill> {
    const skills = await this.listSkills()
    const now = new Date().toISOString()
    const nextId = skills.length > 0 ? Math.max(...skills.map(s => s.id)) + 1 : 1

    const newSkill: Skill = {
      id: nextId,
      name,
      description: description || "",
      thumbnail: thumbnailPath || null,
      parameters: parameters || [],
      template: template || geometry,
      created_at: now,
      updated_at: now,
    }

    skills.push(newSkill)
    this.cachedSkills = skills
    await this.persist(skills)
    return newSkill
  }

  async deleteSkill(id: number): Promise<void> {
    const skills = await this.listSkills()
    const filtered = skills.filter(s => s.id !== id)
    this.cachedSkills = filtered
    await this.persist(filtered)
  }

  private async persist(skills: Skill[]): Promise<void> {
    const json = JSON.stringify(skills, null, 2)
    const buffer = Buffer.from(json, "utf-8")
    await this.storage.uploadFile(
      SKILLS_BUCKET,
      SKILLS_FILE,
      buffer,
      "application/json",
    )
  }

  applyParameters(
    template: PlanGeometry,
    paramDefs: SkillParameter[],
    values: Record<string, number | string>,
  ): PlanGeometry {
    const templateStr = JSON.stringify(template)

    let resolved = templateStr
    for (const param of paramDefs) {
      const value = values[param.name] ?? param.default
      const placeholder = new RegExp(`\\{\\{${param.name}\\}\\}`, "g")
      resolved = resolved.replace(placeholder, String(value))
    }

    const parsed = JSON.parse(resolved)
    return this.deepNumberify(parsed) as PlanGeometry
  }

  private readonly STRING_FIELDS = new Set([
    "type", "layer", "text", "units", "notes", "material",
    "direction", "name", "label", "coordinateSpace", "description",
  ])

  private deepNumberify(obj: any): any {
    if (obj === null || obj === undefined) return obj
    if (typeof obj === "string") {
      const n = Number(obj)
      return isNaN(n) ? obj : n
    }
    if (typeof obj === "object") {
      if (Array.isArray(obj)) return obj.map(this.deepNumberify.bind(this))
      const result: any = {}
      for (const key of Object.keys(obj)) {
        if (this.STRING_FIELDS.has(key)) {
          result[key] = obj[key]
        } else {
          result[key] = this.deepNumberify(obj[key])
        }
      }
      return result
    }
    return obj
  }

}
