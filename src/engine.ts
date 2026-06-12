/* ── 绘图引擎：将指令转为 Drawable 并管理画布状态 ── */

import { Command, Drawable, ShapeType } from "./types";
import { WIDTH, HEIGHT, SIZE_KEYWORDS } from "./constants";
import { parsePosition, parseSize } from "./parser";

/** 生成唯一 ID */
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** 形状默认颜色 */
function defaultColor(type: ShapeType): string {
  switch (type) {
    case "circle": return "#3b82f6";
    case "rect": return "#8b5cf6";
    case "triangle": return "#22c55e";
    case "line": return "#111827";
    case "star": return "#eab308";
    case "ellipse": return "#ec4899";
    case "text": return "#111827";
    // 新增图形默认颜色
    case "arrow": return "#111827";
    case "diamond": return "#22c55e";
    case "heart": return "#ec4899";
    case "arc": return "#3b82f6";
    case "hexagon": return "#a855f7";
    case "cloud": return "#94a3b8";
    default: return "#3b82f6";
  }
}

/** 根据 Command 创建一个新的 Drawable */
function createDrawable(cmd: Command): Drawable {
  const size = parseSize(cmd.size ?? "");
  const pos = parsePosition(cmd.position ?? "");
  const type = cmd.shape ?? "circle";

  // 线条特殊处理
  if (type === "line") {
    return {
      id: uid(),
      type: "line",
      x: pos.x - 60,
      y: pos.y,
      x2: pos.x + 60,
      y2: pos.y,
      width: 120,
      height: 4,
      color: cmd.color ?? "#111827",
    };
  }

  // 箭头：带方向的长线条
  if (type === "arrow") {
    return {
      id: uid(),
      type: "arrow",
      x: pos.x - 80,
      y: pos.y,
      x2: pos.x + 80,
      y2: pos.y,
      width: 160,
      height: 10,
      color: cmd.color ?? "#111827",
    };
  }

  // 弧形：用 width/height 控制弧的水平和垂直半径
  if (type === "arc") {
    return {
      id: uid(),
      type: "arc",
      x: pos.x,
      y: pos.y,
      width: size.width,
      height: size.height / 2,
      color: cmd.color ?? "#3b82f6",
    };
  }

  return {
    id: uid(),
    type,
    x: pos.x,
    y: pos.y,
    width: size.width,
    height: size.height,
    color: cmd.color ?? defaultColor(type),
    text: cmd.text,
  };
}

/** 在匹配图形列表中按序号定位目标 */
function findTarget(shapes: Drawable[], cmd: Command): number {
  const matches: number[] = [];
  for (let i = 0; i < shapes.length; i++) {
    if (!cmd.shape || shapes[i].type === cmd.shape) {
      matches.push(i);
    }
  }
  if (matches.length === 0) return shapes.length - 1; // 没匹配就取最后一个

  const ordinal = cmd.ordinal;
  if (ordinal != null) {
    if (ordinal > 0) return matches[Math.min(ordinal - 1, matches.length - 1)];
    if (ordinal < 0) {
      const idx = matches.length + ordinal;
      return matches[Math.max(idx, 0)];
    }
  }
  return matches[matches.length - 1]; // 默认最后一个
}

/** 核心：将一条 Command 应用到 shapes 数组，返回新的 shapes */
export function applyCommand(shapes: Drawable[], cmd: Command): Drawable[] {
  switch (cmd.action) {
    case "undo":
      return shapes.slice(0, -1);

    case "clear":
      return [];

    case "draw":
      return [...shapes, createDrawable(cmd)];

    case "delete": {
      if (shapes.length === 0) return shapes;
      const idx = findTarget(shapes, cmd);
      return shapes.filter((_, i) => i !== idx);
    }

    case "move": {
      if (shapes.length === 0) return shapes;
      const idx = findTarget(shapes, cmd);
      const pos = parsePosition(cmd.position ?? "");
      return shapes.map((s, i) => (i === idx ? { ...s, x: pos.x, y: pos.y } : s));
    }

    case "resize": {
      if (shapes.length === 0) return shapes;
      const idx = findTarget(shapes, cmd);
      const isShrink = SIZE_KEYWORDS["小"].some((k) => (cmd.size ?? "").includes(k)) ||
                        (cmd.size ?? "").includes("缩");
      const factor = isShrink ? 0.7 : 1.4;
      return shapes.map((s, i) =>
        i === idx
          ? { ...s, width: Math.round(s.width * factor), height: Math.round(s.height * factor) }
          : s
      );
    }

    case "recolor": {
      if (shapes.length === 0 || !cmd.color) return shapes;
      const idx = findTarget(shapes, cmd);
      return shapes.map((s, i) => (i === idx ? { ...s, color: cmd.color! } : s));
    }

    default:
      return shapes;
  }
}
