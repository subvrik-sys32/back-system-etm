import {
  Module,
} from "@nestjs/common"

import {
  WorkflowController,
} from "./workflow.controller"

import {
  WorkflowService,
} from "./workflow.service"

import {
  OperatorCacheService,
} from "./services/operator-cache.service"

import {
  ActivityLogModule,
} from "@/modules/activity-log/activity-log.module"

@Module({
  imports: [
    ActivityLogModule,
  ],
  controllers: [
    WorkflowController,
  ],
  providers: [
    WorkflowService,
    OperatorCacheService,
  ],
})
export class WorkflowModule {}