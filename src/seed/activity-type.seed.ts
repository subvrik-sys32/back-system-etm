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
  },

  {
    code: "LIMPIEZA",
    label: "Limpieza",
    icon: "quality",
    color: "#0EA5E9",
    order: 1,
  },

  {
    code: "MANTENIMIENTO",
    label: "Mantenimiento de máquina",
    icon: "tool",
    color: "#F59E0B",
    order: 2,
  },

  {
    code: "CAPACITACION",
    label: "Capacitación",
    icon: "users",
    color: "#8B5CF6",
    order: 3,
  },

  {
    code: "REUNION",
    label: "Reunión",
    icon: "clipboard",
    color: "#6366F1",
    order: 4,
  },

  {
    code: "ESPERA_MATERIAL",
    label: "Espera de material",
    icon: "material",
    color: "#EA580C",
    order: 5,
  },

  {
    code: "DESCANSO",
    label: "Descanso",
    icon: "pause",
    color: "#16A34A",
    order: 6,
  },

  {
    code: "OTRO",
    label: "Otro",
    icon: "circle",
    color: "#64748B",
    order: 7,
  },

]