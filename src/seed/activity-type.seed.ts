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

  // Mismo criterio que TASK_COMPLETED pero para el auto-registro al
  // iniciar un WorkflowStep (ver ActivityLogService.createFromTaskStart).
  {
    code: "TASK_STARTED",
    label: "Tarea iniciada",
    icon: "play",
    color: "#0EA5E9",
    order: 98,
    pinned: false,
  },

]

// Bitácora de Ingeniería — mismo motor, 100% manual, sin
// auto-registro (a diferencia de Producción, acá no hay un
// WorkflowStep que "completar"). department se pasa explícito
// porque el default del modelo es PRODUCCION.
//
// Lista independiente del Stage (código separado, no confundir):
// esto es "qué está haciendo la persona ahora mismo" para la
// Bitácora, no la etapa del proyecto. Los code no colisionan con
// los de ACTIVITY_TYPES de arriba porque comparten la misma tabla
// (code es único a nivel global, no por department).
export const ENGINEERING_ACTIVITY_TYPES = [

  {
    code: "DISENO_MECANICO",
    label: "Diseño Mecánico",
    icon: "pencil",
    color: "#2563EB",
    order: 0,
    pinned: true,
    department: "INGENIERIA" as const,
  },

  {
    code: "DISENO_ELECTRICO",
    label: "Diseño Eléctrico",
    icon: "bolt",
    color: "#EAB308",
    order: 1,
    pinned: true,
    department: "INGENIERIA" as const,
  },

  {
    code: "PLANO_MECANICO",
    label: "Plano Mecánico",
    icon: "drafting",
    color: "#3B82F6",
    order: 2,
    pinned: true,
    department: "INGENIERIA" as const,
  },

  {
    code: "PLANO_ELECTRICO",
    label: "Plano Eléctrico",
    icon: "drafting",
    color: "#FACC15",
    order: 3,
    pinned: true,
    department: "INGENIERIA" as const,
  },

  // Antes iban a ser dos ("LM y Geos" + "CAM: Nest y DXF") —
  // fusionadas en una sola a pedido.
  {
    code: "CAM",
    label: "CAM",
    icon: "cog",
    color: "#0EA5E9",
    order: 4,
    pinned: true,
    department: "INGENIERIA" as const,
  },

  // Antes iban a ser dos ("Planos de Doblez" + "Planos de
  // Soldadura") — fusionadas en una sola a pedido.
  {
    code: "PLANOS_FABRICACION",
    label: "Planos de Fabricación",
    icon: "scissors",
    color: "#F97316",
    order: 5,
    pinned: true,
    department: "INGENIERIA" as const,
  },

  {
    code: "LISTA_PROCURA",
    label: "Lista de Procura",
    icon: "boxes",
    color: "#10B981",
    order: 6,
    pinned: true,
    department: "INGENIERIA" as const,
  },

  {
    code: "PRODUCCION",
    label: "Entrega a Producción",
    icon: "factory",
    color: "#22C55E",
    order: 7,
    pinned: true,
    department: "INGENIERIA" as const,
  },

]