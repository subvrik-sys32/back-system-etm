import { BadRequestException, Injectable } from '@nestjs/common'
import {
  optimize,
  type NestedSheet,
  type NestingOptions,
  type NestingPiece,
  type SheetConfig,
} from '../nesting/engine'

export type NestRunRequest = {
  pieces: NestingPiece[]
  options: {
    sheet: SheetConfig
    mode?: NestingOptions['mode']
    separation?: number
    rotationMode?: NestingOptions['rotationMode']
    searchStep?: number
  }
}

export type NestRunResponse = {
  sheets: NestedSheet[]
  pieceCount: number
  sheetCount: number
}

@Injectable()
export class NestingRunService {
  run(body: NestRunRequest): NestRunResponse {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Body is required')
    }
    if (!Array.isArray(body.pieces) || body.pieces.length === 0) {
      throw new BadRequestException('pieces must be a non-empty array')
    }
    if (!body.options?.sheet) {
      throw new BadRequestException('options.sheet is required')
    }
    const { width, height, margin } = body.options.sheet
    if (
      typeof width !== 'number' ||
      typeof height !== 'number' ||
      typeof margin !== 'number' ||
      !(width > 0) ||
      !(height > 0) ||
      margin < 0
    ) {
      throw new BadRequestException(
        'options.sheet requires width>0, height>0, margin>=0',
      )
    }

    try {
      const sheets = optimize(body.pieces, {
        sheet: body.options.sheet,
        mode: body.options.mode ?? 'fast',
        separation: body.options.separation ?? 5,
        rotationMode: body.options.rotationMode ?? '0-90-180-270',
        searchStep: body.options.searchStep,
      })

      return {
        sheets,
        pieceCount: body.pieces.reduce(
          (n, p) => n + (p.quantity ?? 1),
          0,
        ),
        sheetCount: sheets.length,
      }
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Nesting failed',
      )
    }
  }
}
