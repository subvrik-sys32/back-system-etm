import { generatePlate, DEFAULT_PLATE_DEMO } from '../../generators/plate-generator'
import {
  countDxfEntityMarkers,
  exportGeometryToDxf,
} from './dxf-exporter'
import { createGeometryModel } from '../../model/geometry-model'
import { arc } from '../../geometry/arc'
import { polyline } from '../../geometry/polyline'
import { point } from '../../geometry/point'

describe('exportGeometryToDxf', () => {
  it('placa demo → 4 LINE + 4 CIRCLE y cierra con EOF', () => {
    const model = generatePlate(DEFAULT_PLATE_DEMO)
    const dxf = exportGeometryToDxf(model)
    const counts = countDxfEntityMarkers(dxf)

    expect(counts.line).toBe(4)
    expect(counts.circle).toBe(4)
    expect(dxf.trimEnd().endsWith('EOF')).toBe(true)
    expect(dxf).toContain('$INSUNITS')
    // mm = 4
    expect(dxf).toContain('\n4\n')
  })

  it('escribe ARC y LWPOLYLINE', () => {
    const model = createGeometryModel([
      arc(point(0, 0), 25, 0, 90),
      polyline([point(0, 0), point(10, 0), point(10, 10)], true),
    ])
    const dxf = exportGeometryToDxf(model)
    const counts = countDxfEntityMarkers(dxf)
    expect(counts.arc).toBe(1)
    expect(counts.lwpolyline).toBe(1)
  })
})
