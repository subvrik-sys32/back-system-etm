import { Injectable } from "@nestjs/common"
import sharp from "sharp"

export interface ProcessedImage {
  base64: string
  mimeType: string
  width: number
  height: number
}

const UNIFIED_MIN_WIDTH = 1600
const UNIFIED_MAX_WIDTH = 1920

@Injectable()
export class ImagePreprocessService {

  async unifySize(imageBuffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
    const meta = await sharp(imageBuffer).metadata()
    const w = meta.width || UNIFIED_MIN_WIDTH
    const h = meta.height || 1080
    const targetWidth = Math.min(Math.max(w, UNIFIED_MIN_WIDTH), UNIFIED_MAX_WIDTH)

    if (targetWidth === w) {
      return { buffer: imageBuffer, width: w, height: h }
    }

    const resized = await sharp(imageBuffer)
      .resize({ width: targetWidth, fit: "inside" })
      .png()
      .toBuffer()
    const newMeta = await sharp(resized).metadata()
    return { buffer: resized, width: newMeta.width || targetWidth, height: newMeta.height || h }
  }

  private async toProcessedImage(buffer: Buffer): Promise<ProcessedImage> {
    const meta = await sharp(buffer).metadata()
    return {
      base64: buffer.toString("base64"),
      mimeType: "image/png",
      width: meta.width || 0,
      height: meta.height || 0,
    }
  }

  async preprocessImage(imageBuffer: Buffer, _originalMime: string): Promise<ProcessedImage> {
    const processed = await sharp(imageBuffer)
      .sharpen({ sigma: 1.0 })
      .modulate({ brightness: 1.05, saturation: 1.3 })
      .normalize()
      .png()
      .toBuffer()
    return this.toProcessedImage(processed)
  }

  async preprocessEdgeDetection(imageBuffer: Buffer): Promise<ProcessedImage> {
    const resized = await sharp(imageBuffer)
      .greyscale()
      .toBuffer({ resolveWithObject: true })

    const w = resized.info.width
    const h = resized.info.height

    const grayBuffer = await sharp(resized.data)
      .blur(0.5)
      .raw()
      .toBuffer()

    const sobelH = await sharp(grayBuffer, { raw: { width: w, height: h, channels: 1 } })
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, 0, 1, -2, 0, 2, -1, 0, 1],
        scale: 1,
        offset: 128,
      })
      .raw()
      .toBuffer()

    const sobelV = await sharp(grayBuffer, { raw: { width: w, height: h, channels: 1 } })
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -2, -1, 0, 0, 0, 1, 2, 1],
        scale: 1,
        offset: 128,
      })
      .raw()
      .toBuffer()

    const threshold = 40
    const binary = Buffer.alloc(sobelH.length * 3)
    for (let i = 0; i < sobelH.length; i++) {
      const gx = sobelH[i] - 128
      const gy = sobelV[i] - 128
      const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy))
      const val = mag > threshold ? 255 : 0
      binary[i * 3] = val
      binary[i * 3 + 1] = val
      binary[i * 3 + 2] = val
    }

    const result = await sharp(binary, { raw: { width: w, height: h, channels: 3 } })
      .png()
      .toBuffer()

    return this.toProcessedImage(result)
  }

  async generateImageVariants(imageBuffer: Buffer, originalMime: string): Promise<{
    color: ProcessedImage | null
    edges: ProcessedImage | null
  }> {
    const [color, edges] = await Promise.all([
      this.preprocessImage(imageBuffer, originalMime).catch(() => null),
      this.preprocessEdgeDetection(imageBuffer).catch(() => null),
    ])
    return { color, edges }
  }

}
