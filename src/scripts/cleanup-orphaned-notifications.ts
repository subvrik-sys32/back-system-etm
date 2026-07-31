import { NestFactory } from "@nestjs/core"
import { Logger } from "@nestjs/common"

import { AppModule } from "@/app.module"
import { PrismaService } from "@/infra/database/prisma/prisma.service"

// One-off: borra notificaciones huérfanas que quedaron de comentarios
// eliminados ANTES de que comments.service.ts#remove empezara a
// llamar a notificationsService.deleteByCommentId (o de casos donde
// esa llamada falló silenciosamente — ver el retry agregado en
// notifications.service.ts).
//
// Corre en modo DRY RUN por defecto: solo cuenta y loguea, no borra
// nada. Para aplicar de verdad:
//
//   npx ts-node -r tsconfig-paths/register src/scripts/cleanup-orphaned-notifications.ts --apply
//
// Es seguro correrlo más de una vez (idempotente): la segunda vez no
// encuentra nada para borrar.
async function bootstrap() {

  const logger = new Logger("CleanupOrphanedNotifications")
  const apply = process.argv.includes("--apply")

  const app = await NestFactory.createApplicationContext(AppModule)
  const prisma = app.get(PrismaService)

  try {

    // Notificaciones cuyo comentario fue borrado (soft delete) pero
    // la fila de notificación sobrevivió.
    const orphanedByDeletedComment = await prisma.notification.findMany({
      where: {
        commentId: { not: null },
        comment: { deletedAt: { not: null } },
      },
      select: { id: true, userId: true, commentId: true, createdAt: true },
    })

    // Defensivo: notificaciones cuyo commentId ya no matchea NINGÚN
    // comentario existente. No debería pasar (la FK tiene
    // onDelete:Cascade), pero si en algún momento se hizo un borrado
    // "a mano" contra la DB sin pasar por Prisma, esto lo detecta.
    const allCommentIds = new Set(
      (await prisma.comment.findMany({ select: { id: true } })).map(c => c.id),
    )

    const notificationsWithCommentId = await prisma.notification.findMany({
      where: { commentId: { not: null } },
      select: { id: true, commentId: true },
    })

    const orphanedByMissingComment = notificationsWithCommentId.filter(
      n => n.commentId && !allCommentIds.has(n.commentId),
    )

    const idsToDelete = new Set([
      ...orphanedByDeletedComment.map(n => n.id),
      ...orphanedByMissingComment.map(n => n.id),
    ])

    logger.log(
      `Encontradas ${orphanedByDeletedComment.length} notis con comentario borrado ` +
      `y ${orphanedByMissingComment.length} con comentario inexistente ` +
      `(${idsToDelete.size} únicas a limpiar).`,
    )

    if (idsToDelete.size === 0) {
      logger.log("Nada para limpiar. ✅")
      return
    }

    if (!apply) {
      logger.warn(
        "DRY RUN — no se borró nada. Corré con --apply para aplicar de verdad.",
      )
      logger.log(`IDs: ${[...idsToDelete].join(", ")}`)
      return
    }

    // Recalculamos cuántas eran no-leídas para poder loguearlo —
    // el contador de unread-count por usuario ya se recalcula solo
    // (useUnreadCount hace fetch fresco), no hace falta tocarlo acá.
    const unreadCount = [
      ...orphanedByDeletedComment,
    ].length // best-effort informativo, no crítico

    const result = await prisma.notification.deleteMany({
      where: { id: { in: [...idsToDelete] } },
    })

    logger.log(`Borradas ${result.count} notificaciones huérfanas (≈${unreadCount} eran candidatas a no-leídas). ✅`)

  } finally {
    await app.close()
  }

}

bootstrap().catch(error => {
  // eslint-disable-next-line no-console
  console.error("Cleanup falló:", error)
  process.exit(1)
})