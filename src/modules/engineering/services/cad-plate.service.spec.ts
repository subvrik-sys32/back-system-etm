import { BadRequestException } from '@nestjs/common'
import { CadPlateService } from './cad-plate.service'
import { entityCount } from '../cad/model/geometry-model'
import { countDxfEntityMarkers } from '../cad/exporters/dxf/dxf-exporter'

describe('CadPlateService', () => {
  const service = new CadPlateService()

  it('buildModel placa demo', () => {
    const model = service.buildModel({
      width: 400,
      height: 300,
      holes: { diameter: 20, offset: 50 },
    })
    expect(entityCount(model).total).toBe(8)
  })

  it('buildDxf contiene LINE y CIRCLE', () => {
    const { text } = service.buildDxf({
      width: 400,
      height: 300,
      holes: { diameter: 20, offset: 50 },
    })
    const c = countDxfEntityMarkers(text)
    expect(c.line).toBe(4)
    expect(c.circle).toBe(4)
  })

  it('rechaza body inválido', () => {
    expect(() => service.buildModel({ width: 0, height: 10 } as any)).toThrow(
      BadRequestException,
    )
  })
})
