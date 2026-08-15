# Nesting engine — autoridad en backend

- `optimize()` y strategies viven **solo** aquí.
- Front: tipos DTO + canvas math (drag). No pack.
- Baseline: puerto de `AI-Nesting/NestingEngine.cpp` (AABB + salto Y).
- PATH B: multi-start de órdenes en `optimize.ts` (fast).
- Precise: `PolygonPackingStrategy`.
- CAD parse completo en front es legado; preferir upload → back cuando se migre.
