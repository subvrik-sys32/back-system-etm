/**
 * Motor de nesting — dominio puro (sin NestJS, sin HTTP).
 * Puerto del engine del frontend; misma API `optimize()`.
 */
export * from './types'
export * from './geometry'
export * from './optimize'
export { sheetUsageRatio } from './sheet-usage'
