import { SetMetadata } from "@nestjs/common"
import { JobLevel } from "@prisma/client"

export const LEVELS_KEY = "levels"

export const Levels = (...levels: JobLevel[]) =>
  SetMetadata(LEVELS_KEY, levels)