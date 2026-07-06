import {
  Module,
} from "@nestjs/common"

import {
  ConfigModule,
} from "@nestjs/config"

import {
  AppController,
} from "./app.controller"

import {
  AppService,
} from "./app.service"

import {
  DatabaseModule,
} from "./infra/database/database.module"

import {
  MonitoringModule,
} from "./infra/monitoring/monitoring.module"

import {
  SeedModule,
} from "./seed/seed.module"

import {
  AuthModule,
} from "./modules/auth/auth.module"

import {
  UsersModule,
} from "./modules/users/users.module"

import {
  RolesModule,
} from "./modules/roles/roles.module"

import {
  PermissionsModule,
} from "./modules/permissions/permissions.module"

import {
  ClientsModule,
} from "./modules/clients/clients.module"

import {
  PrioritiesModule,
} from "./modules/priorities/priorities.module"

import {
  MaterialsModule,
} from "@/modules/materials/materials.module"

import {
  ThicknessesModule,
} from "@/modules/thicknesses/thicknesses.module"

import {
  ColorsModule,
} from "@/modules/colors/colors.module"

import {
  StagesModule,
} from "./modules/stages/stages.module"

import {
  StatusesModule,
} from "@/modules/statuses/statuses.module"

import {
  ProjectsModule,
} from "@/modules/projects/projects.module"

import {
  TasksModule,
} from "@/modules/tasks/tasks.module"

import {
  WorkflowModule,
} from "@/modules/workflow/workflow.module"

import {
  CodeGeneratorModule,
} from "@/shared/code-generator/code-generator.module"

import {
  RealtimeModule,
} from "@/modules/realtime/realtime.module"

import {
  CommentsModule,
} from "@/modules/comments/comments.module"

import {
  NotificationsModule,
} from "@/modules/notifications/notifications.module"

@Module({

  imports:[

    ConfigModule.forRoot({

      isGlobal:true,

    }),

    DatabaseModule,

    MonitoringModule,

    SeedModule,

    AuthModule,

    UsersModule,

    RolesModule,

    PermissionsModule,

    ClientsModule,

    PrioritiesModule,

    MaterialsModule,

    ThicknessesModule,

    ColorsModule,

    StagesModule,

    StatusesModule,

    ProjectsModule,

    TasksModule,

    WorkflowModule,

    CodeGeneratorModule,

    RealtimeModule,

    CommentsModule,
    
    NotificationsModule,

  ],

  controllers:[

    AppController,

  ],

  providers:[

    AppService,

  ],

})
export class AppModule{}