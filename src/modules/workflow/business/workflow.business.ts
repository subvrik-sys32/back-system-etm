import { ProcessCode } from "@/shared/types/process-code"

export const WORKFLOW_BUSINESS = {
  CT: {
    requiredFields: ["piecesOutput", "plRtReal"],
    next: "PL",
  },

  PL: {
    requiredFields: ["piecesOutput"],
    next: "SD",
  },

  SD: {
    requiredFields: ["piecesOutput"],
    next: "PT",
  },

  PT: {
    requiredFields: ["piecesOutput", "paintKgReal"],
    next: "EN",
  },

  EN: {
    requiredFields: ["piecesOutput"],
    next: "DS",
  },

  DS: {
    requiredFields: ["piecesOutput"],
    next: null,
  },
} as const