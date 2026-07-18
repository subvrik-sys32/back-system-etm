import { Injectable, Logger } from "@nestjs/common"
import { createClient, SupabaseClient } from "@supabase/supabase-js"

const AVATARS_BUCKET = "avatars"

// Wrapper de Supabase Storage — mismo proyecto que ya usás para la
// base de datos, sin necesitar cuenta/credenciales nuevas. Usa la
// SERVICE ROLE KEY (no la anon key) porque el backend necesita
// poder subir/borrar archivos de CUALQUIER usuario, sin las
// restricciones de Row Level Security que aplican a un usuario
// autenticado individual.
@Injectable()
export class SupabaseStorageService {

  private readonly logger = new Logger("SupabaseStorage")

  private _client: SupabaseClient | null = null

  // Antes esto se creaba en el constructor — pero createClient()
  // de Supabase TIRA una excepción de verdad si la URL viene vacía
  // (no solo devuelve un cliente roto). Como este servicio es
  // @Global(), un constructor que tira acá bloquea el arranque de
  // TODA la app en NestJS, no solo lo relacionado a storage — por
  // eso terminaba en 404 hasta en rutas que no tienen nada que ver
  // (ej. /sidebar/counts) cuando faltaban las env vars.
  //
  // Ahora el cliente se crea recién en el momento de usarlo — la
  // app arranca bien sin las variables configuradas todavía, y
  // recién falla (con un mensaje claro) si alguien intenta subir o
  // bajar un archivo antes de que estén seteadas.
  private get client(): SupabaseClient {

    if (this._client) {
      return this._client
    }

    const url = process.env.SUPABASE_URL?.replace(/\/+$/, "")
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceRoleKey) {

      throw new Error(
        "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no están configuradas — no se puede subir/leer archivos hasta que se seteen en las variables de entorno del backend.",
      )

    }

    this._client = createClient(url, serviceRoleKey)

    return this._client

  }

  // Sube un buffer y devuelve la URL pública — el path incluye un
  // timestamp para que cada subida tenga un nombre único (evita
  // problemas de cache del navegador mostrando la foto vieja).
  async uploadAvatar(userId: string, buffer: Buffer, contentType: string) {

    const path = `${userId}/${Date.now()}.webp`

    const { error } = await this.client.storage
      .from(AVATARS_BUCKET)
      .upload(path, buffer, {
        contentType,
        cacheControl: "31536000", // 1 año — el nombre de archivo ya es único por timestamp
        upsert: false,
      })

    if (error) {
      throw new Error(`No se pudo subir el avatar: ${error.message}`)
    }

    const { data } = this.client.storage
      .from(AVATARS_BUCKET)
      .getPublicUrl(path)

    return data.publicUrl

  }

  // Borra el avatar anterior del usuario (todos los archivos bajo
  // su carpeta) — sin esto, cada avatar nuevo deja el viejo
  // huérfano en el storage para siempre, ocupando espacio de sobra.
  async deleteUserAvatars(userId: string) {

    const { data: files, error: listError } = await this.client.storage
      .from(AVATARS_BUCKET)
      .list(userId)

    if (listError || !files || files.length === 0) {
      return
    }

    const paths = files.map(file => `${userId}/${file.name}`)

    const { error: removeError } = await this.client.storage
      .from(AVATARS_BUCKET)
      .remove(paths)

    if (removeError) {

      this.logger.warn(
        `No se pudieron borrar avatares viejos de ${userId}: ${removeError.message}`,
      )

    }

  }

  // Genéricos, para cualquier archivo que necesite guardarse en un
  // bucket privado y leerse server-side (ej. los DXF de Engineering
  // — antes en disco local, que Render borra en cada redeploy).
  async uploadFile(
    bucket: string,
    path: string,
    buffer: Buffer,
    contentType: string,
  ) {

    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType,
        upsert: true,
      })

    if (error) {
      throw new Error(`No se pudo subir el archivo (${bucket}/${path}): ${error.message}`)
    }

  }

  async downloadFile(bucket: string, path: string): Promise<Buffer> {

    const { data, error } = await this.client.storage
      .from(bucket)
      .download(path)

    if (error || !data) {
      throw new Error(`No se pudo leer el archivo (${bucket}/${path}): ${error?.message ?? "sin datos"}`)
    }

    return Buffer.from(await data.arrayBuffer())

  }

  async deleteFile(bucket: string, path: string) {

    const { error } = await this.client.storage
      .from(bucket)
      .remove([path])

    if (error) {
      this.logger.warn(`No se pudo borrar ${bucket}/${path}: ${error.message}`)
    }

  }

  getPublicUrl(bucket: string, path: string) {

    const { data } = this.client.storage
      .from(bucket)
      .getPublicUrl(path)

    return data.publicUrl

  }

}