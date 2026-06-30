export class WorkflowEngine {

  static validateRequiredFields(
    payload: Record<string, any>,
    requiredFields: readonly string[]
  ) {

    for (const field of requiredFields) {
      const value = payload[field]

      const isEmpty =
        value === null ||
        value === undefined

      const isInvalidNumber =
        typeof value === "number" && Number.isNaN(value)

      if (isEmpty || isInvalidNumber) {
        return {
          ok: false,
          field,
        }
      }
    }

    return { ok: true }
  }
}