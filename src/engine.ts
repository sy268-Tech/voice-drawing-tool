/* ── 绘图引擎：将指令转为 Drawable 并管理画布状态 ── */

import { Command, Drawable, ShapeType } from "./types";
import { SHRINK_KEYWORDS } from "./constants";
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
    case "arrow": return "#111827";
    case "diamond": return "#22c55e";
    case "heart": return "#ec4899";
    case "arc": return "#3b82f6";
    case "hexagon": return "#a855f7";
    case "cloud": return "#94a3b8";
    default: return "#3b82f6";
  }
}

/** 根据 Command 创建一个新的 Drawable（offset 用于一次画多个时错开排列） */
function createDrawable(cmd: Command, offset = 0): Drawable {
  const size = parseSize(cmd.size ?? "");
  const pos = parsePosition(cmd.position ?? "");
  const type = cmd.shape ?? "circle";
  const dx = offset * (size.width * 0.75 + 24);
  const cx = pos.x + dx;

  // 线条特殊处理
  if (type === "line") {
    return {
      id: uid(), type: "line",
      x: cx - 60, y: pos.y, x2: cx + 60, y2: pos.y,
      width: 120, height: 4,
      color: cmd.color ?? "#111827",
    };
  }

  // 箭头：带方向的长线条
  if (type === "arrow") {
    return {
      id: uid(), type: "arrow",
      x: cx - 80, y: pos.y, x2: cx + 80, y2: pos.y,
      width: 160, height: 10,
      color: cmd.color ?? "#111827",
    };
  }

  // 弧形：用 width/height 控制弧的水平和垂直半径
  if (type === "arc") {
    return {
      id: uid(), type: "arc",
      x: cx, y: pos.y,
      width: size.width, height: size.height / 2,
      color: cmd.color ?? "#3b82f6",
    };
  }

  return {
    id: uid(), type,
    x: cx, y: pos.y,
    width: size.width, height: size.height,
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

/**
 * 核心：将一条 Command 应用到 shapes 数组，返回新的 shapes。
 * 注意：undo/redo 由 App 层的历史栈处理，本函数不再负责。
 */
export function applyCommand(shapes: Drawable[], cmd: Command): Drawable[] {
  switch (cmd.action) {
    case "clear":
      return [];

    case "draw": {
      const n = Math.max(1, cmd.count ?? 1);
      const created: Drawable[] = [];
      // 多个图形以中心为基准左右错开
      const start = -(n - 1) / 2;
      for (let i = 0; i < n; i++) {
        created.push(createDrawable(cmd, start + i));
      }
      return [...shapes, ...created];
    }

    case "delete": {
      if (shapes.length === 0) return shapes;
      const idx = findTarget(shapes, cmd);
      return shapes.filter((_, i) => i !== idx);
    }

    case "move": {
      if (shapes.length === 0) return shapes;
      const idx = findTarget(shapes, cmd);
      const pos = parsePosition(cmd.position ?? "");
      return shapes.map((s, i) => {
        if (i !== idx) return s;
        // 线条/箭头整体平移
        if (s.x2 != null && s.y2 != null) {
          const halfW = (s.x2 - s.x) / 2;
          const halfH = (s.y2 - s.y) / 2;
          return { ...s, x: pos.x - halfW, y: pos.y - halfH, x2: pos.x + halfW, y2: pos.y + halfH };
        }
        return { ...s, x: pos.x, y: pos.y };
      });
    }

    case "resize": {
      if (shapes.length === 0) return shapes;
      const idx = findTarget(shapes, cmd);
      const isShrink = SHRINK_KEYWORDS.some((k) => (cmd.size ?? "").includes(k));
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

    case "rotate": {
      if (shapes.length === 0) return shapes;
      const idx = findTarget(shapes, cmd);
      const deg = cmd.degrees ?? 45;
      return shapes.map((s, i) =>
        i === idx ? { ...s, rotation: ((s.rotation ?? 0) + deg) % 360 } : s
      );
    }

    default:
      return shapes;
  }
}
