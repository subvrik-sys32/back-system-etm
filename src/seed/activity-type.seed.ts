// Lista default de "qué puede estar haciendo alguien" en la
// Bitácora — arranca con esto, pero un admin la puede editar
// después desde la app (agregar/renombrar/desactivar tipos, y
// elegir cualquier ícono del catálogo completo vía el mismo
// selector que usa Cliente). Los "icon" de acá son keys reales del
// catálogo compartido (src/shared/constants/entity-icons.ts del
// front), no un set propio inventado.
export const ACTIVITY_TYPES = [

  {
    code: "PRODUCIENDO",
    label: "Produciendo",
    icon: "production",
    color: "#22C55E",
    order: 0,
    pinned: true,
  },

  {
    code: "LIMPIEZA",
    label: "Limpieza",
    icon: "quality",
    color: "#0EA5E9",
    order: 1,
    pinned: false,
  },

  {
    code: "MANTENIMIENTO",
    label: "Mantenimiento de máquina",
    icon: "tool",
    color: "#F59E0B",
    order: 2,
    pinned: true,
  },

  {
    code: "CAPACITACION",
    label: "Capacitación",
    icon: "users",
    color: "#8B5CF6",
    order: 3,
    pinned: false,
  },

  {
    code: "REUNION",
    label: "Reunión",
    icon: "clipboard",
    color: "#6366F1",
    order: 4,
    pinned: false,
  },

  {
    code: "ESPERA_MATERIAL",
    label: "Espera de material",
    icon: "material",
    color: "#EA580C",
    order: 5,
    pinned: false,
  },

  {
    code: "DESCANSO",
    label: "Descanso",
    icon: "pause",
    color: "#16A34A",
    order: 6,
    pinned: false,
  },

  // Tipo fijo para el auto-registro al completar un WorkflowStep
  // (ver ActivityLogService.createFromTaskCompletion). pinned=false
  // porque no tiene sentido que alguien lo elija a mano desde el
  // picker — el sistema es el único que lo usa — pero sigue
  // apareciendo como cualquier otro tipo dentro del historial/"Otros"
  // si alguien quisiera filtrar por él.
  {
    code: "TASK_COMPLETED",
    label: "Tarea completada",
    icon: "check",
    color: "#16A34A",
    order: 99,
    pinned: false,
  },

]

// Bitácora de Ingeniería — mismo motor, 100% manual, sin
// auto-registro (a diferencia de Producción, acá no hay un
// WorkflowStep que "completar"). department se pasa explícito
// porque el default del modelo es PRODUCCION.
export const ENGINEERING_ACTIVITY_TYPES = [

  {
    code: "DISENO",
    label: "Diseño",
    icon: "drafting",
    color: "#6366F1",
    order: 0,
    pinned: true,
    department: "INGENIERIA" as const,
  },

  {
    code: "DETALLADO",
    label: "Detallado",
    icon: "clipboard",
    color: "#0EA5E9",
    order: 1,
    pinned: true,
    department: "INGENIERIA" as const,
  },

  {
    code: "REVISION_PLANOS",
    label: "Revisión de planos",
    icon: "quality",
    color: "#22C55E",
    order: 2,
    pinned: true,
    department: "INGENIERIA" as const,
  },

  {
    code: "REUNION_TECNICA",
    label: "Reunión técnica",
    icon: "users",
    color: "#8B5CF6",
    order: 3,
    pinned: false,
    department: "INGENIERIA" as const,
  },

  {
    code: "SOPORTE_PRODUCCION",
    label: "Soporte a Producción",
    icon: "tool",
    color: "#F59E0B",
    order: 4,
    pinned: false,
    department: "INGENIERIA" as const,
  },

]