import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common"
import { DetailAssetKind, Prisma } from "@prisma/client"
import { randomUUID } from "crypto"

import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { SupabaseStorageService } from "@/infra/storage/supabase-storage.service"
import { PermissionCode } from "@/core/enums/permission-code.enum"
import type { CurrentUserType } from "@/shared/types/current-user.types"

const BUCKET = "detail-assets"
const BACKUP_BUCKET = "detail-assets-backup"
const MAX_PHOTOS = 2
const MAX_DXF_BYTES = 15 * 1024 * 1024
const MAX_PHOTO_BYTES = 8 * 1024 * 1024

@Injectable()
export class DetailAssetsService {
  private readonly logger = new Logger("DetailAssets")

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  private readonly assetSelect = {
    id: true,
    kind: true,
    storageKey: true,
    publicUrl: true,
    mimeType: true,
    sizeBytes: true,
    originalName: true,
    meta: true,
    sortOrder: true,
    createdAt: true,
    projectId: true,
    taskId: true,
    materialLineId: true,
    createdBy: {
      select: { id: true, name: true, color: true, icon: true },
    },
  } satisfies Prisma.DetailAssetSelect

  private canManage(user: CurrentUserType, scope: "task" | "project") {
    const p = user.permissions ?? []
    return scope === "task"
      ? p.includes(PermissionCode.TASK_UPDATE) || p.includes(PermissionCode.TASK_CREATE)
      : p.includes(PermissionCode.PROJECT_UPDATE) || p.includes(PermissionCode.PROJECT_CREATE)
  }

  private canRead(user: CurrentUserType, scope: "task" | "project") {
    const p = user.permissions ?? []
    return scope === "task"
      ? p.includes(PermissionCode.TASK_READ)
      : p.includes(PermissionCode.PROJECT_READ)
  }

  async listForProject(projectId: string, user: CurrentUserType) {
    if (!this.canRead(user, "project")) throw new ForbiddenException("Sin permiso")
    return this.prisma.detailAsset.findMany({
      where: { projectId, deletedAt: null },
      select: this.assetSelect,
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
    })
  }

  /** Task-level + DXF de material lines (process hereda sin duplicar). */
  async listForTask(taskId: string, user: CurrentUserType) {
    if (!this.canRead(user, "task")) throw new ForbiddenException("Sin permiso")

    const taskAssets = await this.prisma.detailAsset.findMany({
      where: { taskId, materialLineId: null, deletedAt: null },
      select: this.assetSelect,
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
    })

    const lines = await this.prisma.taskMaterialLine.findMany({
      where: { taskId },
      select: {
        id: true,
        pieces: true,
        sortOrder: true,
        material: { select: { id: true, name: true, color: true } },
        thickness: { select: { id: true, name: true } },
        detailAssets: {
          where: { deletedAt: null, kind: DetailAssetKind.DXF },
          select: this.assetSelect,
          take: 1,
        },
      },
      orderBy: { sortOrder: "asc" },
    })

    return {
      taskAssets,
      materialLines: lines.map(l => ({
        id: l.id,
        pieces: l.pieces,
        sortOrder: l.sortOrder,
        material: l.material,
        thickness: l.thickness,
        dxf: l.detailAssets[0] ?? null,
      })),
    }
  }

  async uploadProjectPhoto(projectId: string, file: Express.Multer.File, user: CurrentUserType) {
    if (!this.canManage(user, "project")) throw new ForbiddenException("Sin permiso")
    const ok = await this.prisma.project.findFirst({ where: { id: projectId, deletedAt: null }, select: { id: true } })
    if (!ok) throw new NotFoundException("Proyecto no encontrado")
    const count = await this.prisma.detailAsset.count({ where: { projectId, kind: DetailAssetKind.PHOTO, deletedAt: null } })
    if (count >= MAX_PHOTOS) throw new BadRequestException(`Máximo ${MAX_PHOTOS} fotos`)
    return this.saveImage({ file, projectId, createdById: user.id })
  }

  async uploadTaskPhoto(taskId: string, file: Express.Multer.File, user: CurrentUserType) {
    if (!this.canManage(user, "task")) throw new ForbiddenException("Sin permiso")
    const ok = await this.prisma.task.findFirst({ where: { id: taskId, deletedAt: null }, select: { id: true } })
    if (!ok) throw new NotFoundException("Tarea no encontrada")
    const count = await this.prisma.detailAsset.count({ where: { taskId, materialLineId: null, kind: DetailAssetKind.PHOTO, deletedAt: null } })
    if (count >= MAX_PHOTOS) throw new BadRequestException(`Máximo ${MAX_PHOTOS} fotos`)
    return this.saveImage({ file, taskId, createdById: user.id })
  }

  private async saveImage(args: { file: Express.Multer.File; projectId?: string; taskId?: string; createdById: string }) {
    if (!args.file?.buffer?.length) throw new BadRequestException("Archivo vacío")
    if (args.file.size > MAX_PHOTO_BYTES) throw new BadRequestException("Foto > 8 MB")
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/jpg"]
    if (!allowed.includes(args.file.mimetype)) throw new BadRequestException("Formato no soportado")

    const publicUrl = await this.storage.uploadCompressedImage(BUCKET, args.file.buffer.toString("base64"))
    const storageKey = publicUrl.split("/").pop() ?? `${randomUUID()}.webp`

    return this.prisma.detailAsset.create({
      data: {
        kind: DetailAssetKind.PHOTO,
        storageKey,
        publicUrl,
        mimeType: "image/webp",
        sizeBytes: args.file.size,
        originalName: args.file.originalname || "photo.webp",
        projectId: args.projectId,
        taskId: args.taskId,
        createdById: args.createdById,
      },
      select: this.assetSelect,
    })
  }

