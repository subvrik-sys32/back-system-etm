import { Injectable } from "@nestjs/common"

@Injectable()
export class CodeGeneratorService {

  async generate(
    loadCodes: () => Promise<Array<{ code: string }>>,
    prefix: string,
    digits = 3,
  ): Promise<string> {

    const rows = await loadCodes()

    let max = 0

    for (const { code } of rows) {

      const value = Number(
        code.replace(`${prefix}-`, ""),
      )

      if (!Number.isNaN(value) && value > max) {
        max = value
      }

    }

    return `${prefix}-${String(max + 1).padStart(digits, "0")}`

  }

}