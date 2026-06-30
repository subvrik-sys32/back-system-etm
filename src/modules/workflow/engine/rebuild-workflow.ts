import {
  ProcessCode,
  WorkflowStatus,
  WorkflowStep,
} from "@prisma/client"

export function buildWorkflow(
  route:ProcessCode[],
){

  return route.map((processCode,index)=>({

    processCode,

    order:index+1,

    status:
      index===0
        ?WorkflowStatus.PENDING
        :WorkflowStatus.QUEUE,

    operatorId:null,

    startedAt:null,

    completedAt:null,

    reviewedAt:null,

    piecesOutput:null,

    plRtReal:null,

    paintKgReal:null,

  }))

}

export function hasWorkflowStarted(
  steps:Pick<
    WorkflowStep,
    "status"
  >[],
){

  return steps.some(

    step=>

      step.status!==WorkflowStatus.PENDING &&

      step.status!==WorkflowStatus.QUEUE,

  )

}