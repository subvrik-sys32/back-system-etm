import { WORKFLOW_BUSINESS } from "../business/workflow.business"
import { WorkflowEngine } from "../engine/workflow.engine"
import { ProcessCode } from "@/shared/types/process-code"

export function validateCompleteStep(
  processCode: ProcessCode,
  payload: Record<string, any>
) {

  const config = WORKFLOW_BUSINESS[processCode]

  if (!config) {
    return {
      ok: false,
      field: "processCode"
    }
  }

  return WorkflowEngine.validateRequiredFields(
    payload,
    config.requiredFields
  )
}