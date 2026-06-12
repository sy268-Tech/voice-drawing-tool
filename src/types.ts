/* ── 核心类型定义 ── */

export type ShapeType =
  | "circle"
  | "rect"
  | "line"
  | "triangle"
  | "text"
  | "star"
  | "ellipse"
  | "arrow"
  | "diamond"
  | "heart"
  | "arc"
  | "hexagon"
  | "cloud";

export type Action =
  | "draw"
  | "move"
  | "resize"
  | "recolor"
  | "undo"
  | "clear"
  | "delete";

export type Drawable = {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text?: string;
  /** 线条终点 */
  x2?: number;
  y2?: number;
};

export type Command = {
  action: Action;
  shape?: ShapeType;
  color?: string;
  position?: string;
  size?: string;
  text?: string;
  ordinal?: number;
};
