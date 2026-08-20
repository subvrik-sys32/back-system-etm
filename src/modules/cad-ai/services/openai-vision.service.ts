import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common"
import OpenAI from "openai"
import type { PlanGeometry, Entity, ViewGeometry } from "../types/entity.types"
import { ImagePreprocessService, type ProcessedImage } from "./image-preprocess.service"
import {
  OpencvProcessService,
  type Detection,
  type DetectedLine,
  type DetectedCircle,
  type DetectedContour,
} from "./opencv-process.service"

interface Detections {
  lines: Detection<DetectedLine> | null
  contours: Detection<DetectedContour> | null
  circles: Detection<DetectedCircle> | null
  dashed: Detection<DetectedLine> | null
}

interface Calibration {
  scaleMmPerPx: number
  note: string
  inferred: boolean
}

@Injectable()
export class OpenaiVisionService {

  private readonly logger = new Logger("OpenaiVision")

  private client: OpenAI | null = null

  private get openai(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY?.trim()
      if (!apiKey) {
        throw new ServiceUnavailableException(
          "OPENAI_API_KEY no está configurada en el servidor. Agrégala al .env del backend y reinicia para usar la IA de CAD.",
        )
      }
      this.client = new OpenAI({ apiKey })
    }
    return this.client
  }

  private get VISION_MODEL(): string {
    return process.env.OPENAI_VISION_MODEL || "gpt-5.6-terra"
  }

  private get TEXT_MODEL(): string {
    return process.env.OPENAI_TEXT_MODEL || this.VISION_MODEL
  }

  private get ANALYZE_EFFORT(): string {
    return process.env.OPENAI_ANALYZE_EFFORT || "medium"
  }

  private get ITERATE_EFFORT(): string {
    return process.env.OPENAI_ITERATE_EFFORT || "low"
  }

  constructor(
    private readonly imagePreprocess: ImagePreprocessService,
    private readonly opencv: OpencvProcessService,
  ) {}

  private isReasoningModel(model: string): boolean {
    return /^(gpt-5|o\d)/i.test(model)
  }

  private buildChatRequest(opts: {
    model: string
    messages: any[]
    maxTokens: number
    effort?: string
    temperature?: number
  }): any {
    const base: any = {
      model: opts.model,
      messages: opts.messages,
      response_format: { type: "json_object" },
    }
    if (this.isReasoningModel(opts.model)) {
      base.max_completion_tokens = opts.maxTokens
      if (opts.effort) base.reasoning_effort = opts.effort
    } else {
      base.max_tokens = opts.maxTokens
      base.temperature = opts.temperature ?? 0.1
    }
    return base
  }

  private buildAnalyzePrompt(imgW: number, imgH: number): string {
    return `You are an expert CAD/CAM engineer specializing in laser cutting and sheet metal manufacturing. You convert screenshots of technical drawings into precise manufacturing geometry.

You receive:
- COLOR image (the cropped drawing, enhanced contrast) — use it for line types, colors, dimension labels.
- EDGES image (Sobel edge detection, white on black) — shows EVERY visible line.
- Auxiliary OVERLAY images: OpenCV detections (contours in white, circles in green, dashed lines in yellow) drawn over the drawing.
- OPENCV NUMERIC DATA (JSON in the user message): the same detections as exact numbers.

COORDINATE SYSTEM — CRITICAL:
- Work in PIXELS of the provided images. ALL images and ALL numeric data share one coordinate system: ${imgW}×${imgH} px, origin TOP-LEFT, Y DOWN.
- Report ALL entity coordinates in PIXELS. Set "coordinateSpace": "pixels". Do NOT convert coordinates to mm — the server calibrates and converts.
- Real mm values are needed ONLY for: calibration.mmLength, view dimensions, overall dimensions, material/thickness notes.

CALIBRATION — DO THIS FIRST:
1. Find the clearest dimension label in the drawing (e.g. "150", "Ø10", "R5").
2. Measure in the image the pixel length of the feature that dimension describes (distance between the dimension arrow tips, or the pixel width/diameter of the feature). The numeric line data helps.
3. Report "calibration": { "pixelLength": <px>, "mmLength": <mm>, "description": "<what you measured>" }.
4. Prefer the LARGEST reliable dimension (overall width or height) — it gives the best precision.
5. If there are NO usable dimension labels: set "calibration": null and put your best estimate of the overall size in "dimensions".

OPENCV NUMERIC DATA (same pixel space):
- circles [{x,y,r}]: candidate holes. EVERY circle whose center lies inside a view's bounds and is not dimension text/UI MUST become a circle entity. Do not drop any.
- contours [{bbox, area, circularity, vertices, centroid}]: closed shapes. circularity ≈ 1 → circle; 0.6–0.9 with 4–8 vertices → rounded rectangle or slot; otherwise complex outline. The LARGEST contour is usually the outer outline.
- lines [{x1,y1,x2,y2}]: dominant straight segments (merged, deduplicated).
- dashed [{x1,y1,x2,y2}]: detected DASHED segments → bend/fold lines.
Cross-check your entities against these numbers — positions and counts must agree. Use the images for what the numbers cannot tell: line types, labels, view layout.

EXTRACTION ORDER — do not skip any step:

STEP 1 - CALIBRATION (see above).

STEP 2 - VIEWS AND BOUNDS:
- Identify each view in the drawing. For EACH view report "bounds": [minX, minY, maxX, maxY], the tight pixel bounding box of that view's geometry, EXCLUDING dimension lines, annotations and title blocks.
- Name views: "flat_pattern", "front", "top", "side", "isometric", "section".
- For SHEET METAL: the FLAT PATTERN is the primary view — it's what gets laser cut. Put its entities also in the top-level "entities" array.

STEP 3 - OUTER OUTLINE (MOST IMPORTANT):
Trace the complete outer boundary of the part (layer "CUT").
- Rectangular → rectangle entity. Complex → polyline (closed=true) with ALL vertices.
- Rounded corners → arc entities. Chamfers → line entities.
- The largest contour in the numeric data is usually the outline.
YOU MUST EXTRACT THE OUTER OUTLINE. Without it the part cannot be cut.

STEP 4 - INTERNAL CUTOUTS:
Every internal removed area that is not a simple hole or slot (layer "CUT").

STEP 5 - HOLES:
One circle entity per hole — never group patterns. Use the numeric circles list as ground truth. Read diameters from labels (Ø10 → radius 5mm, but report pixels here).

STEP 6 - SLOTS:
Elongated holes with rounded ends → slot entity (center, length, width, angle). In the numeric contours they appear with low circularity and 4+ vertices.

STEP 7 - BEND/FOLD LINES (sheet metal):
Dashed lines = FOLD entities (layer "FOLD", angle, direction "up"/"down", default 90°/"up").
CROSS-REFERENCE VIEWS: count the bends in the profile/side view (a bent profile with N straight segments has N-1 folds). The flat pattern MUST contain exactly that many fold lines. If the profile shows an OMEGA/Ω shape (5 segments) expect 4 folds — add any fold missing from the flat pattern.

STEP 8 - CHAMFERS, FILLETS, TEXT, DIMENSIONS:
- Chamfers → line entities; fillets → arc entities (read R values from labels).
- Engraved text → text entity (layer "ETCH"). Dimension annotations → dimension entities (layer "DIM").

ENTITY TYPES (coordinates in PIXELS):
- LINE: { "type": "line", "start": [x,y], "end": [x,y], "layer": "CUT" }
- CIRCLE: { "type": "circle", "center": [x,y], "radius": r, "layer": "CUT" }
- ARC: { "type": "arc", "center": [x,y], "radius": r, "startAngle": deg, "endAngle": deg, "layer": "CUT" }
- POLYLINE: { "type": "polyline", "points": [[x,y],...], "closed": true, "layer": "CUT" }
- RECTANGLE: { "type": "rectangle", "x": x, "y": y, "width": w, "height": h, "layer": "CUT" }
- SLOT: { "type": "slot", "center": [x,y], "length": l, "width": w, "angle": deg, "layer": "CUT" }
- FOLD: { "type": "fold", "start": [x,y], "end": [x,y], "angle": deg, "direction": "up"|"down", "layer": "FOLD" }
- TEXT: { "type": "text", "position": [x,y], "text": "...", "height": h, "angle": 0, "layer": "ETCH" }
- DIMENSION: { "type": "dimension", "start": [x,y], "end": [x,y], "offset": 10, "text": "...", "layer": "DIM" }

LAYERS: "CUT" (laser), "ETCH" (engrave), "FOLD" (bend), "TEXT", "DIM". Every entity MUST have a "layer".

Respond with JSON ONLY:
{
  "units": "mm",
  "coordinateSpace": "pixels",
  "calibration": { "pixelLength": px, "mmLength": mm, "description": "..." } | null,
  "material": "material if known",
  "bendRadius": radius_if_known,
  "views": [
    { "name": "flat_pattern", "label": "Patrón Plano", "bounds": [x0,y0,x1,y1], "dimensions": { "width": mm, "height": mm }, "entities": [...] }
  ],
  "entities": [...primary view entities, pixel coords...],
  "dimensions": { "width": mm, "height": mm, "thickness": mm },
  "notes": "detailed description of what was found"
}`
  }

  private readonly REPAIR_SYSTEM_PROMPT = `You are an expert CAD/CAM engineer. A previous extraction pass converted a CAD screenshot into geometry JSON (millimeters, origin bottom-left, Y up). Automated validation found specific issues.

You receive:
1. The list of issues found by validation.
2. OpenCV detection data (pixel space) and the px→mm scale that was applied.
3. The current geometry JSON (in mm).

Fix ALL the listed issues and return the COMPLETE corrected geometry JSON with "coordinateSpace": "mm".

Rules:
- Keep every entity that is correct; only fix what the issues describe.
- To recover missed holes/cutouts, use the OpenCV data: multiply pixel values by the given scale (and remember Y was flipped: mm_y = (maxY_px - y_px) * scale).
- All coordinates in mm, origin bottom-left, Y up, angles in degrees (0=right, CCW positive).
- Every entity must have a "layer" (CUT, ETCH, FOLD, TEXT, DIM).
- Return ONLY the JSON, no other text.`

  private readonly ITERATE_SYSTEM_PROMPT = `You are an expert CAD/CAM engineer for laser cutting and sheet metal. The user has provided feedback on a part geometry. You must modify the geometry JSON according to the user's feedback.

You will receive:
1. The current geometry as JSON (may contain views array, entities array, fold entities, etc.)
2. The user's feedback (in Spanish or English)
3. Optionally, a list of entities the user has SELECTED in the editor.

CRITICAL — SELECTED ENTITIES:
When the user provides SELECTED entities, you MUST:
  - Modify ONLY those selected entities according to the user's feedback.
  - Return ALL other entities (non-selected) EXACTLY as they were — same coordinates, same dimensions, same type.
  - Do NOT change the outer contour, outline, or any non-selected entity, even if the feedback could be interpreted as applying to the whole part.
  - If the user says "change the circle to a square" and provides a selected circle, replace ONLY that circle with a rectangle/polyline of equivalent position. Leave everything else untouched.
  - The output must contain the SAME number of entities (or +/- only for the selected ones if the user explicitly adds/removes).

When NO selected entities are provided, apply changes to the whole part as described.

Apply the requested changes and return the COMPLETE updated geometry JSON with the same structure including views, entities, and all entity types.

Entity formats (use these EXACT field names):
  Rectangle: {"type":"rectangle","x":0,"y":0,"width":100,"height":60,"layer":"CUT"}
  Polyline (closed outline): {"type":"polyline","points":[[0,0],[100,0],[100,60],[0,60]],"closed":true,"layer":"CUT"}
  Circle (hole): {"type":"circle","center":[25,25],"radius":5,"layer":"CUT"}
  Line: {"type":"line","start":[50,0],"end":[50,60],"layer":"CUT"}
  Fold (bend line): {"type":"fold","start":[50,0],"end":[50,60],"angle":90,"direction":"up","layer":"FOLD"}
  Arc: {"type":"arc","center":[50,50],"radius":10,"startAngle":0,"endAngle":180,"layer":"CUT"}
  Slot: {"type":"slot","center":[50,30],"length":20,"width":6,"angle":0,"layer":"CUT"}
  Text: {"type":"text","position":[10,10],"text":"LABEL","height":5,"angle":0,"layer":"ETCH"}

Rules:
- Keep ALL entities that the user did not ask to change — never drop entities silently
- You MUST populate BOTH "views[0].entities" AND "entities" (top-level) with the SAME entities
- Apply changes precisely (new dimensions, added/removed features, etc.)
- Maintain the same JSON structure with views array and entities array
- All coordinates in mm, origin at bottom-left, Y-axis up
- Every entity MUST have a "layer" (CUT, ETCH, FOLD, TEXT, DIM)
- For sheet metal: maintain fold entities with angle and direction
- Return ONLY the JSON, no other text`

  private readonly GENERATE_PROMPT = `You are an expert CAD/CAM engineer for laser cutting and sheet metal. The user describes a part in natural language (Spanish or English). Generate the COMPLETE geometry JSON.

Rules:
- All coordinates in mm, origin at bottom-left, Y-axis up, angles in degrees (0=right, CCW positive)
- Every entity MUST have a "layer" (CUT, ETCH, FOLD, TEXT, DIM)
- Include the outer outline (layer CUT) — without it the part cannot be cut
- Include ALL holes, cutouts, slots, bend lines as described
- For sheet metal bends: use fold entities with angle and direction
- You MUST populate BOTH "views[0].entities" AND "entities" (top-level) with the SAME entities
- NEVER return empty entities — if the user describes a part, generate at minimum the outer outline
- Return ONLY the JSON, no other text

Entity formats (use these EXACT field names):
  Rectangle: {"type":"rectangle","x":0,"y":0,"width":100,"height":60,"layer":"CUT"}
  Polyline (closed outline): {"type":"polyline","points":[[0,0],[100,0],[100,60],[0,60]],"closed":true,"layer":"CUT"}
  Circle (hole): {"type":"circle","center":[25,25],"radius":5,"layer":"CUT"}
  Line: {"type":"line","start":[50,0],"end":[50,60],"layer":"CUT"}
  Fold (bend line): {"type":"fold","start":[50,0],"end":[50,60],"angle":90,"direction":"up","layer":"FOLD"}
  Arc: {"type":"arc","center":[50,50],"radius":10,"startAngle":0,"endAngle":180,"layer":"CUT"}
  Slot: {"type":"slot","center":[50,30],"length":20,"width":6,"angle":0,"layer":"CUT"}
  Text: {"type":"text","position":[10,10],"text":"LABEL","height":5,"angle":0,"layer":"ETCH"}

JSON structure:
{
  "units": "mm",
  "coordinateSpace": "mm",
  "views": [{ "name": "flat_pattern", "label": "Patrón Plano", "entities": [...SAME AS entities...], "dimensions": {"width": w, "height": h} }],
  "entities": [...all entities...],
  "dimensions": { "width": w, "height": h, "thickness": t },
  "notes": "description of the part"
}`

  private buildImageContent(
    variants: { color: ProcessedImage | null; edges: ProcessedImage | null },
    detections: Detections,
    textPrompt: string,
  ): Array<any> {
    const content: Array<any> = [{ type: "text", text: textPrompt }]

    const pushImage = (img: { base64: string; mimeType: string } | Buffer, mime: string, detail: "high" | "low") => {
      const base64 = Buffer.isBuffer(img) ? img.toString("base64") : img.base64
      const mimeType = Buffer.isBuffer(img) ? mime : img.mimeType
      content.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}`, detail },
      })
    }

    if (variants.color) {
      content.push({ type: "text", text: "IMAGE - COLOR: cropped drawing with enhanced contrast. Line types: solid = cut, dashed = bend, thin with arrows = dimension." })
      pushImage(variants.color, "", "high")
    }
    if (variants.edges) {
      content.push({ type: "text", text: "IMAGE - EDGES: Sobel edge detection. Every visible line is white on black." })
      pushImage(variants.edges, "", "high")
    }
    if (detections.contours) {
      content.push({ type: "text", text: "IMAGE - CONTOURS OVERLAY: OpenCV closed-contour detection (white) over the drawing. Largest contour = outer outline." })
      pushImage(detections.contours.image, "image/png", "low")
    }
    if (detections.circles) {
      content.push({ type: "text", text: "IMAGE - CIRCLES OVERLAY: OpenCV circle detection (green) over the drawing. Each green circle = a hole candidate." })
      pushImage(detections.circles.image, "image/png", "low")
    }
    if (detections.dashed) {
      content.push({ type: "text", text: "IMAGE - DASHED OVERLAY: OpenCV dashed-line detection (yellow) over the drawing. Yellow lines = bend/fold lines." })
      pushImage(detections.dashed.image, "image/png", "low")
    }

    return content
  }

  private detectionsToJson(detections: Detections): string {
    const data: Record<string, unknown> = {}
    if (detections.circles) data.circles = detections.circles.items
    if (detections.contours) data.contours = detections.contours.items
    if (detections.lines) data.lines = detections.lines.items
    if (detections.dashed) data.dashed = detections.dashed.items
    return JSON.stringify(data)
  }

  async analyzeImage(imageBase64: string, mimeType: string): Promise<PlanGeometry> {
    const imageBuffer = Buffer.from(imageBase64, "base64")

    let croppedBuffer: Buffer = imageBuffer
    try {
      const cropResult = await this.opencv.cropDrawingArea(imageBuffer)
      croppedBuffer = Buffer.from(cropResult.buffer)
    } catch {
      // Si OpenCV falla, usar imagen original
    }

    const unified = await this.imagePreprocess.unifySize(croppedBuffer)
    const unifiedBuffer = unified.buffer
    const imgW = unified.width
    const imgH = unified.height

    let variants: { color: ProcessedImage | null; edges: ProcessedImage | null }
    try {
      variants = await this.imagePreprocess.generateImageVariants(unifiedBuffer, "image/png")
    } catch {
      variants = { color: { base64: unifiedBuffer.toString("base64"), mimeType: "image/png", width: imgW, height: imgH }, edges: null }
    }

    const [lines, contours, circles, dashed] = await Promise.all([
      this.opencv.detectLines(unifiedBuffer).catch(() => null),
      this.opencv.detectContours(unifiedBuffer).catch(() => null),
      this.opencv.detectCircles(unifiedBuffer).catch(() => null),
      this.opencv.detectDashedLines(unifiedBuffer).catch(() => null),
    ])
    const detections: Detections = { lines, contours, circles, dashed }

    const userPrompt =
      `Analyze this CAD drawing (${imgW}×${imgH} px). Follow the steps in order: calibrate with a dimension label, identify views and their pixel bounds, then extract outer outline, cutouts, holes, slots, fold lines, text and dimensions — all in PIXELS.\n\n` +
      `OPENCV NUMERIC DATA (same pixel coordinate system):\n${this.detectionsToJson(detections)}`

    const content = this.buildImageContent(variants, detections, userPrompt)

    let rawGeom: any
    try {
      const response = await this.openai.chat.completions.create(this.buildChatRequest({
        model: this.VISION_MODEL,
        messages: [
          { role: "system", content: this.buildAnalyzePrompt(imgW, imgH) },
          { role: "user", content },
        ],
        maxTokens: 16384,
        effort: this.ANALYZE_EFFORT,
        temperature: 0.1,
      }))

      const extractContent = response.choices[0]?.message?.content || ""
      const finishReason = response.choices[0]?.finish_reason

      if (!extractContent || this.isRefusal(extractContent)) {
        throw new Error("La IA rechazó la imagen. Intenta con otra imagen del plano.")
      }
      if (finishReason === "length") {
        throw new Error("La respuesta de la IA quedó truncada. Intenta con una imagen más simple o de menor resolución.")
      }

      rawGeom = JSON.parse(this.cleanJsonResponse(extractContent))
    } catch (err: any) {
      throw this.friendlyModelError(err)
    }

    const warnings: string[] = []
    const calibration = this.resolveCalibration(rawGeom, warnings)
    const geometry = this.convertToMm(rawGeom, calibration, warnings)

    const normalized = this.normalizeGeometry(geometry)
    this.assignLayers(normalized)
    this.scaleSanityCheck(normalized, warnings)

    let issues = this.validateGeometry(normalized, detections, calibration)

    if (issues.length > 0) {
      const repaired = await this.repairGeometry(normalized, issues, detections, calibration, warnings)
      if (repaired) {
        this.assignLayers(repaired)
        const remaining = this.validateGeometry(repaired, detections, calibration)
        if (this.hasOutline(repaired) || !this.hasOutline(normalized)) {
          repaired.meta = this.buildMeta(calibration, warnings, remaining)
          return repaired
        }
      }
      if (!this.hasOutline(normalized)) {
        throw new Error(`No se pudo extraer el contorno exterior de la pieza. ${issues[0] || ""}`.trim())
      }
      warnings.push(...issues.map(i => `Sin corregir: ${i}`))
    }

    normalized.meta = this.buildMeta(calibration, warnings, issues)
    return normalized
  }

  async iterateGeometry(
    currentGeometry: PlanGeometry,
    feedback: string,
    selectedEntities?: Entity[],
  ): Promise<PlanGeometry> {
    let userContent =
      `Current geometry:\n${JSON.stringify(currentGeometry, null, 2)}\n\n` +
      `User feedback:\n${feedback}\n\n`

    if (selectedEntities && selectedEntities.length > 0) {
      userContent +=
        `The user has SELECTED these specific entities in the editor (identified by their geometry):\n${JSON.stringify(selectedEntities, null, 1)}\n` +
        `CRITICAL: Apply the changes ONLY to these selected entities. ` +
        `Return ALL other entities EXACTLY as they appear in the current geometry above — do NOT modify their coordinates, dimensions, or type. ` +
        `Do NOT change the outer contour or outline.\n\n`
    }

    userContent += "Return the updated geometry JSON with the same structure (views array, entities array, all entity types including fold for bends)."

    const response = await this.openai.chat.completions.create(this.buildChatRequest({
      model: this.TEXT_MODEL,
      messages: [
        { role: "system", content: this.ITERATE_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      maxTokens: 16384,
      effort: this.ITERATE_EFFORT,
      temperature: 0.1,
    }))

    const content = response.choices[0]?.message?.content || ""
    const geometry = this.parseGeometryResponse(content)
    this.assignLayers(geometry)
    return geometry
  }

  async generateFromText(prompt: string): Promise<PlanGeometry> {
    const response = await this.openai.chat.completions.create(this.buildChatRequest({
      model: this.TEXT_MODEL,
      messages: [
        { role: "system", content: this.GENERATE_PROMPT },
        { role: "user", content: prompt },
      ],
      maxTokens: 16384,
      effort: this.ANALYZE_EFFORT,
      temperature: 0.1,
    }))

    const content = response.choices[0]?.message?.content || ""
    if (!content || this.isRefusal(content)) {
      throw new Error("La IA no pudo generar la geometría. Intenta con una descripción más detallada.")
    }
    const geometry = this.parseGeometryResponse(content)
    this.assignLayers(geometry)

    const totalEntities = geometry.entities.length +
      geometry.views.reduce((sum, v) => sum + v.entities.length, 0)
    if (totalEntities === 0) {
      throw new Error("La IA no generó ninguna entidad geométrica. Intenta con una descripción más detallada (ej: \"rectángulo 100x50 con 4 agujeros Ø5\").")
    }

    return geometry
  }

  async extractParameters(geometry: PlanGeometry): Promise<{
    parameters: { name: string; label: string; type: "number" | "string"; default: number | string; unit?: string }[]
    template: PlanGeometry
  }> {
    const PARAM_PROMPT = `You are a CAD engineer. Given a part geometry JSON, identify which dimensions are parametric (can vary between instances).

Return a JSON object with:
1. "parameters": array of { "name": "paramName", "label": "Human readable label", "type": "number", "default": value, "unit": "mm" }
2. "template": the same geometry JSON but with parameter values replaced by "{{paramName}}" placeholders

Common parametric dimensions: overall width, height, thickness, hole diameters, slot lengths, corner radii, bend angles, fold positions, etc.

Return ONLY the JSON object.`

    const response = await this.openai.chat.completions.create(this.buildChatRequest({
      model: this.TEXT_MODEL,
      messages: [
        { role: "system", content: PARAM_PROMPT },
        { role: "user", content: `Geometry:\n${JSON.stringify(geometry, null, 2)}\n\nIdentify parametric dimensions and create a template.` },
      ],
      maxTokens: 8192,
      effort: this.ITERATE_EFFORT,
      temperature: 0.1,
    }))

    const content = response.choices[0]?.message?.content || ""
    const cleaned = this.cleanJsonResponse(content)
    try {
      const parsed = JSON.parse(cleaned)
      return {
        parameters: parsed.parameters || [],
        template: parsed.template || geometry,
      }
    } catch {
      return { parameters: [], template: geometry }
    }
  }

  // ─── Calibración px → mm ───────────────────────────────────────────────────

  private pxBBoxOfEntities(entities: any[]): [number, number, number, number] | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const grow = (x: number, y: number) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      minX = Math.min(minX, x); minY = Math.min(minY, y)
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
    }
    for (const e of entities || []) {
      if (!e || typeof e !== "object") continue
      for (const key of ["start", "end", "center", "position"]) {
        if (Array.isArray(e[key])) grow(Number(e[key][0]), Number(e[key][1]))
      }
      if (e.type === "rectangle") {
        grow(e.x, e.y); grow(e.x + e.width, e.y + e.height)
      }
      if (Array.isArray(e.points)) {
        for (const p of e.points) if (Array.isArray(p)) grow(Number(p[0]), Number(p[1]))
      }
    }
    if (!Number.isFinite(minX)) return null
    return [minX, minY, maxX, maxY]
  }

  private resolveCalibration(raw: any, warnings: string[]): Calibration {
    const cal = raw.calibration
    if (cal && Number.isFinite(cal.pixelLength) && Number.isFinite(cal.mmLength) && cal.pixelLength > 0 && cal.mmLength > 0) {
      return {
        scaleMmPerPx: cal.mmLength / cal.pixelLength,
        note: String(cal.description || "cota del dibujo"),
        inferred: false,
      }
    }

    const primary = raw.entities?.length ? raw.entities : raw.views?.[0]?.entities
    const bbox = this.pxBBoxOfEntities(primary || [])
    const dims = raw.dimensions || {}
    const extX = bbox ? bbox[2] - bbox[0] : 0
    const extY = bbox ? bbox[3] - bbox[1] : 0

    const scales: number[] = []
    if (dims.width > 0 && extX > 0) scales.push(dims.width / extX)
    if (dims.height > 0 && extY > 0) scales.push(dims.height / extY)

    if (scales.length > 0) {
      const scale = scales.reduce((a, b) => a + b, 0) / scales.length
      warnings.push("Escala inferida de las dimensiones declaradas (no se encontró cota fiable en el dibujo). Verifica las medidas.")
      return { scaleMmPerPx: scale, note: "inferida de dimensiones", inferred: true }
    }

    warnings.push("Sin calibración: no se encontraron cotas en el dibujo. Las unidades resultantes son aproximadas (1px = 1 unidad).")
    return { scaleMmPerPx: 1, note: "sin calibración", inferred: true }
  }

  private convertToMm(raw: any, calibration: Calibration, warnings: string[]): any {
    if (raw.coordinateSpace === "mm") {
      return raw
    }

    const scale = calibration.scaleMmPerPx

    const convertEntities = (entities: any[], bounds: [number, number, number, number]): any[] => {
      const [bx0, , , byMax] = bounds
      const X = (px: number) => (px - bx0) * scale
      const Y = (py: number) => (byMax - py) * scale
      const P = (p: any): [number, number] => [X(Number(p[0])), Y(Number(p[1]))]

      return (entities || []).map((e: any) => {
        if (!e || typeof e !== "object") return e
        const out: any = { ...e }
        if (Array.isArray(e.start)) out.start = P(e.start)
        if (Array.isArray(e.end)) out.end = P(e.end)
        if (Array.isArray(e.center)) out.center = P(e.center)
        if (Array.isArray(e.position)) out.position = P(e.position)
        if (Array.isArray(e.points)) out.points = e.points.map(P)
        if (e.type === "rectangle") {
          const p0 = P([e.x, e.y])
          const p1 = P([e.x + e.width, e.y + e.height])
          out.x = Math.min(p0[0], p1[0])
          out.y = Math.min(p0[1], p1[1])
          out.width = Math.abs(p1[0] - p0[0])
          out.height = Math.abs(p1[1] - p0[1])
        }
        for (const lenKey of ["radius", "radiusX", "radiusY", "length", "width", "height", "offset"]) {
          if (e.type !== "rectangle" && Number.isFinite(e[lenKey])) out[lenKey] = e[lenKey] * scale
        }
        return out
      })
    }

    const result: any = { ...raw, coordinateSpace: "mm" }

    if (Array.isArray(raw.views)) {
      result.views = raw.views.map((v: any) => {
        const bounds = this.validBounds(v.bounds) || this.pxBBoxOfEntities(v.entities || [])
        if (!bounds) return v
        const converted = { ...v, entities: convertEntities(v.entities, bounds) }
        delete converted.bounds
        return converted
      })
    }

    if (Array.isArray(raw.entities)) {
      const primaryView = (result.views || []).find((v: any) => v.name === "flat_pattern" || v.name === "front") || (result.views || [])[0]
      const rawPrimary = (raw.views || []).find((v: any) => v.name === primaryView?.name) || raw.views?.[0]
      const bounds = this.validBounds(rawPrimary?.bounds) || this.pxBBoxOfEntities(raw.entities) || [0, 0, 1, 1]
      result.entities = convertEntities(raw.entities, bounds)
    }

    return result
  }

  private validBounds(b: any): [number, number, number, number] | null {
    if (Array.isArray(b) && b.length === 4 && b.every((v: any) => Number.isFinite(Number(v)))) {
      return [Number(b[0]), Number(b[1]), Number(b[2]), Number(b[3])]
    }
    return null
  }

  private scaleSanityCheck(geom: PlanGeometry, warnings: string[]): void {
    const dims = geom.dimensions
    if (!dims || !(dims.width > 0) || !(dims.height > 0)) return

    const bbox = this.pxBBoxOfEntities(geom.entities)
    if (!bbox) return
    const extX = bbox[2] - bbox[0]
    const extY = bbox[3] - bbox[1]
    if (extX <= 0 || extY <= 0) return

    const errX = Math.abs(extX - dims.width) / dims.width
    const errY = Math.abs(extY - dims.height) / dims.height

    if (errX > 0.35 && errY > 0.35) {
      const fixX = dims.width / extX
      const fixY = dims.height / extY
      const fix = (fixX + fixY) / 2
      this.rescaleGeometry(geom, fix)
      warnings.push(`Escala corregida automáticamente (×${fix.toFixed(3)}) para coincidir con las dimensiones acotadas ${dims.width}×${dims.height}mm.`)
    } else if (errX > 0.15 || errY > 0.15) {
      warnings.push(`Discrepancia moderada entre geometría (${extX.toFixed(1)}×${extY.toFixed(1)}mm) y cotas (${dims.width}×${dims.height}mm). Verifica las medidas.`)
    }
  }

  private rescaleGeometry(geom: PlanGeometry, factor: number): void {
    const scaleEntity = (e: any) => {
      for (const key of ["start", "end", "center", "position"]) {
        if (Array.isArray(e[key])) e[key] = [e[key][0] * factor, e[key][1] * factor]
      }
      if (Array.isArray(e.points)) e.points = e.points.map((p: number[]) => [p[0] * factor, p[1] * factor])
      if (e.type === "rectangle") { e.x *= factor; e.y *= factor }
      for (const lenKey of ["radius", "radiusX", "radiusY", "length", "width", "height", "offset"]) {
        if (Number.isFinite(e[lenKey])) e[lenKey] *= factor
      }
    }
    geom.entities.forEach(scaleEntity)
    geom.views?.forEach(v => v.entities.forEach(scaleEntity))
  }

  // ─── Validación ────────────────────────────────────────────────────────────

  private hasOutline(geom: PlanGeometry): boolean {
    return geom.entities.some(e =>
      (e.type === "polyline" && e.closed) || e.type === "rectangle" ||
      (e.type === "line" && e.layer === "CUT")
    )
  }

  private validateGeometry(geom: PlanGeometry, detections: Detections, calibration: Calibration): string[] {
    const issues: string[] = []
    const entities = geom.entities

    if (entities.length === 0) {
      issues.push("No entities were extracted at all.")
      return issues
    }

    if (!this.hasOutline(geom)) {
      issues.push("Missing OUTER OUTLINE: there is no closed polyline, rectangle or cut line forming the part boundary. Add it (layer CUT).")
    }

    const cutEntities = entities.filter(e => e.layer === "CUT" || (!e.layer && !["fold", "dimension", "text"].includes(e.type)))
    if (cutEntities.length === 0) {
      issues.push("No CUT-layer entities found. The part boundary and holes must be on layer CUT.")
    }

    const allZero = entities.every(e => {
      if ("start" in e && "end" in e) {
        const s = (e as any).start; const en = (e as any).end
        return s?.[0] === 0 && s?.[1] === 0 && en?.[0] === 0 && en?.[1] === 0
      }
      if ("center" in e) {
        const c = (e as any).center
        return c?.[0] === 0 && c?.[1] === 0
      }
      return false
    })
    if (allZero) issues.push("All coordinates are (0,0) — geometry is degenerate.")

    if (detections.circles && detections.circles.items.length > 0 && calibration.scaleMmPerPx > 0) {
      const s = calibration.scaleMmPerPx
      const bbox = this.pxBBoxOfEntities(geom.entities)
      const holeCount = entities.filter(e => e.type === "circle").length

      if (bbox) {
        const inside = detections.circles.items.filter(c => {
          const rMm = c.r * s
          return rMm >= 0.5 && rMm <= 100
        })
        if (inside.length >= 1 && holeCount === 0) {
          issues.push(`OpenCV detected ${inside.length} circle(s) that look like holes but the geometry has NONE. Add the missing circle entities.`)
        } else if (inside.length - holeCount >= 2) {
          issues.push(`OpenCV detected ~${inside.length} circular holes but the geometry only has ${holeCount}. Add the missing circles (one entity per hole, patterns included).`)
        }
      }
    }

    const foldIssue = this.foldConsistencyIssue(geom)
    if (foldIssue) issues.push(foldIssue)

    return issues
  }

  private foldConsistencyIssue(geom: PlanGeometry): string | null {
    if (!geom.views || geom.views.length < 2) return null

    const flatPattern = geom.views.find(v => v.name === "flat_pattern" || v.name === "front")
    if (!flatPattern) return null

    const flatFoldCount = flatPattern.entities.filter(e => e.type === "fold").length
    if (flatFoldCount === 0) return null

    for (const view of geom.views) {
      if (view.name === flatPattern.name) continue
      const viewFolds = view.entities.filter(e => e.type === "fold").length
      if (viewFolds > flatFoldCount) {
        return `Fold mismatch: view "${view.name}" has ${viewFolds} fold lines but the flat pattern has ${flatFoldCount}. Add the missing fold lines to the flat pattern.`
      }
      const polylines = view.entities.filter(e => e.type === "polyline" && e.layer === "CUT")
      for (const pl of polylines) {
        const points = (pl as any).points as [number, number][] | undefined
        if (!points) continue
        const segmentCount = points.length - 1
        const impliedFolds = Math.floor(segmentCount / 2)
        if (segmentCount >= 3 && impliedFolds > flatFoldCount) {
          return `Fold mismatch: the profile view "${view.name}" is a bent profile with ${segmentCount} segments (≈${impliedFolds} bends) but the flat pattern only has ${flatFoldCount} fold lines. Add the missing folds.`
        }
      }
    }
    return null
  }

  private async repairGeometry(
    geometry: PlanGeometry,
    issues: string[],
    detections: Detections,
    calibration: Calibration,
    warnings: string[],
  ): Promise<PlanGeometry | null> {
    const userContent =
      `VALIDATION ISSUES TO FIX:\n${issues.map((i, n) => `${n + 1}. ${i}`).join("\n")}\n\n` +
      `SCALE: 1 px = ${calibration.scaleMmPerPx} mm (${calibration.note}).\n\n` +
      `OPENCV DETECTION DATA (pixel space):\n${this.detectionsToJson(detections)}\n\n` +
      `CURRENT GEOMETRY (mm):\n${JSON.stringify(geometry, null, 1)}\n\n` +
      `Return the COMPLETE corrected geometry JSON with "coordinateSpace": "mm".`

    try {
      const response = await this.openai.chat.completions.create(this.buildChatRequest({
        model: this.TEXT_MODEL,
        messages: [
          { role: "system", content: this.REPAIR_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        maxTokens: 16384,
        effort: this.ITERATE_EFFORT,
        temperature: 0.1,
      }))

      const content = response.choices[0]?.message?.content || ""
      if (!content || this.isRefusal(content)) return null
      const parsed = JSON.parse(this.cleanJsonResponse(content))
      return this.normalizeGeometry(parsed)
    } catch (err: any) {
      warnings.push(`La reparación automática falló: ${err.message}`)
      return null
    }
  }

  private buildMeta(calibration: Calibration, warnings: string[], remainingIssues: string[]) {
    return {
      model: this.VISION_MODEL,
      scaleMmPerPx: calibration.scaleMmPerPx,
      calibrationNote: calibration.note,
      warnings: [...warnings, ...remainingIssues.map(i => `Pendiente: ${i}`)],
    }
  }

  // ─── Utilidades ────────────────────────────────────────────────────────────

  private friendlyModelError(err: any): Error {
    const code = err?.code || err?.error?.code
    if (code === "model_not_found" || err?.status === 404) {
      return new Error(`El modelo "${this.VISION_MODEL}" no está disponible en tu cuenta de OpenAI. Ajusta OPENAI_VISION_MODEL en el .env (p.ej. gpt-5.6-terra, gpt-5.6-sol o gpt-4o).`)
    }
    if (err?.status === 401) {
      return new Error("La API key de OpenAI no es válida. Revisa OPENAI_API_KEY en el .env.")
    }
    return err
  }

  private assignLayers(geom: PlanGeometry): void {
    const normalizeEntities = (entities: Entity[]) => {
      for (const e of entities) {
        if (!e.layer) {
          switch (e.type) {
            case "fold":
              e.layer = "FOLD"
              break
            case "dimension":
              e.layer = "DIM"
              break
            case "text":
              e.layer = "ETCH"
              break
            default:
              e.layer = "CUT"
          }
        }
      }
    }

    normalizeEntities(geom.entities)
    if (geom.views) {
      for (const view of geom.views) {
        normalizeEntities(view.entities)
      }
    }
  }

  private isRefusal(content: string): boolean {
    const lower = content.toLowerCase()
    return lower.includes("i can't assist") || lower.includes("i cannot assist") ||
      lower.includes("i'm sorry") || lower.includes("i am sorry") ||
      lower.includes("i can not") || lower.includes("unable to")
  }

  private parseGeometryResponse(content: string): PlanGeometry {
    if (!content || this.isRefusal(content)) {
      throw new Error("La IA no pudo procesar esta imagen. Intenta con una imagen más clara del plano.")
    }
    const cleaned = this.cleanJsonResponse(content)
    try {
      const parsed = JSON.parse(cleaned)
      return this.normalizeGeometry(parsed)
    } catch (err) {
      throw new Error(`La IA respondió en un formato inesperado. Intenta subir la imagen nuevamente. (Detalle: ${err})`)
    }
  }

  private cleanJsonResponse(content: string): string {
    let cleaned = content.trim()
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7)
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3)
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3)
    }
    return cleaned.trim()
  }

  private isValidEntity(e: Entity): boolean {
    try {
      switch (e.type) {
        case "line":
          return Array.isArray(e.start) && Array.isArray(e.end) &&
            e.start.length === 2 && e.end.length === 2 &&
            e.start.every((v: number) => isFinite(v)) && e.end.every((v: number) => isFinite(v))
        case "circle":
          return Array.isArray(e.center) && e.center.length === 2 &&
            isFinite(e.center[0]) && isFinite(e.center[1]) && e.radius > 0 && isFinite(e.radius)
        case "arc":
          return Array.isArray(e.center) && e.center.length === 2 &&
            isFinite(e.center[0]) && isFinite(e.center[1]) &&
            e.radius > 0 && isFinite(e.radius) &&
            isFinite(e.startAngle) && isFinite(e.endAngle)
        case "polyline":
          return Array.isArray(e.points) && e.points.length >= 2 &&
            e.points.every((p: number[]) => Array.isArray(p) && p.length === 2 && p.every((v: number) => isFinite(v)))
        case "rectangle":
          return isFinite(e.x) && isFinite(e.y) && e.width > 0 && e.height > 0 &&
            isFinite(e.width) && isFinite(e.height)
        case "slot":
          return Array.isArray(e.center) && e.center.length === 2 &&
            e.length > 0 && e.width > 0 && isFinite(e.length) && isFinite(e.width) &&
            e.length >= e.width
        case "ellipse":
          return Array.isArray(e.center) && e.center.length === 2 &&
            e.radiusX > 0 && e.radiusY > 0
        case "fold":
          return Array.isArray(e.start) && Array.isArray(e.end) &&
            e.start.length === 2 && e.end.length === 2
        case "text":
          return Array.isArray(e.position) && e.position.length === 2 && typeof e.text === "string"
        case "dimension":
          return Array.isArray(e.start) && Array.isArray(e.end)
        default:
          return false
      }
    } catch {
      return false
    }
  }

  private normalizeEntity(e: any): Entity {
    switch (e.type) {
      case "line":
        return { type: "line", start: e.start, end: e.end, layer: e.layer }
      case "circle":
        return { type: "circle", center: e.center, radius: e.radius, layer: e.layer }
      case "arc":
        return { type: "arc", center: e.center, radius: e.radius, startAngle: e.startAngle, endAngle: e.endAngle, layer: e.layer }
      case "polyline":
        return { type: "polyline", points: e.points, closed: e.closed ?? false, layer: e.layer }
      case "rectangle":
        return { type: "rectangle", x: e.x, y: e.y, width: e.width, height: e.height, layer: e.layer }
      case "slot":
        return { type: "slot", center: e.center, length: e.length, width: e.width, angle: e.angle ?? 0, layer: e.layer }
      case "ellipse":
        return { type: "ellipse", center: e.center, radiusX: e.radiusX, radiusY: e.radiusY, angle: e.angle ?? 0, layer: e.layer }
      case "fold":
        return { type: "fold", start: e.start, end: e.end, angle: e.angle ?? 90, direction: e.direction ?? "up", layer: e.layer ?? "FOLD" }
      case "text":
        return { type: "text", position: e.position, text: e.text, height: e.height ?? 5, angle: e.angle ?? 0, layer: e.layer ?? "TEXT" }
      case "dimension":
        return { type: "dimension", start: e.start, end: e.end, offset: e.offset ?? 10, text: e.text, layer: e.layer ?? "DIM" }
      default:
        return e
    }
  }

  private normalizeView(v: any): ViewGeometry {
    return {
      name: v.name || "front",
      label: v.label || v.name || "Vista",
      entities: (v.entities || []).map(this.normalizeEntity.bind(this)).filter(this.isValidEntity.bind(this)),
      dimensions: v.dimensions || { width: 0, height: 0 },
    }
  }

  private normalizeGeometry(parsed: any): PlanGeometry {
    const entities: Entity[] = (parsed.entities || []).map(this.normalizeEntity.bind(this)).filter(this.isValidEntity.bind(this))
    const views: ViewGeometry[] = (parsed.views || []).map(this.normalizeView.bind(this)).filter((v: ViewGeometry) => v.entities.length > 0)

    const flatPattern = views.find(v => {
      const name = (v.name || "").toLowerCase()
      const label = (v.label || "").toLowerCase()
      return name === "flat_pattern" ||
        name.includes("flat") || name.includes("pattern") || name.includes("despleg") ||
        label.includes("flat") || label.includes("pattern") || label.includes("despleg") ||
        label.includes("plano")
    }) || views[0]

    if (views.length === 0 && entities.length > 0) {
      views.push({
        name: "flat_pattern",
        label: "Patrón Plano",
        entities,
        dimensions: parsed.dimensions || { width: 0, height: 0 },
      })
    } else if (flatPattern) {
      if (entities.length === 0 || entities.length !== flatPattern.entities.length) {
        entities.length = 0
        entities.push(...flatPattern.entities)
      }
    }

    return {
      units: parsed.units || "mm",
      views,
      entities,
      dimensions: parsed.dimensions || { width: 0, height: 0 },
      notes: parsed.notes || "",
      material: parsed.material,
      bendRadius: parsed.bendRadius,
    }
  }

}
