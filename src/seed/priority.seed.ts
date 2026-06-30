import {
  PriorityCode,
} from "@/core/enums/priority-code.enum"

export const PRIORITIES = [

  {
    code:PriorityCode.URGENTE,
    name:"Urgente",
    icon:"urgent",
    color:"#DC2626",
  },

  {
    code:PriorityCode.ALTA,
    name:"Alta",
    icon:"high",
    color:"#EA580C",
  },

  {
    code:PriorityCode.MEDIA,
    name:"Media",
    icon:"medium",
    color:"#EAB308",
  },

  {
    code:PriorityCode.BAJA,
    name:"Baja",
    icon:"low",
    color:"#16A34A",
  },

]