/**
 * Tipo de archivo Multer en memoria.
 * Evita Express.Multer.File cuando el namespace no mergea con @types/express.
 */
export type MulterFile = {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  size: number
  buffer: Buffer
  destination?: string
  filename?: string
  path?: string
}