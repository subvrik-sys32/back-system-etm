import { ProcessCode } from "@prisma/client"

// Las 6 áreas de Producción, una por ProcessCode — son las que ya
// existen como columnas del Kanban de Tareas. Ingeniería (u otro
// departamento futuro) tendrá sus propias filas acá más adelante,
// con processCode en null (ver comentario en el modelo Area del
// schema).
export const AREAS = [

  {
    code: "CORTE",
    label: "Corte",
    processCode: ProcessCode.CT,
  },

  {
    code: "PLEGADO",
    label: "Plegado",
    processCode: ProcessCode.PL,
  },

  {
    code: "SOLDADURA",
    label: "Soldadura",
    processCode: ProcessCode.SD,
  },

  {
    code: "PINTURA",
    label: "Pintura",
    processCode: ProcessCode.PT,
  },

  {
    code: "ENSAMBLE",
    label: "Ensamble",
    processCode: ProcessCode.EN,
  },

  {
    code: "DESPACHO",
    label: "Despacho",
    processCode: ProcessCode.DS,
  },

]