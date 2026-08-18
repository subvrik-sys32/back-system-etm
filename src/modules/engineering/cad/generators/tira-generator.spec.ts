import { generateTira, DEFAULT_TIRA_DEMO } from './tira-generator'
import { entityCount } from '../model/geometry-model'

describe('generateTira', () => {
  it('builds demo sujetador-like tira', () => {
    const model = generateTira(DEFAULT_TIRA_DEMO)
    const c = entityCount(model)
    expect(c.circles).toBe(2)
    expect(model.bounds.maxX).toBeCloseTo(211.25, 2)
    expect(model.bounds.maxY).toBeCloseTo(13.6, 2)
  })

  it('rejects invalid size', () => {
    expect(() => generateTira({ length: 0, width: 10 })).toThrow()
  })
})
