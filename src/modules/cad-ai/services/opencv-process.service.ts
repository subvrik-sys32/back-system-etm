import { Injectable } from "@nestjs/common"
import { loadOpenCV } from "@opencvjs/node"
import sharp from "sharp"

let cvInstance: any = null

async function getCv(): Promise<any> {
  if (!cvInstance) {
    cvInstance = await loadOpenCV()
  }
  return cvInstance
}

export interface CropResult {
  buffer: Buffer
  x: number
  y: number
  width: number
  height: number
}

export interface DetectedLine { x1: number; y1: number; x2: number; y2: number }
export interface DetectedCircle { x: number; y: number; r: number }
export interface DetectedContour {
  bbox: [number, number, number, number]
  area: number
  circularity: number
  vertices: number
  centroid: [number, number]
}

export interface Detection<T> {
  image: Buffer
  items: T[]
  width: number
  height: number
}

interface LoadedImage {
  gray: any
  color: any
  width: number
  height: number
  scale: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

@Injectable()
export class OpencvProcessService {

  private async loadImage(imageBuffer: Buffer): Promise<LoadedImage> {
    const cv = await getCv()

    const meta = await sharp(imageBuffer).metadata()
    const width = meta.width || 1920
    const height = meta.height || 1080

    const raw = await sharp(imageBuffer)
      .removeAlpha()
      .toColourspace("srgb")
      .raw()
      .toBuffer()

    const color = cv.matFromImageData(new Uint8ClampedArray(raw), width, height, 3)
    const gray = new cv.Mat()
    cv.cvtColor(color, gray, cv.COLOR_RGB2GRAY)

    return { gray, color, width, height, scale: 1 }
  }

  private cloneColor(img: LoadedImage): any {
    return img.color.clone()
  }

  private async matToPng(mat: any, width: number, height: number, channels: 1 | 3): Promise<Buffer> {
    const data = Buffer.from(new Uint8Array(mat.data))
    return sharp(data, { raw: { width, height, channels } }).png().toBuffer()
  }

  private mergeLines(lines: DetectedLine[], angleTolDeg = 1.5, rhoTol = 2.5, gapTol = 5): DetectedLine[] {
    interface N { angle: number; rho: number; t1: number; t2: number; ux: number; uy: number }
    const norm: N[] = lines.map(l => {
      let angle = (Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * 180) / Math.PI
      angle = ((angle % 180) + 180) % 180
      const rad = (angle * Math.PI) / 180
      const ux = Math.cos(rad)
      const uy = Math.sin(rad)
      const rho = l.x1 * -uy + l.y1 * ux
      let t1 = l.x1 * ux + l.y1 * uy
      let t2 = l.x2 * ux + l.y2 * uy
      if (t1 > t2) [t1, t2] = [t2, t1]
      return { angle, rho, t1, t2, ux, uy }
    })

    norm.sort((a, b) => a.angle - b.angle || a.rho - b.rho)

    const merged: N[] = []
    let cur: N | null = null

    const close = (a: N, b: N) => {
      const dAngle = Math.min(Math.abs(a.angle - b.angle), 180 - Math.abs(a.angle - b.angle))
      return dAngle <= angleTolDeg && Math.abs(a.rho - b.rho) <= rhoTol
    }

    for (const l of norm) {
      if (cur && close(cur, l) && l.t1 <= cur.t2 + gapTol) {
        cur.t2 = Math.max(cur.t2, l.t2)
        cur.t1 = Math.min(cur.t1, l.t1)
      } else {
        if (cur) merged.push(cur)
        cur = { ...l }
      }
    }
    if (cur) merged.push(cur)

    return merged.map(m => ({
      x1: m.ux * m.t1 - m.uy * m.rho,
      y1: m.uy * m.t1 + m.ux * m.rho,
      x2: m.ux * m.t2 - m.uy * m.rho,
      y2: m.uy * m.t2 + m.ux * m.rho,
    }))
  }

  async cropDrawingArea(imageBuffer: Buffer): Promise<CropResult> {
    const cv = await getCv()
    const img = await this.loadImage(imageBuffer)
    const { width: procWidth, height: procHeight, scale } = img

    const meta = await sharp(imageBuffer).metadata()
    const origWidth = meta.width || procWidth
    const origHeight = meta.height || procHeight

    const binary = new cv.Mat()
    const closed = new cv.Mat()
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()

    try {
      cv.threshold(img.gray, binary, 200, 255, cv.THRESH_BINARY_INV)

      const kernel = cv.Mat.ones(5, 5, cv.CV_8U)
      cv.morphologyEx(binary, closed, cv.MORPH_CLOSE, kernel)
      kernel.delete()

      cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

      let maxArea = 0
      let maxRect: { x: number; y: number; width: number; height: number } | null = null

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i)
        const area = cv.contourArea(contour)
        if (area > maxArea) {
          maxArea = area
          const rect = cv.boundingRect(contour)
          maxRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        }
        contour.delete()
      }

