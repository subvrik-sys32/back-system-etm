import { BadRequestException, Injectable } from '@nestjs/common'
import {
  generateTira,
  type TiraGeneratorInput,
} from '../cad/generators/tira-generator'
import {
  generateMalla,
  type MallaGeneratorInput,
} from '../cad/generators/malla-generator'
import { generatePlate, type PlateGeneratorInput } from '../cad/generators/plate-generator'
import { exportGeometryToDxf } from '../cad/exporters/dxf/dxf-exporter'
import { geometryModelToNestingPiece } from '../cad/adapters/geometry-to-nesting-piece'
import type { GeometryModel } from '../cad/model/geometry-model'
import type { NestingPiece } from '../nesting/engine/types'

export type CadTemplate = 'tira' | 'malla' | 'plate'

export type CreatePieceDto =
  | ({ template: 'tira' } & TiraGeneratorInput)
  | ({ template: 'malla' } & MallaGeneratorInput)
  | ({ template: 'plate' } & PlateGeneratorInput)
  | (TiraGeneratorInput & { template?: undefined }) // legacy tira sin template

@Injectable()
export class CadPieceService {
  buildModel(dto: CreatePieceDto): GeometryModel {
    if (dto == null || typeof dto !== 'object') {
      throw new BadRequestException('Body is required')
    }
    const template: CadTemplate =
      dto.template === 'malla' || dto.template === 'plate' || dto.template === 'tira'
        ? dto.template
        : 'tira'

    try {
      if (template === 'malla') {
        return generateMalla(dto as MallaGeneratorInput)
      }
      if (template === 'plate') {
        const p = dto as PlateGeneratorInput
        if (typeof p.width !== 'number' || typeof p.height !== 'number') {
          throw new Error('plate requires width and height')
        }
        return generatePlate(p)
      }
      const t = dto as TiraGeneratorInput
      if (typeof t.length !== 'number' || typeof t.width !== 'number') {
        throw new Error('tira requires length and width')
      }
      return generateTira(t)
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Invalid piece params',
      )
    }
  }

  buildDxf(dto: CreatePieceDto): string {
    return exportGeometryToDxf(this.buildModel(dto))
  }

  buildNestingPiece(dto: CreatePieceDto): NestingPiece {
    const model = this.buildModel(dto)
    const anyDto = dto as { name?: string; length?: number; width?: number; height?: number; thicknessMm?: number; template?: string }
    const label =
      anyDto.name?.trim() ||
      `${anyDto.template ?? 'tira'}-${anyDto.length ?? anyDto.width}x${anyDto.width ?? anyDto.height}`
    return geometryModelToNestingPiece(model, {
      id: `${label}-${Date.now()}`,
      thicknessMm: anyDto.thicknessMm,
    })
  }
}
