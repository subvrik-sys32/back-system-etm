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

import {
  NotificationsModule,
} from "@/modules/notifications/notifications.module"

@Module({
  imports: [
    ActivityLogModule,
    NotificationsModule,
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