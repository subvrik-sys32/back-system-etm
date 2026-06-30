import { BadRequestException } from "@nestjs/common"
import {
  ProcessCode,
  WorkflowStatus,
} from "@prisma/client"

import { WorkflowActionDto } from "../dto/workflow-action.dto"

import { validateCompleteStep } from "../utils/workflow.adapter"

export function validatePending(
  status:WorkflowStatus,
){

  if(status!==WorkflowStatus.PENDING){

    throw new BadRequestException(
      "Step is not pending",
    )

  }

}

export function validateProgress(
  status:WorkflowStatus,
){

  if(status!==WorkflowStatus.PROGRESS){

    throw new BadRequestException(
      "Step is not in progress",
    )

  }

}

export function validatePaused(
  status:WorkflowStatus,
){

  if(status!==WorkflowStatus.PAUSED){

    throw new BadRequestException(
      "Step is not paused",
    )

  }

}

export function validateCompleted(
  status:WorkflowStatus,
){

  if(status!==WorkflowStatus.COMPLETED){

    throw new BadRequestException(
      "Step is not completed",
    )

  }

}

export function validateReopen(
  status:WorkflowStatus,
){

  if(

    status!==WorkflowStatus.COMPLETED &&

    status!==WorkflowStatus.REVIEWED

  ){

    throw new BadRequestException(
      "Step cannot be reopened",
    )

  }

}

export function validateOperatorAssigned(
  operatorId:string|null,
  message:string,
){

  if(!operatorId){

    throw new BadRequestException(
      message,
    )

  }

}

export function validateCompletePayload(
  processCode:ProcessCode,
  dto:WorkflowActionDto,
){

  const result=
    validateCompleteStep(
      processCode,
      dto,
    )

  if(!result.ok){

    throw new BadRequestException(
      `Falta campo: ${result.field}`,
    )

  }

}