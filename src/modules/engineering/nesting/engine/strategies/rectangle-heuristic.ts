import {
  applyToOutline,
  boundingRect,
  compose,
  inflateRect,
  rectCenter,
  rectsOverlap,
  rotateAround,
  scaleUniform,
  translate,
  IDENTITY,
  type Transform2D,
} from "../geometry";
import {
  extractSolidWithHoles,
  pointInPolygon,
  type SolidWithHoles,
} from "../polygon-collision";
import type {
  NestedSheet,
  NestingOptions,
  NestingPiece,
  NestingStrategy,
  PieceOutline,
  PlacedPiece,
  Rect,
} from "../types";

interface RotationVariant {
  angle: number;
  outline: PieceOutline;
  bounds: Rect;
  transform: Transform2D;
}

function rotationAnglesFor(options: NestingOptions): number[] {
  const mode = options.rotationMode ?? "0-90-180-270";
  if (mode === "ninguna") return [0];
  return [0, 90, 180, 270];
}

function placePiece(
  piece: NestingPiece,
  variant: RotationVariant,
  x: number,
  y: number
): PlacedPiece {
  const finalTransform = compose(variant.transform, translate(x, y));
  return {
    pieceId: piece.id,
    x,
    y,
    angle: variant.angle,
    outline: applyToOutline(finalTransform, piece.outline),
    subEntities: piece.subEntities?.map((sub) => ({
      outline: applyToOutline(finalTransform, sub.outline),
      color: sub.color,
      layer: sub.layer,
    })),
    color: piece.color,
  };
}

/**
 * Heurística original (C++/AABB) restaurada:
 * bottom-left con paso adaptativo + salto en Y al colisionar.
 * Más densos que solo "esquinas", sigue siendo barato (AABB).
 *
 * Además: intento de nesting en calados (huecos) antes del outer.
 */
