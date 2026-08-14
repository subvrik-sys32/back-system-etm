import {
  DEFAULT_PLATE_DEMO,
  generatePlate,
} from './plate-generator'
import { entityCount, hasValidBounds } from '../model/geometry-model'
import { boundsWidth, boundsHeight } from '../geometry/bounds'

describe('generatePlate', () => {
  it('placa demo 400x300 con 4 agujeros Ø20', () => {
    const model = generatePlate(DEFAULT_PLATE_DEMO)
    const counts = entityCount(model)

    expect(model.units).toBe('mm')
    expect(counts.lines).toBe(4)
    expect(counts.circles).toBe(4)
    expect(counts.total).toBe(8)
    expect(hasValidBounds(model)).toBe(true)
    expect(boundsWidth(model.bounds)).toBe(400)
    expect(boundsHeight(model.bounds)).toBe(300)

    const circles = model.entities.filter((e) => e.type === 'CIRCLE')
    expect(circles.every((c) => c.type === 'CIRCLE' && c.radius === 10)).toBe(
      true,
    )
  })

  it('placa sin agujeros solo 4 líneas', () => {
    const model = generatePlate({ width: 100, height: 80 })
    expect(entityCount(model).total).toBe(4)
    expect(entityCount(model).circles).toBe(0)
  })

  it('rechaza dimensiones inválidas', () => {
    expect(() => generatePlate({ width: 0, height: 10 })).toThrow()
    expect(() =>
      generatePlate({
        width: 50,
        height: 50,
        holes: { diameter: 40, offset: 10 },
      }),
    ).toThrow()
  })
})
