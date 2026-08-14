import type { LengthUnit } from './geometry-model'
import type { PartFeature } from './part-feature'
import type { PartParameter } from './part-parameter'

/**
 * Descripción paramétrica de una pieza industrial.
 * Aún no implica geometría: los generators convierten esto (o un DTO
 * más simple) en GeometryModel.
 */
export type PartDefinition = {
  id: string
  name: string
  units: LengthUnit
  material?: string
  thickness?: number
  parameters: PartParameter[]
  features: PartFeature[]
}
