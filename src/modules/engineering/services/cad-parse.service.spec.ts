import { CadParseService } from './cad-parse.service'

const MINI_RECT_DXF = '0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nCUT\n62\n3\n10\n0.0\n20\n0.0\n11\n100.0\n21\n0.0\n0\nLINE\n8\nCUT\n62\n3\n10\n100.0\n20\n0.0\n11\n100.0\n21\n50.0\n0\nLINE\n8\nCUT\n62\n3\n10\n100.0\n20\n50.0\n11\n0.0\n21\n50.0\n0\nLINE\n8\nCUT\n62\n3\n10\n0.0\n20\n50.0\n11\n0.0\n21\n0.0\n0\nENDSEC\n0\nEOF\n'

describe('CadParseService', () => {
  const service = new CadParseService()

  it('DXF → al menos 1 pieza', () => {
    const res = service.parseFile('plate.dxf', MINI_RECT_DXF)
    expect(res.valid).toBe(true)
    expect(res.pieces.length).toBeGreaterThanOrEqual(1)
    expect(res.pieces[0].outline.points.length).toBeGreaterThan(0)
  })

  it('rechaza stp', () => {
    expect(() => service.parseFile('x.stp', 'noop')).toThrow()
  })
})
