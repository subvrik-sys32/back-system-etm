export interface BaseEntity {
  type: string;
  layer?: string;
}

export interface LineEntity extends BaseEntity {
  type: 'line';
  start: [number, number];
  end: [number, number];
}

export interface CircleEntity extends BaseEntity {
  type: 'circle';
  center: [number, number];
  radius: number;
}

export interface ArcEntity extends BaseEntity {
  type: 'arc';
  center: [number, number];
  radius: number;
  startAngle: number;
  endAngle: number;
}

export interface PolylineEntity extends BaseEntity {
  type: 'polyline';
  points: [number, number][];
  closed: boolean;
}

export interface RectangleEntity extends BaseEntity {
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SlotEntity extends BaseEntity {
  type: 'slot';
  center: [number, number];
  length: number;
  width: number;
  angle: number;
}

export interface EllipseEntity extends BaseEntity {
  type: 'ellipse';
  center: [number, number];
  radiusX: number;
  radiusY: number;
  angle: number;
}

export interface FoldEntity extends BaseEntity {
  type: 'fold';
  start: [number, number];
  end: [number, number];
  angle: number;
  direction: 'up' | 'down';
}

export interface TextEntity extends BaseEntity {
  type: 'text';
  position: [number, number];
  text: string;
  height: number;
  angle: number;
}

export interface DimensionEntity extends BaseEntity {
  type: 'dimension';
  start: [number, number];
  end: [number, number];
  offset: number;
  text: string;
}

export type Entity = LineEntity | CircleEntity | ArcEntity | PolylineEntity | RectangleEntity | SlotEntity | EllipseEntity | FoldEntity | TextEntity | DimensionEntity;

export interface ViewGeometry {
  name: string;
  label: string;
  entities: Entity[];
  dimensions: {
    width: number;
    height: number;
    thickness?: number;
  };
}

export interface AnalysisMeta {
  model?: string;
  scaleMmPerPx?: number;
  calibrationNote?: string;
  warnings?: string[];
}

export interface PlanGeometry {
  units: string;
  views: ViewGeometry[];
  entities: Entity[];
  dimensions: {
    width: number;
    height: number;
    thickness?: number;
  };
  notes: string;
  material?: string;
  bendRadius?: number;
  meta?: AnalysisMeta;
}

export interface SkillParameter {
  name: string;
  label: string;
  type: 'number' | 'string';
  default: number | string;
  unit?: string;
}

export interface Skill {
  id: number;
  name: string;
  description: string;
  thumbnail: string | null;
  parameters: SkillParameter[];
  template: PlanGeometry;
  created_at: string;
  updated_at: string;
}