  async upsertNote(scope: { projectId?: string; taskId?: string }, text: string, user: CurrentUserType) {
    const isProject = Boolean(scope.projectId)
    if (!this.canManage(user, isProject ? "project" : "task")) throw new ForbiddenException("Sin permiso")
    const meta = { text: (text ?? "").slice(0, 4000) }
    const where = scope.projectId
      ? { projectId: scope.projectId, kind: DetailAssetKind.NOTE, deletedAt: null, materialLineId: null }
      : { taskId: scope.taskId!, kind: DetailAssetKind.NOTE, deletedAt: null, materialLineId: null }

    const existing = await this.prisma.detailAsset.findFirst({ where })
    if (existing) {
      return this.prisma.detailAsset.update({
        where: { id: existing.id },
        data: { meta, sizeBytes: Buffer.byteLength(meta.text, "utf8") },
        select: this.assetSelect,
      })
    }
    return this.prisma.detailAsset.create({
      data: {
        kind: DetailAssetKind.NOTE,
        meta,
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength(meta.text, "utf8"),
        originalName: "note.txt",
        projectId: scope.projectId,
        taskId: scope.taskId,
        createdById: user.id,
      },
      select: this.assetSelect,
    })
  }

  async uploadMaterialLineDxf(materialLineId: string, file: Express.Multer.File, user: CurrentUserType) {
    if (!this.canManage(user, "task")) throw new ForbiddenException("Sin permiso")
    const line = await this.prisma.taskMaterialLine.findUnique({
      where: { id: materialLineId },
      select: { id: true, taskId: true, task: { select: { deletedAt: true } } },
    })
    if (!line || line.task.deletedAt) throw new NotFoundException("Línea de material no encontrada")
    if (!file?.buffer?.length) throw new BadRequestException("Archivo vacío")
    if (file.size > MAX_DXF_BYTES) throw new BadRequestException("DXF > 15 MB")
    const name = (file.originalname || "").toLowerCase()
    if (!name.endsWith(".dxf") && file.mimetype !== "application/dxf") {
      throw new BadRequestException("Solo archivos .dxf")
    }

    const previous = await this.prisma.detailAsset.findMany({
      where: { materialLineId, kind: DetailAssetKind.DXF, deletedAt: null },
    })
    for (const prev of previous) {
      if (prev.storageKey) await this.storage.deleteFile(BUCKET, prev.storageKey)
      await this.prisma.detailAsset.update({ where: { id: prev.id }, data: { deletedAt: new Date() } })
    }

    const storageKey = `dxf/${line.taskId}/${materialLineId}/${randomUUID()}.dxf`
    await this.storage.uploadFile(BUCKET, storageKey, file.buffer, "application/dxf")
    const publicUrl = this.storage.getPublicUrl(BUCKET, storageKey)

    return this.prisma.detailAsset.create({
      data: {
        kind: DetailAssetKind.DXF,
        storageKey,
        publicUrl,
        mimeType: "application/dxf",
        sizeBytes: file.size,
        originalName: file.originalname || "piece.dxf",
        materialLineId,
        taskId: line.taskId,
        createdById: user.id,
        meta: { taskId: line.taskId, materialLineId },
      },
      select: this.assetSelect,
    })
  }

  async remove(id: string, user: CurrentUserType) {
    const asset = await this.prisma.detailAsset.findFirst({ where: { id, deletedAt: null } })
    if (!asset) throw new NotFoundException("Asset no encontrado")
    const scope: "task" | "project" = asset.projectId ? "project" : "task"
    if (!this.canManage(user, scope)) throw new ForbiddenException("Sin permiso")
    if (asset.storageKey) await this.storage.deleteFile(BUCKET, asset.storageKey)
    await this.prisma.detailAsset.update({ where: { id }, data: { deletedAt: new Date() } })
    return { ok: true }
  }

  /** Tareas finalizadas: el DXF sigue visible hasta purge. Backup → borra caliente. */
  async purgeDxf(user: CurrentUserType, opts: { olderThanDays?: number; dryRun?: boolean } = {}) {
    const p = user.permissions ?? []
    if (!p.includes(PermissionCode.TASK_DELETE) && !p.includes(PermissionCode.PROJECT_DELETE)) {
      throw new ForbiddenException("Sin permiso de depuración")
    }
    const days = Math.max(1, opts.olderThanDays ?? 7)
    const cutoff = new Date(Date.now() - days * 86400000)
    const candidates = await this.prisma.detailAsset.findMany({
      where: { kind: DetailAssetKind.DXF, deletedAt: null, createdAt: { lt: cutoff } },
      select: { id: true, storageKey: true, originalName: true, createdAt: true, taskId: true },
    })
    if (opts.dryRun) return { dryRun: true, count: candidates.length, items: candidates }

    let backed = 0
    let removed = 0
    for (const item of candidates) {
      try {
        if (item.storageKey) {
          const buf = await this.storage.downloadFile(BUCKET, item.storageKey)
          await this.storage.uploadFile(
            BACKUP_BUCKET,
            `backup/${new Date().toISOString().slice(0, 10)}/${item.storageKey}`,
            buf,
            "application/dxf",
          )
          await this.storage.deleteFile(BUCKET, item.storageKey)
          backed++
        }
        await this.prisma.detailAsset.update({
          where: { id: item.id },
          data: { deletedAt: new Date(), publicUrl: null },
        })
        removed++
      } catch (err) {
        this.logger.warn(`Purge ${item.id}: ${(err as Error).message}`)
      }
    }
    return { dryRun: false, backed, removed, total: candidates.length }
  }
}
