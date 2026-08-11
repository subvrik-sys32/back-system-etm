import {
  ProcessCode,
  WorkflowStatus,
  WorkflowStep,
} from "@prisma/client"

export function buildWorkflow(
  route: ProcessCode[],
) {
  return route.map((processCode, index) => ({
    processCode,
    order: index + 1,
    status:
      index === 0
        ? WorkflowStatus.PENDING
        : WorkflowStatus.QUEUE,
    operatorId: null,
    startedAt: null,
    completedAt: null,
    reviewedAt: null,
    piecesOutput: null,
    plRtReal: null,
    paintKgReal: null,
  }))
}

export function hasWorkflowStarted(
  steps: Pick<WorkflowStep, "status">[],
) {
  return steps.some(
    step =>
      step.status !== WorkflowStatus.PENDING &&
      step.status !== WorkflowStatus.QUEUE,
  )
}

/**
 * Producción iniciada: solo se pueden AGREGAR procesos.
 * Todos los códigos de la ruta anterior deben seguir en la nueva.
 */
export function assertRouteOnlyAdds(
  previousRoute: ProcessCode[],
  nextRoute: ProcessCode[],
) {
  for (const code of previousRoute) {
    if (!nextRoute.includes(code)) {
      throw new Error(
        "No se pueden quitar procesos de la ruta una vez iniciada la producción. Solo se pueden agregar.",
      )
    }
  }
}

type ExistingStep = Pick<
  WorkflowStep,
  | "id"
  | "processCode"
  | "status"
  | "operatorId"
  | "startedAt"
  | "completedAt"
  | "reviewedAt"
  | "piecesOutput"
  | "plRtReal"
  | "paintKgReal"
  | "order"
>

/**
 * Fusiona pasos existentes con la nueva ruta:
 * - Conserva estado/datos de procesos que siguen.
 * - Crea pasos nuevos (QUEUE) para códigos agregados.
 * - Reasigna order según el índice en newRoute.
 */
export function planWorkflowMerge(
  newRoute: ProcessCode[],
  existing: ExistingStep[],
) {
  const byCode = new Map(
    existing.map(step => [step.processCode, step]),
  )

  const toKeep: Array<{
    id: string
    order: number
  }> = []

  const toCreate: ReturnType<typeof buildWorkflow> = []

  newRoute.forEach((processCode, index) => {
    const order = index + 1
    const prev = byCode.get(processCode)

    if (prev) {
      toKeep.push({ id: prev.id, order })
      return
    }

    toCreate.push({
      processCode,
      order,
      status: WorkflowStatus.QUEUE,
      operatorId: null,
      startedAt: null,
      completedAt: null,
      reviewedAt: null,
      piecesOutput: null,
      plRtReal: null,
      paintKgReal: null,
    })
  })

  const keepIds = new Set(toKeep.map(s => s.id))
  const toDelete = existing
    .filter(step => !keepIds.has(step.id))
    .map(step => step.id)

  return { toKeep, toCreate, toDelete }
}
