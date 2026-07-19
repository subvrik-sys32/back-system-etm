// Lista default de "qué puede estar haciendo alguien" en la
// Bitácora — arranca con esto, pero un admin la puede editar
// después desde la app (agregar/renombrar/desactivar tipos).
export const ACTIVITY_TYPES = [

  {
    code: "PRODUCIENDO",
    label: "Produciendo",
    icon: "hammer",
    color: "#22C55E",
    order: 0,
  },

  {
    code: "LIMPIEZA",
    label: "Limpieza",
    icon: "sparkles",
    color: "#0EA5E9",
    order: 1,
  },

  {
    code: "MANTENIMIENTO",
    label: "Mantenimiento de máquina",
    icon: "wrench",
    color: "#F59E0B",
    order: 2,
  },

  {
    code: "CAPACITACION",
    label: "Capacitación",
    icon: "graduation-cap",
    color: "#8B5CF6",
    order: 3,
  },

  {
    code: "REUNION",
    label: "Reunión",
    icon: "users",
    color: "#6366F1",
    order: 4,
  },

  {
    code: "ESPERA_MATERIAL",
    label: "Espera de material",
    icon: "package",
    color: "#EA580C",
    order: 5,
  },

  {
    code: "DESCANSO",
    label: "Descanso",
    icon: "coffee",
    color: "#16A34A",
    order: 6,
  },

  {
    code: "OTRO",
    label: "Otro",
    icon: "more-horizontal",
    color: "#64748B",
    order: 7,
  },

]