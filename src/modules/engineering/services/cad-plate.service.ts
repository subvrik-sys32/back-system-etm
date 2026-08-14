import { BadRequestException, Injectable } from '@nestjs/common'
import {
  generatePlate,
  type PlateGeneratorInput,
  type PlateHolesInput,
} from '../cad/generators/plate-generator'
import type { GeometryModel } from '../cad/model/geometry-model'
import {
  exportGeometryToDxf,
  exportGeometryToDxfBuffer,
} from '../cad/exporters/dxf/dxf-exporter'

export type CreatePlateDto = {
  width: number
  height: number
  holes?: {
    diameter: number
    offset: number
  }
}

@Injectable()
export class CadPlateService {
  buildModel(dto: CreatePlateDto): GeometryModel {
    this.assertDto(dto)
    const input: PlateGeneratorInput = {
      width: dto.width,
      height: dto.height,
    }
    if (dto.holes) {
      const holes: PlateHolesInput = {
        diameter: dto.holes.diameter,
        offset: dto.holes.offset,
      }
      input.holes = holes
    }
    try {
      return generatePlate(input)
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid plate parameters',
      )
    }
  }

  buildDxf(dto: CreatePlateDto): { text: string; buffer: Buffer; model: GeometryModel } {
    const model = this.buildModel(dto)
    const text = exportGeometryToDxf(model)
    const buffer = exportGeometryToDxfBuffer(model)
    return { text, buffer, model }
  }

  private assertDto(dto: CreatePlateDto): void {
    if (dto == null || typeof dto !== 'object') {
      throw new BadRequestException('Body is required')
    }
    if (typeof dto.width !== 'number' || typeof dto.height !== 'number') {
      throw new BadRequestException('width and height must be numbers')
    }
    if (dto.holes != null) {
      if (
        typeof dto.holes.diameter !== 'number' ||
        typeof dto.holes.offset !== 'number'
      ) {
        throw new BadRequestException(
          'holes.diameter and holes.offset must be numbers',
        )
      }
    }
  }
}