      if (!maxRect || maxArea < procWidth * procHeight * 0.05) {
        const marginX = Math.round(procWidth * 0.05)
        const marginY = Math.round(procHeight * 0.05)
        maxRect = {
          x: marginX,
          y: marginY,
          width: procWidth - marginX * 2,
          height: procHeight - marginY * 2,
        }
      }

      const padding = 20
      const cropX = Math.max(0, Math.round(maxRect.x / scale) - padding)
      const cropY = Math.max(0, Math.round(maxRect.y / scale) - padding)
      const cropW = Math.min(origWidth - cropX, Math.round(maxRect.width / scale) + padding * 2)
      const cropH = Math.min(origHeight - cropY, Math.round(maxRect.height / scale) + padding * 2)

      const cropped = await sharp(imageBuffer)
        .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
        .png()
        .toBuffer()

      return { buffer: cropped, x: cropX, y: cropY, width: cropW, height: cropH }
    } finally {
      img.gray.delete()
      img.color.delete()
      binary.delete()
      closed.delete()
      contours.delete()
      hierarchy.delete()
    }
  }

  async detectLines(imageBuffer: Buffer): Promise<Detection<DetectedLine>> {
    const cv = await getCv()
    const img = await this.loadImage(imageBuffer)

    const edges = new cv.Mat()
    const lines = new cv.Mat()
    const overlay = this.cloneColor(img)

    try {
      cv.Canny(img.gray, edges, 50, 150, 3)
      cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 50, 30, 10)

      const raw: DetectedLine[] = []
      for (let i = 0; i < lines.rows; i++) {
        const p = lines.intPtr(i, 0)
        raw.push({ x1: p[0], y1: p[1], x2: p[2], y2: p[3] })
      }

      const merged = this.mergeLines(raw)
        .map(l => ({ x1: round1(l.x1), y1: round1(l.y1), x2: round1(l.x2), y2: round1(l.y2) }))
        .sort((a, b) => Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1))
        .slice(0, 300)

      for (const l of merged) {
        cv.line(overlay, new cv.Point(l.x1, l.y1), new cv.Point(l.x2, l.y2), new cv.Scalar(255, 200, 0, 255), 2)
      }

      const image = await this.matToPng(overlay, img.width, img.height, 3)
      return { image, items: merged, width: img.width, height: img.height }
    } finally {
      img.gray.delete()
      img.color.delete()
      edges.delete()
      lines.delete()
      overlay.delete()
    }
  }

  async detectContours(imageBuffer: Buffer): Promise<Detection<DetectedContour>> {
    const cv = await getCv()
    const img = await this.loadImage(imageBuffer)

    const binary = new cv.Mat()
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    const overlay = this.cloneColor(img)

    try {
      cv.threshold(img.gray, binary, 200, 255, cv.THRESH_BINARY_INV)

      const kernel = cv.Mat.ones(3, 3, cv.CV_8U)
      cv.morphologyEx(binary, binary, cv.MORPH_CLOSE, kernel)
      kernel.delete()

      cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

      const items: DetectedContour[] = []
      const approx = new cv.Mat()

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i)
        const area = cv.contourArea(contour)
        if (area > 50) {
          const peri = cv.arcLength(contour, true)
          cv.approxPolyDP(contour, approx, 0.02 * peri, true)
          const rect = cv.boundingRect(contour)
          const m = cv.moments(contour)
          const circularity = peri > 0 ? Math.min(1, (4 * Math.PI * area) / (peri * peri)) : 0

          items.push({
            bbox: [round1(rect.x), round1(rect.y), round1(rect.width), round1(rect.height)],
            area: round1(area),
            circularity: Math.round(circularity * 100) / 100,
            vertices: approx.rows,
            centroid: [
              round1(m.m00 !== 0 ? m.m10 / m.m00 : rect.x + rect.width / 2),
              round1(m.m00 !== 0 ? m.m01 / m.m00 : rect.y + rect.height / 2),
            ],
          })

          cv.drawContours(overlay, contours, i, new cv.Scalar(255, 255, 255, 255), 1, cv.LINE_8, hierarchy, 0, new cv.Point(0, 0))
        }
        contour.delete()
      }
      approx.delete()

      items.sort((a, b) => b.area - a.area)
      const capped = items.slice(0, 150)

      const image = await this.matToPng(overlay, img.width, img.height, 3)
      return { image, items: capped, width: img.width, height: img.height }
    } finally {
      img.gray.delete()
      img.color.delete()
      binary.delete()
      contours.delete()
      hierarchy.delete()
      overlay.delete()
    }
  }

  async detectCircles(imageBuffer: Buffer): Promise<Detection<DetectedCircle>> {
    const cv = await getCv()
    const img = await this.loadImage(imageBuffer)

    const blurred = new cv.Mat()
    const circles = new cv.Mat()
    const overlay = this.cloneColor(img)

    try {
      cv.GaussianBlur(img.gray, blurred, new cv.Size(9, 9), 2, 2)

      const maxR = Math.round(Math.min(img.width, img.height) / 4)
      cv.HoughCircles(blurred, circles, cv.HOUGH_GRADIENT, 1, 30, 50, 20, 5, maxR)

      const raw: DetectedCircle[] = []
      for (let i = 0; i < circles.cols; i++) {
        raw.push({
          x: circles.data32F[i * 3],
          y: circles.data32F[i * 3 + 1],
          r: circles.data32F[i * 3 + 2],
        })
      }

      const deduped: DetectedCircle[] = []
      for (const c of raw) {
        const dup = deduped.some(d =>
          Math.hypot(d.x - c.x, d.y - c.y) < Math.max(8, Math.min(d.r, c.r) * 0.5) &&
          Math.abs(d.r - c.r) < Math.max(4, Math.min(d.r, c.r) * 0.3)
        )
        if (!dup) deduped.push(c)
      }

      const items = deduped
        .map(c => ({ x: round1(c.x), y: round1(c.y), r: round1(c.r) }))
        .slice(0, 200)

      for (const c of items) {
        cv.circle(overlay, new cv.Point(c.x, c.y), Math.round(c.r), new cv.Scalar(0, 255, 0, 255), 2)
        cv.circle(overlay, new cv.Point(c.x, c.y), 2, new cv.Scalar(0, 255, 0, 255), -1)
      }

      const image = await this.matToPng(overlay, img.width, img.height, 3)
      return { image, items, width: img.width, height: img.height }
    } finally {
      img.gray.delete()
      img.color.delete()
      blurred.delete()
      circles.delete()
      overlay.delete()
    }
  }

  async detectDashedLines(imageBuffer: Buffer): Promise<Detection<DetectedLine>> {
    const cv = await getCv()
    const img = await this.loadImage(imageBuffer)

    const binary = new cv.Mat()
    const dilated = new cv.Mat()
    const edges = new cv.Mat()
    const lines = new cv.Mat()
    const overlay = this.cloneColor(img)

    try {
      cv.threshold(img.gray, binary, 100, 255, cv.THRESH_BINARY_INV)

      const kernelH = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(15, 1))
      cv.dilate(binary, dilated, kernelH)
      kernelH.delete()

      const kernelV = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, 15))
      cv.dilate(dilated, dilated, kernelV)
      kernelV.delete()

      cv.Canny(dilated, edges, 30, 100, 3)
      cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 40, 40, 15)

      const raw: DetectedLine[] = []
      for (let i = 0; i < lines.rows; i++) {
        const p = lines.intPtr(i, 0)
        raw.push({ x1: p[0], y1: p[1], x2: p[2], y2: p[3] })
      }

      const merged = this.mergeLines(raw, 2, 4, 8)
        .map(l => ({ x1: round1(l.x1), y1: round1(l.y1), x2: round1(l.x2), y2: round1(l.y2) }))
        .sort((a, b) => Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1))
        .slice(0, 100)

      for (const l of merged) {
        cv.line(overlay, new cv.Point(l.x1, l.y1), new cv.Point(l.x2, l.y2), new cv.Scalar(0, 255, 255, 255), 2)
      }

      const image = await this.matToPng(overlay, img.width, img.height, 3)
      return { image, items: merged, width: img.width, height: img.height }
    } finally {
      img.gray.delete()
      img.color.delete()
      binary.delete()
      dilated.delete()
      edges.delete()
      lines.delete()
      overlay.delete()
    }
  }

}
