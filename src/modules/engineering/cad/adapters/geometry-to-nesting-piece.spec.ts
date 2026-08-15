import { generatePlate, DEFAULT_PLATE_DEMO } from '../generators/plate-generator'
import { geometryModelToNestingPiece } from './geometry-to-nesting-piece'
import { NestingRunService } from '../../services/nesting-run.service'

describe('geometryModelToNestingPiece', () => {
  it('placa demo → pieza con outline y subEntities', () => {
    const model = generatePlate(DEFAULT_PLATE_DEMO)
    const piece = geometryModelToNestingPiece(model, { id: 'demo' })
    expect(piece.id).toBe('demo')
    expect(piece.outline.points.length).toBeGreaterThanOrEqual(4)
    expect(piece.subEntities?.length).toBe(8)
  })

  it('la pieza entra al motor de nest', () => {
    const model = generatePlate(DEFAULT_PLATE_DEMO)
    const piece = geometryModelToNestingPiece(model, {
      id: 'demo',
      quantity: 2,
    })
    const service = new NestingRunService()
    const result = service.run({
      pieces: [piece],
      options: {
        sheet: { width: 1000, height: 1000, margin: 10 },
        mode: 'fast',
        separation: 5,
      },
    })
    expect(result.sheetCount).toBeGreaterThanOrEqual(1)
    expect(result.sheets[0].pieces.length).toBe(2)
  })
})