export class RectangleHeuristicStrategy implements NestingStrategy {
  optimize(inputPieces: NestingPiece[], options: NestingOptions): NestedSheet[] {
    const { sheet, signal, onProgress } = options;
    const sheets: NestedSheet[] = [];
    const sheetSolids: SolidWithHoles[][] = [];
    const separation = Math.max(0, options.separation ?? 0);
    // Solo la separación entre piezas. El margen de plancha NO debe
    // meterse como gap inter-pieza (antes margin/2 dejaba ~margen mm
    // entre piezas aunque separacion=0).
    const pad = separation / 2;

    const pieces = inputPieces.flatMap((p) =>
      Array.from({ length: p.quantity ?? 1 }, () => p)
    );
    if (pieces.length === 0) return sheets;

    const sorted = [...pieces].sort((a, b) => {
      const boxA = boundingRect(a.outline);
      const boxB = boundingRect(b.outline);
      return boxB.width * boxB.height - boxA.width * boxA.height;
    });

    const usableWidth = sheet.width - 2 * sheet.margin;
    const usableHeight = sheet.height - 2 * sheet.margin;
    const limitX = sheet.width - sheet.margin;
    const limitY = sheet.height - sheet.margin;
    const angles = rotationAnglesFor(options);

    // Paso de búsqueda: adaptativo a la pieza más chica / plancha (rápido y denso)
    const autoStep = Math.min(
      8,
      Math.max(1.5, Math.min(usableWidth, usableHeight) / 120)
    );
    const searchStep = options.searchStep ?? autoStep;

    for (let i = 0; i < sorted.length; i++) {
      if (signal?.cancelled) break;
      onProgress?.(i / Math.max(1, sorted.length));

      const piece = sorted[i];
      let outline = piece.outline;
      let bounds = boundingRect(outline);
      let center = rectCenter(bounds);
      let scaleTransform: Transform2D = IDENTITY;

      const fitsNormal =
        bounds.width <= usableWidth + 0.1 && bounds.height <= usableHeight + 0.1;
      const fitsRotated =
        bounds.height <= usableWidth + 0.1 && bounds.width <= usableHeight + 0.1;

      if (!fitsNormal && !fitsRotated) {
        const scaleNormal = Math.min(
          usableWidth / bounds.width,
          usableHeight / bounds.height
        );
        const scaleRotated = Math.min(
          usableWidth / bounds.height,
          usableHeight / bounds.width
        );
        const scaleFactor = Math.max(scaleNormal, scaleRotated) * 0.99;
        scaleTransform = scaleUniform(scaleFactor);
        outline = applyToOutline(scaleTransform, outline);
        bounds = boundingRect(outline);
        center = rectCenter(bounds);
      }

      const variants: RotationVariant[] = angles.map((angle) => {
        const rotTransform = rotateAround(center, angle);
        const rotated = applyToOutline(rotTransform, outline);
        const rBounds = boundingRect(rotated);
        const alignTransform = translate(-rBounds.x, -rBounds.y);
        const aligned = applyToOutline(alignTransform, rotated);
        const fullTransform = compose(
          compose(scaleTransform, rotTransform),
          alignTransform
        );
        return {
          angle,
          outline: aligned,
          bounds: boundingRect(aligned),
          transform: fullTransform,
        };
      });

      variants.sort((a, b) => {
        if (Math.abs(a.bounds.width - b.bounds.width) > 0.1) {
          return a.bounds.width - b.bounds.width;
        }
        return a.bounds.height - b.bounds.height;
      });

      let placed = false;

      // ── A) Calados: grilla gruesa dentro del bbox del hueco ───────────
      for (let si = 0; si < sheets.length && !placed; si++) {
        if (signal?.cancelled) break;
        const solids = sheetSolids[si];
        for (let hi = 0; hi < solids.length && !placed; hi++) {
          const host = solids[hi];
          for (const hole of host.holes) {
            if (placed || hole.length < 3) continue;
            const hb = boundingRect({ points: hole });
            if (hb.width < 2 || hb.height < 2) continue;

            for (const variant of variants) {
              if (placed) break;
              if (
                variant.bounds.width > hb.width - 0.5 ||
                variant.bounds.height > hb.height - 0.5
              ) {
                continue;
              }

              // Paso dentro del hueco: no más fino de lo necesario
              const holeStep = Math.max(
                searchStep,
                Math.min(variant.bounds.width, variant.bounds.height) * 0.25
              );

              for (
                let x = hb.x;
                x <= hb.x + hb.width - variant.bounds.width + 0.001 && !placed;
                x += holeStep
              ) {
                for (
                  let y = hb.y;
                  y <= hb.y + hb.height - variant.bounds.height + 0.001 && !placed;
                  y += holeStep
                ) {
                  if (x < sheet.margin - 0.001 || y < sheet.margin - 0.001) continue;
                  if (x + variant.bounds.width > limitX + 0.001) continue;
                  if (y + variant.bounds.height > limitY + 0.001) continue;

                  // Centro + esquinas del AABB dentro del hueco
                  const pts = [
                    { x: x + variant.bounds.width / 2, y: y + variant.bounds.height / 2 },
                    { x, y },
                    { x: x + variant.bounds.width, y },
                    { x: x + variant.bounds.width, y: y + variant.bounds.height },
                    { x, y: y + variant.bounds.height },
                  ];
                  if (!pts.every((p) => pointInPolygon(p, hole))) continue;

                  // No chocar con otras piezas (el host se ignora: estamos en su hueco)
                  const testRect = inflateRect(
                    {
                      x,
                      y,
                      width: variant.bounds.width,
                      height: variant.bounds.height,
                    },
                    pad
                  );
                  let clash = false;
                  for (let oi = 0; oi < sheets[si].pieces.length; oi++) {
                    if (oi === hi) continue;
                    const ob = inflateRect(
                      boundingRect(sheets[si].pieces[oi].outline),
                      pad
                    );
                    if (rectsOverlap(testRect, ob)) {
                      clash = true;
                      break;
                    }
                  }
                  if (clash) continue;

                  const pp = placePiece(piece, variant, x, y);
                  sheets[si].pieces.push(pp);
                  sheetSolids[si].push(
                    extractSolidWithHoles(pp.outline, pp.subEntities)
                  );
                  placed = true;
                }
              }
            }
          }
        }
      }

      // ── B) Outer: candidatos en bordes (BLF) + grilla + snap al contacto ──
      // Los candidatos en aristas de piezas ya colocadas eliminan el "aire"
      // de la grilla gruesa cuando separation=0.
      for (let si = 0; si < sheets.length && !placed; si++) {
        if (signal?.cancelled) break;

        const placedBounds = sheets[si].pieces.map((p) =>
          inflateRect(boundingRect(p.outline), pad)
        );

        const collidesAt = (x: number, y: number, w: number, h: number): boolean => {
          if (x < sheet.margin - 0.001 || y < sheet.margin - 0.001) return true;
          if (x + w > limitX + 0.001 || y + h > limitY + 0.001) return true;
          const test = inflateRect({ x, y, width: w, height: h }, pad);
          for (const pr of placedBounds) {
            if (rectsOverlap(test, pr)) return true;
          }
          return false;
        };

        /** Empuja a la izquierda y abajo hasta el contacto (sin solapar). */
        /**
         * Empuja a la izquierda y abajo hasta el contacto (sin solapar).
         *
         * Antes esto empujaba en X UNA vez y en Y UNA vez, sin volver a
         * intentar X después de mover Y. Al bajar en Y la pieza puede
         * quedar frente a un obstáculo distinto que sí permite empujarla
         * más a la izquierda — sin repetir el pase, la pieza se queda en
         * una posición "suficientemente buena" pero no la más ajustada,
         * dejando huecos entre piezas que en realidad podrían tocarse.
         * Ahora se repite X→Y hasta que ninguno de los dos mueve más
         * (convergencia), con un tope de iteraciones por seguridad.
         */
        const snapTight = (
          x0: number,
          y0: number,
          w: number,
          h: number,
        ): { x: number; y: number } => {
          let x = x0;
          let y = y0;

          for (let pass = 0; pass < 6; pass++) {
            const prevX = x;
            const prevY = y;

            // Snap -X
            let lo = sheet.margin;
            let hi = x;
            for (let it = 0; it < 24; it++) {
              if (hi - lo < 0.02) break;
              const mid = (lo + hi) / 2;
              if (collidesAt(mid, y, w, h)) lo = mid;
              else hi = mid;
            }
            x = hi;

            // Snap -Y
            lo = sheet.margin;
            hi = y;
            for (let it = 0; it < 24; it++) {
              if (hi - lo < 0.02) break;
              const mid = (lo + hi) / 2;
              if (collidesAt(x, mid, w, h)) lo = mid;
              else hi = mid;
            }
            y = hi;

            // Convergió: ni X ni Y se movieron en este pase.
            if (Math.abs(x - prevX) < 0.02 && Math.abs(y - prevY) < 0.02) break;
          }

          return { x, y };
        };

        // Candidatos: origen + borde derecho / superior de cada pieza colocada
        const xCand: number[] = [sheet.margin];
        const yCand: number[] = [sheet.margin];
        for (const pr of placedBounds) {
          xCand.push(pr.x + pr.width);
          yCand.push(pr.y + pr.height);
        }
        // Orden bottom-left: primero Y chica, luego X chica
        const pairs: { x: number; y: number }[] = [];
        for (const y of yCand) {
          for (const x of xCand) {
            pairs.push({ x, y });
          }
        }
        pairs.sort((a, b) => (a.y - b.y) || (a.x - b.x));

        for (const { x: cx, y: cy } of pairs) {
          if (placed || signal?.cancelled) break;
          for (const variant of variants) {
            if (cx + variant.bounds.width > limitX + 0.001) continue;
            if (cy + variant.bounds.height > limitY + 0.001) continue;
            if (collidesAt(cx, cy, variant.bounds.width, variant.bounds.height)) continue;
            const s = snapTight(cx, cy, variant.bounds.width, variant.bounds.height);
            if (collidesAt(s.x, s.y, variant.bounds.width, variant.bounds.height)) continue;
            const pp = placePiece(piece, variant, s.x, s.y);
            sheets[si].pieces.push(pp);
            sheetSolids[si].push(
              extractSolidWithHoles(pp.outline, pp.subEntities)
            );
            placed = true;
            break;
          }
        }

        // Fallback grilla (planchas grandes / huecos raros) + snap
        if (!placed) {
          for (
            let x = sheet.margin;
            x <= limitX + 0.001 && !placed;
            x += searchStep
          ) {
            let y = sheet.margin;
            while (y <= limitY + 0.001 && !placed) {
              if (signal?.cancelled) break;
              let minSafeYJump = limitY;
              let variantPlaced = false;

              for (const variant of variants) {
                if (x + variant.bounds.width > limitX + 0.001) continue;
                if (y + variant.bounds.height > limitY + 0.001) continue;

                const testRectPadded = inflateRect(
                  { x, y, width: variant.bounds.width, height: variant.bounds.height },
                  pad,
                );
                let collision = false;
                let collisionYJump = 0;
                for (const placedRect of placedBounds) {
                  if (rectsOverlap(testRectPadded, placedRect)) {
                    collision = true;
                    const jump =
                      placedRect.y + placedRect.height - testRectPadded.y;
                    if (jump > collisionYJump) collisionYJump = jump;
                  }
                }
                if (!collision) {
                  const s = snapTight(
                    x,
                    y,
                    variant.bounds.width,
                    variant.bounds.height,
                  );
                  const pp = placePiece(piece, variant, s.x, s.y);
                  sheets[si].pieces.push(pp);
                  sheetSolids[si].push(
                    extractSolidWithHoles(pp.outline, pp.subEntities)
                  );
                  placed = true;
                  variantPlaced = true;
                  break;
                } else if (collisionYJump > 0 && collisionYJump < minSafeYJump) {
                  minSafeYJump = collisionYJump;
                }
              }

              if (variantPlaced) break;
              if (minSafeYJump >= limitY - y) break;
              y += Math.max(searchStep, minSafeYJump);
            }
          }
        }
      }

      // ── C) Nueva plancha ─────────────────────────────────────────────
      if (!placed) {
        let bestVariant = variants[0];
        for (const variant of variants) {
          if (
            variant.bounds.width <= usableWidth + 0.1 &&
            variant.bounds.height <= usableHeight + 0.1
          ) {
            bestVariant = variant;
            break;
          }
        }
        const first = placePiece(piece, bestVariant, sheet.margin, sheet.margin);
        sheets.push({ pieces: [first] });
        sheetSolids.push([
          extractSolidWithHoles(first.outline, first.subEntities),
        ]);
      }
    }

    onProgress?.(1);
    return sheets;
  }
}