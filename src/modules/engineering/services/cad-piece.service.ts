import { BadRequestException, Injectable } from '@nestjs/common'
import {
  generateTira,
  type TiraGeneratorInput,
} from '../cad/generators/tira-generator'
import { exportGeometryToDxf } from '../cad/exporters/dxf/dxf-exporter'
import { geometryModelToNestingPiece } from '../cad/adapters/geometry-to-nesting-piece'
import type { GeometryModel } from '../cad/model/geometry-model'
import type { NestingPiece } from '../nesting/engine/types'

export type CreateTiraDto = TiraGeneratorInput

@Injectable()
export class CadPieceService {
  buildModel(dto: CreateTiraDto): GeometryModel {
    this.assertDto(dto)
    try {
      return generateTira(dto)
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Invalid tira params',
      )
    }
  }

  buildDxf(dto: CreateTiraDto): string {
    return exportGeometryToDxf(this.buildModel(dto))
  }

  buildNestingPiece(dto: CreateTiraDto): NestingPiece {
    const model = this.buildModel(dto)
    const label =
      dto.name?.trim() ||
      `tira-${dto.length}x${dto.width}`
    return geometryModelToNestingPiece(model, {
      id: `${label}-${Date.now()}`,
      thicknessMm: dto.thicknessMm,
    })
  }

  private assertDto(dto: CreateTiraDto): void {
    if (dto == null || typeof dto !== 'object') {
      throw new BadRequestException('Body is required')
    }
    if (typeof dto.length !== 'number' || typeof dto.width !== 'number') {
      throw new BadRequestException('length and width must be numbers')
    }
  }
}
