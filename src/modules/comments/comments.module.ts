import {
  Module,
} from "@nestjs/common"

import {
  CommentsController,
} from "./comments.controller"

import {
  CommentsService,
} from "./comments.service"

import {
  CommentRepository,
} from "./repositories/comment.repository"

import {
  PrismaModule,
} from "@/infra/database/prisma/prisma.module"

@Module({

  imports:[
    PrismaModule,
  ],

  controllers:[
    CommentsController,
  ],

  providers:[
    CommentsService,
    CommentRepository,
  ],

  exports:[
    CommentsService,
  ],

})
export class CommentsModule {}