import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

/* ── types ─────────────────────────────────────────────── */

type ShapeType = "circle" | "rect" | "line" | "text" | "sun" | "tree" | "grass" | "sky" | "dot";
type Action = "draw" | "move" | "resize" | "recolor" | "extend" | "undo" | "clear" | "delete";

type Drawable = {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text?: string;
  x2?: number;  /* 线条终点 x */
  y2?: number;  /* 线条终点 y */
};

type Command = {
  action: Action;
  shape?: ShapeType;
  color?: string;
  position?: string;
  size?: string;
  text?: string;
  target?: string;
  direction?: string;   /* "left"|"right"|"up"|"down"|"up-left"|"up-right"|"down-left"|"down-right" */
  useRef?: boolean;      /* true = 以上一个图形的位置为基准 */
  useLineRadius?: boolean; /* true = 以上一条线的长度为半径画圆 */
  ordinal?: number;      /* 正数=第N个, -1=最后一个, -2=倒数第二个 */
  length?: number;       /* 指定线条/延伸的长度（像素） */
  /* LLM 可直接输出精确坐标，此时优先使用 */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

type LLMConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
};

/* ── constants ─────────────────────────────────────────── */

const WIDTH = 900;
const HEIGHT = 560;

const DEFAULT_LLM_CONFIG: LLMConfig = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  enabled: false,
};

type ProviderPreset = {
  label: string;
  baseUrl: string;
  model: string;
};

const PROVIDER_PRESETS: ProviderPreset[] = [
  { label: "OpenAI — gpt-4o-mini", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { label: "OpenAI — gpt-4o", baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
  { label: "OpenAI — gpt-4-turbo", baseUrl: "https://api.openai.com/v1", model: "gpt-4-turbo" },
  { label: "OpenAI — o3-mini", baseUrl: "https://api.openai.com/v1", model: "o3-mini" },
  { label: "DeepSeek — deepseek-chat (V3)", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { label: "DeepSeek — deepseek-reasoner (R1)", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-reasoner" },
  { label: "DeepSeek — deepseek-v4-pro", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-pro" },
  { label: "阿里百炼 — qwen-plus", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  { label: "阿里百炼 — qwen-max", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-max" },
  { label: "阿里百炼 — qwen-turbo", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-turbo" },
  { label: "智谱GLM — glm-4-flash", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  { label: "智谱GLM — glm-4-plus", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-plus" },
  { label: "Moonshot — moonshot-v1-8k", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  { label: "Ollama 本地 — 自定义", baseUrl: "http://localhost:11434/v1", model: "" },
];

const colorMap: Record<string, string> = {
  红: "#ef4444",
  红色: "#ef4444",
  蓝: "#3b82f6",
  蓝色: "#3b82f6",
  绿: "#22c55e",
  绿色: "#22c55e",
  黄: "#facc15",
  黄色: "#facc15",
  黑: "#111827",
  黑色: "#111827",
  白: "#ffffff",
  白色: "#ffffff",
  紫: "#a855f7",
  紫色: "#a855f7",
  橙: "#f97316",
  橙色: "#f97316",
};

const SYSTEM_PROMPT = `你是一个语音绘图指令解析器。根据用户的自然语言描述，输出结构化的 JSON 绘图指令数组。

## 画布信息
- 尺寸：900×560，原点在左上角
- 中心点：(450, 280)

## 可用图形 (shape)
| shape | 说明 |
|-------|------|
| circle | 圆形 |
| rect   | 矩形 / 方形 |
| line   | 线条 |
| text   | 文字 |
| sun    | 太阳（圆形，默认黄色） |
| tree   | 树（圆形树冠 + 棕色树干） |
| dot    | 点（实心小圆点，半径6px） |
| sky    | 天空背景（横跨顶部的矩形） |
| grass  | 草地背景（横跨底部的矩形） |

## 可用操作 (action)
| action | 说明 |
|--------|------|
| draw   | 绘制新图形 |
| move   | 移动已有图形（需指定 shape 来定位目标） |
| resize  | 缩放已有图形（需指定 shape） |
| recolor | 修改图形颜色（需指定 shape 和 color） |
| extend  | 从上一个图形向指定方向延伸一条线（需 direction） |
| delete  | 删除已有图形（需指定 shape） |
| undo   | 撤销上一步 |
| clear  | 清空整个画布 |

## 位置坐标
| 描述 | x | y |
|------|---|---|
| 左上角 | 160 | 120 |
| 右上角 | 740 | 120 |
| 左下角 | 160 | 440 |
| 右下角 | 740 | 440 |
| 中间 / 中央 | 450 | 280 |
| 上方 | 450 | 120 |
| 下方 | 450 | 440 |
| 左侧 | 160 | 280 |
| 右侧 | 740 | 280 |

## 方向 (direction)
左:left  右:right  上:up  下:down
左上:up-left  右上:up-right  左下:down-left  右下:down-right

## 默认大小
- 普通：width=110, height=110
- 小：width=70, height=70
- 大：width=170, height=170

## 特殊图形默认
- sky：x=450, y=90, width=900, height=180
- grass：x=450, y=490, width=900, height=140
- tree：普通大小，包含树干

## 颜色
红色:#ef4444  蓝色:#3b82f6  绿色:#22c55e  黄色:#facc15
黑色:#111827  白色:#ffffff  紫色:#a855f7  橙色:#f97316
天空默认:#93c5fd  草地默认:#22c55e  树默认:#16a34a

## 序号定位 (ordinal)
用 ordinal 指定第几个匹配图形：1=第一个, 2=第二个, -1=最后一个(默认)
例如删除第一个圆：action:"delete", shape:"circle", ordinal:1

## 输出格式
只输出纯 JSON 数组，不要包含 \`\`\`json 标记，不要任何解释文字。
每个命令对象字段：action, shape(仅 draw/move/resize/delete/recolor 需要), ordinal(可选), x, y, width, height, color(可选), text(仅 text 类型需要)

## 示例
用户："画一个红色圆形"
→ [{"action":"draw","shape":"circle","x":450,"y":280,"width":110,"height":110,"color":"#ef4444"}]

用户："在右上角画一个黄色太阳"
→ [{"action":"draw","shape":"sun","x":740,"y":120,"width":110,"height":110,"color":"#facc15"}]

用户："画蓝色天空和绿色草地"
→ [{"action":"draw","shape":"sky","x":450,"y":90,"width":900,"height":180,"color":"#93c5fd"},{"action":"draw","shape":"grass","x":450,"y":490,"width":900,"height":140,"color":"#22c55e"}]

用户："在中间画一棵大树"
→ [{"action":"draw","shape":"tree","x":450,"y":280,"width":170,"height":170,"color":"#16a34a"}]

用户："把太阳移动到左上角"
→ [{"action":"move","shape":"sun","x":160,"y":120}]

用户："把圆形放大"
→ [{"action":"resize","shape":"circle","size":"大"}]

用户："将蓝色的圆改为黄色"
→ [{"action":"recolor","shape":"circle","color":"#facc15"}]

用户："把太阳的颜色改成红色"
→ [{"action":"recolor","shape":"sun","color":"#ef4444"}]

用户："在中间画一个点"
→ [{"action":"draw","shape":"dot","x":450,"y":280,"color":"#111827"}]

用户："从这个点向右延伸一条线"
→ [{"action":"extend","direction":"right","color":"#111827"}]

用户："以这个点为圆心画一个红色圆形"
→ [{"action":"draw","shape":"circle","color":"#ef4444","useRef":true}]

用户："画一条长度200的线"
→ [{"action":"draw","shape":"line","x":450,"y":280,"length":200,"color":"#111827"}]

用户："从点向右延伸150像素"
→ [{"action":"extend","direction":"right","length":150}]

用户："以这条线为半径画一个红色圆"
→ [{"action":"draw","shape":"circle","color":"#ef4444","useLineRadius":true}]

用户："画一条100像素的线，然后以这条线为半径画圆"
→ [{"action":"draw","shape":"line","x":450,"y":280,"length":100,"color":"#111827"},{"action":"draw","shape":"circle","color":"#3b82f6","useLineRadius":true}]

用户："画一只猫"
→ 尽量用已有图形近似，例如用圆形和文字组合。实在无法处理的返回 [{"action":"draw","shape":"text","x":450,"y":280,"width":110,"height":110,"color":"#111827","text":"🐱"}]。

只输出 JSON 数组。`;

/* ── helpers ───────────────────────────────────────────── */

function speak(text: string) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function uuid() {
  return Math.random().toString(36).slice(2, 10);
}

function getColor(input: string): string | undefined {
  for (const [key, val] of Object.entries(colorMap)) {
    if (input.includes(key)) return val;
  }
  return undefined;
}

function getSize(input: string): { width: number; height: number } {
  if (input.includes("小")) return { width: 70, height: 70 };
  if (input.includes("大")) return { width: 170, height: 170 };
  return { width: 110, height: 110 };
}

function getPosition(input: string): { x: number; y: number } {
  const left = input.includes("左");
  const right = input.includes("右");
  const top = input.includes("上");
  const bottom = input.includes("下");

  let x = WIDTH / 2;
  let y = HEIGHT / 2;

  if (left) x = 160;
  if (right) x = WIDTH - 160;
  if (top) y = 120;
  if (bottom) y = HEIGHT - 120;
  if (input.includes("中间") || input.includes("中央")) {
    x = WIDTH / 2;
    y = HEIGHT / 2;
  }

  return { x, y };
}

function defaultColor(type: ShapeType) {
  if (type === "sun") return "#facc15";
  if (type === "tree") return "#16a34a";
  if (type === "grass") return "#22c55e";
  if (type === "sky") return "#93c5fd";
  if (type === "dot") return "#111827";
  return "#3b82f6";
}

/* ── local parser ──────────────────────────────────────── */

function parseOrdinal(input: string): number | undefined {
  if (input.includes("第一个")) return 1;
  if (input.includes("第二个")) return 2;
  if (input.includes("第三个")) return 3;
  if (input.includes("第四个")) return 4;
  if (input.includes("第五个")) return 5;
  if (input.includes("最后一个") || input.includes("刚才的") || input.includes("刚才那个") || input.includes("上一个")) return -1;
  if (input.includes("倒数第二个")) return -2;
  return undefined;
}

function parseLength(input: string): number | undefined {
  /* "100像素" / "100px" */
  const m1 = input.match(/(\d+)\s*(?:像素|px)/);
  if (m1) return Number(m1[1]);
  /* "长度为100" / "长度100" / "长100" / "线长250" */
  const m2 = input.match(/(?:长度|长为?|长|线长)\s*(\d+)/);
  if (m2) return Number(m2[1]);
  /* "延伸200" / "延伸 200" / "延伸150" */
  const m3 = input.match(/延伸\s*(\d+)/);
  if (m3) return Number(m3[1]);
  /* "一条200的线" / "一条300的直线" */
  const m4 = input.match(/(\d+)\s*(?:的线|的直线)/);
  if (m4) return Number(m4[1]);
  return undefined;
}

function getLineLength(line: Drawable): number {
  const x2 = line.x2 ?? line.x + line.width;
  const y2 = line.y2 ?? line.y;
  return Math.round(Math.sqrt((x2 - line.x) ** 2 + (y2 - line.y) ** 2));
}

function parseDirection(input: string): string | undefined {
  if (input.includes("左下")) return "down-left";
  if (input.includes("左上")) return "up-left";
  if (input.includes("右下")) return "down-right";
  if (input.includes("右上")) return "up-right";
  if (input.includes("左")) return "left";
  if (input.includes("右")) return "right";
  if (input.includes("上")) return "up";
  if (input.includes("下")) return "down";
  return undefined;
}

function parseShape(input: string): ShapeType | undefined {
  if (input.includes("太阳")) return "sun";
  if (input.includes("圆")) return "circle";
  if (input.includes("矩形") || input.includes("方形") || input.includes("正方形")) return "rect";
  if (input.includes("线")) return "line";
  if (input.includes("点")) return "dot";
  if (input.includes("树")) return "tree";
  if (input.includes("草地")) return "grass";
  if (input.includes("天空")) return "sky";
  if (input.includes("文字") || input.includes("写")) return "text";
  return undefined;
}

function parseOneCommand(input: string): Command | null {
  if (input.includes("撤销") || input.includes("返回上一步")) return { action: "undo" };
  if (input.includes("清空") || input.includes("擦掉全部")) return { action: "clear" };
  if (input.includes("删除") || input.includes("删掉") || input.includes("去掉") || input.includes("移除")) {
    const shape = parseShape(input);
    return { action: "delete", shape, ordinal: parseOrdinal(input), color: getColor(input) };
  }

  /* ---- 延伸线：从[这个/那个]点向[方向]画/延伸线 ---- */
  const isExtend =
    (input.includes("延伸") || input.includes("向") && input.includes("画") && input.includes("线")) &&
    !input.includes("移动") && !input.includes("放大") && !input.includes("缩小");
  if (isExtend) {
    const dir = parseDirection(input);
    const len = parseLength(input);
    if (dir) return { action: "extend", direction: dir, length: len, color: getColor(input) };
    /* 没有明确方向但提到了"向...画线"，尝试作为普通线处理 */
    if (input.includes("线")) {
      return { action: "draw", shape: "line", color: getColor(input), position: input, size: input, length: len };
    }
  }

  /* ---- 画点 ---- */
  if ((input.includes("点") && (input.includes("画") || input.includes("标记") || input.includes("标"))) &&
      !input.includes("圆心") && !input.includes("中心")) {
    return { action: "draw", shape: "dot", color: getColor(input), position: input };
  }

  /* 检测改色指令：将X改为Y / 改成 / 换成 / 变成 / 改颜色 / X色改为Y色 */
  const isRecolor =
    (input.includes("改为") || input.includes("改成") || input.includes("换成") ||
     input.includes("变成") || input.includes("颜色")) &&
    !input.includes("移动") && !input.includes("移到") && !input.includes("放大") &&
    !input.includes("缩小") && !input.includes("变大") && !input.includes("变小");

  if (isRecolor) {
    const shape = parseShape(input);
    /* 取"改为/改成/换成/变成"之后的部分来提取新颜色 */
    const verbs = ["改为", "改成", "换成", "变成"];
    let newColorInput = input;
    for (const v of verbs) {
      const idx = input.indexOf(v);
      if (idx >= 0) { newColorInput = input.slice(idx + v.length); break; }
    }
    const newColor = getColor(newColorInput) ?? getColor(input);
    return { action: "recolor", shape, color: newColor, ordinal: parseOrdinal(input), target: input };
  }

  /* 以这条线为半径画圆 */
  if (input.includes("线") && (input.includes("为半径") || input.includes("作为半径")) && (input.includes("圆") || input.includes("画"))) {
    return { action: "draw", shape: "circle", color: getColor(input), useLineRadius: true, size: input };
  }

  /* 以某个点为圆心/中心画圆 */
  if (input.includes("圆心") || input.includes("为中心") || input.includes("为中心点")) {
    return { action: "draw", shape: "circle", color: getColor(input), useRef: true, size: input };
  }

  const isMove = input.includes("移动") || input.includes("移到") || input.includes("放到");
  const isResize = input.includes("变大") || input.includes("放大") || input.includes("变小") || input.includes("缩小");

  const shape = parseShape(input);

  if (isMove) return { action: "move", shape, position: input, ordinal: parseOrdinal(input), target: input };
  if (isResize) return { action: "resize", shape, size: input, ordinal: parseOrdinal(input), target: input };

  /* 默认 draw：必须包含绘图动词，否则是拆分碎片，忽略 */
  if (!/画|绘制|添加|创建|生成/.test(input)) {
    return null;
  }

  return {
    action: "draw",
    shape: shape ?? "circle",
    color: getColor(input),
    position: input,
    size: input,
    length: shape === "line" ? parseLength(input) : undefined,
    text: input.match(/写(.+)/)?.[1]?.trim(),
  };
}

function splitComplexCommand(input: string): string[] {
  return input
    .replace(/，/g, ",")
    .replace(/。/g, ",")
    .replace(/然后/g, ",")
    .replace(/再/g, ",")
    .replace(/和/g, ",")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function createDrawable(command: Command): Drawable {
  /* dot 固定小尺寸 */
  if (command.shape === "dot") {
    const pos =
      command.x != null && command.y != null
        ? { x: command.x, y: command.y }
        : getPosition(command.position ?? "");
    return {
      id: uuid(),
      type: "dot",
      x: pos.x,
      y: pos.y,
      width: 12,
      height: 12,
      color: command.color ?? "#111827",
    };
  }

  /* LLM 可能直接给出精确数值 */
  const size =
    command.width && command.height
      ? { width: command.width, height: command.height }
      : getSize(command.size ?? "");
  const pos =
    command.x != null && command.y != null
      ? { x: command.x, y: command.y }
      : getPosition(command.position ?? "");
  const type = command.shape ?? "circle";

  /* 线条可指定长度 */
  if (type === "line" && command.length) {
    return {
      id: uuid(),
      type: "line",
      x: pos.x,
      y: pos.y,
      x2: pos.x + command.length,
      y2: pos.y,
      width: command.length,
      height: 6,
      color: command.color ?? "#111827",
    };
  }

  if (type === "sky") {
    return {
      id: uuid(),
      type,
      x: command.x ?? WIDTH / 2,
      y: command.y ?? 90,
      width: command.width ?? WIDTH,
      height: command.height ?? 180,
      color: command.color ?? "#93c5fd",
    };
  }

  if (type === "grass") {
    return {
      id: uuid(),
      type,
      x: command.x ?? WIDTH / 2,
      y: command.y ?? HEIGHT - 70,
      width: command.width ?? WIDTH,
      height: command.height ?? 140,
      color: command.color ?? "#22c55e",
    };
  }

  return {
    id: uuid(),
    type,
    x: pos.x,
    y: pos.y,
    width: size.width,
    height: size.height,
    color: command.color ?? defaultColor(type),
    text: command.text,
  };
}

function findTargetIndex(shapes: Drawable[], command: Command): number {
  if (shapes.length === 0) return -1;

  /* 先找出所有匹配的图形索引 */
  const matches: number[] = [];
  for (let i = 0; i < shapes.length; i++) {
    const s = shapes[i];
    let typeMatch = !command.shape || s.type === command.shape ||
      (command.shape === "sun" && s.type === "circle") ||
      (command.shape === "circle" && s.type === "sun");
    /* 颜色筛选（可选） */
    let colorMatch = true;
    if (command.color) {
      /* 用 target 字段中的颜色或直接匹配 */
      const cmdColor = command.color;
      const targetColor = (command.target ? getColor(command.target) : undefined) ?? "";
      const tgt = command.target ?? "";
      colorMatch = s.color === cmdColor || s.color === targetColor ||
        (tgt.includes("蓝") && s.color === "#3b82f6") ||
        (tgt.includes("红") && s.color === "#ef4444") ||
        (tgt.includes("绿") && s.color === "#22c55e") ||
        (tgt.includes("黄") && s.color === "#facc15");
    }
    if (typeMatch && colorMatch) matches.push(i);
  }

  if (matches.length === 0) {
    /* 没有精确匹配，退回到只要类型匹配即可 */
    for (let i = 0; i < shapes.length; i++) {
      if (!command.shape || shapes[i].type === command.shape) matches.push(i);
    }
  }

  if (matches.length === 0) return -1;

  const ordinal = command.ordinal;
  if (ordinal != null) {
    if (ordinal > 0) {
      /* 正数 = 第N个 (1-based) */
      const idx = ordinal - 1;
      return idx < matches.length ? matches[idx] : matches[matches.length - 1];
    }
    if (ordinal < 0) {
      /* 负数 = 倒数第N个 (-1=最后一个, -2=倒数第二个) */
      const idx = matches.length + ordinal; /* -1 → last, -2 → second-last */
      return idx >= 0 ? matches[idx] : matches[0];
    }
  }

  /* 默认：最后一个匹配 */
  return matches[matches.length - 1];
}

/* ── render ────────────────────────────────────────────── */

function renderShape(s: Drawable) {
  if (s.type === "circle" || s.type === "sun") {
    return (
      <circle
        key={s.id}
        cx={s.x}
        cy={s.y}
        r={s.width / 2}
        fill={s.color}
        stroke="#111827"
        strokeWidth="2"
      />
    );
  }

  if (s.type === "rect" || s.type === "sky" || s.type === "grass") {
    return (
      <rect
        key={s.id}
        x={s.x - s.width / 2}
        y={s.y - s.height / 2}
        width={s.width}
        height={s.height}
        fill={s.color}
        stroke={s.type === "rect" ? "#111827" : "none"}
        strokeWidth="2"
      />
    );
  }

  if (s.type === "line") {
    const x1 = s.x;
    const y1 = s.y;
    const x2 = s.x2 ?? s.x + s.width;
    const y2 = s.y2 ?? s.y;
    return (
      <line
        key={s.id}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={s.color}
        strokeWidth="6"
        strokeLinecap="round"
      />
    );
  }

  if (s.type === "tree") {
    return (
      <g key={s.id}>
        <rect x={s.x - 15} y={s.y + 20} width="30" height="80" fill="#92400e" />
        <circle cx={s.x} cy={s.y} r={s.width / 2} fill={s.color} stroke="#14532d" strokeWidth="2" />
      </g>
    );
  }

  if (s.type === "dot") {
    return <circle key={s.id} cx={s.x} cy={s.y} r={8} fill={s.color} stroke="#111827" strokeWidth="2" />;
  }

  if (s.type === "text") {
    return (
      <text key={s.id} x={s.x} y={s.y} fill={s.color} fontSize="34" textAnchor="middle">
        {s.text || "文字"}
      </text>
    );
  }

  return null;
}

/* ── LLM client ────────────────────────────────────────── */

async function callLLM(text: string, config: LLMConfig): Promise<Command[]> {
  const url = config.baseUrl.replace(/\/+$/, "") + "/chat/completions";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API 错误 ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  let content: string = data.choices?.[0]?.message?.content ?? "";

  /* 去掉可能的 markdown 代码块标记 */
  content = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  /* 尝试提取 JSON 数组 */
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("LLM 返回的内容不包含 JSON 数组: " + content.slice(0, 200));

  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) throw new Error("LLM 返回的不是数组");

  return parsed as Command[];
}

async function testLLMConnection(config: LLMConfig): Promise<string> {
  const url = config.baseUrl.replace(/\/+$/, "") + "/chat/completions";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "user", content: "hi" },
      ],
      max_tokens: 5,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  if (data.choices?.[0]?.message?.content != null) {
    return "连接成功 ✓";
  }
  throw new Error("返回格式异常");
}

/* ── App ───────────────────────────────────────────────── */

function App() {
  const [shapes, setShapes] = useState<Drawable[]>([]);
  const [listening, setListening] = useState(false);
  const [lastText, setLastText] = useState("输入指令后按回车，例如：画一个红色圆形");
  const [textInput, setTextInput] = useState("");
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const recognitionRef = useRef<any>(null);

  /* ---- LLM config ---- */
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(() => {
    try {
      const raw = localStorage.getItem("llmConfig");
      if (raw) return { ...DEFAULT_LLM_CONFIG, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULT_LLM_CONFIG;
  });
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmStatus, setLlmStatus] = useState<string>("");
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    localStorage.setItem("llmConfig", JSON.stringify(llmConfig));
  }, [llmConfig]);

  const supportSpeech = useMemo(() => {
    return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
  }, []);

  /* ---- command executor ---- */
  function applyCommand(command: Command) {
    setShapes((prev) => {
      if (command.action === "undo") return prev.slice(0, -1);
      if (command.action === "clear") return [];
      if (command.action === "delete") {
        const index = findTargetIndex(prev, command);
        return index < 0 ? prev : prev.filter((_, i) => i !== index);
      }

      if (command.action === "draw") {
        /* useLineRadius: 以上一条线的长度为半径画圆 */
        if (command.useLineRadius) {
          let lastLine: Drawable | null = null;
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].type === "line") { lastLine = prev[i]; break; }
          }
          if (lastLine) {
            const radius = getLineLength(lastLine);
            const circle: Drawable = {
              id: uuid(),
              type: "circle",
              x: lastLine.x,
              y: lastLine.y,
              width: radius * 2,
              height: radius * 2,
              color: command.color ?? "#3b82f6",
            };
            return [...prev, circle];
          }
          /* 找不到线时退回到普通画圆 */
          return [...prev, createDrawable(command)];
        }
        /* useRef: 以上一个图形的位置为基准 */
        if (command.useRef && prev.length > 0) {
          const ref = prev[prev.length - 1];
          return [...prev, createDrawable({ ...command, x: ref.x, y: ref.y })];
        }
        return [...prev, createDrawable(command)];
      }

      if (command.action === "move") {
        const index = findTargetIndex(prev, command);
        if (index < 0) return prev;
        /* LLM 可能直接给出坐标 */
        const pos =
          command.x != null && command.y != null
            ? { x: command.x, y: command.y }
            : getPosition(command.position ?? "");
        return prev.map((s, i) => (i === index ? { ...s, x: pos.x, y: pos.y } : s));
      }

      if (command.action === "resize") {
        const index = findTargetIndex(prev, command);
        if (index < 0) return prev;
        /* LLM 可能直接给出宽高 */
        if (command.width && command.height) {
          return prev.map((s, i) =>
            i === index ? { ...s, width: command.width!, height: command.height! } : s,
          );
        }
        const factor = (command.size ?? "").includes("小") || (command.size ?? "").includes("缩小") ? 0.75 : 1.3;
        return prev.map((s, i) =>
          i === index ? { ...s, width: s.width * factor, height: s.height * factor } : s,
        );
      }

      if (command.action === "recolor") {
        const newColor = command.color;
        if (!newColor) return prev;
        const index = findTargetIndex(prev, command);
        if (index < 0) return prev;
        return prev.map((s, i) => (i === index ? { ...s, color: newColor } : s));
      }

      if (command.action === "extend") {
        if (prev.length === 0) return prev;
        const refIdx = findTargetIndex(prev, command);
        const ref = refIdx >= 0 ? prev[refIdx] : prev[prev.length - 1];
        const len = command.length ?? 150;
        const dirMap: Record<string, { dx: number; dy: number }> = {
          left:        { dx: -len, dy: 0 },
          right:       { dx:  len, dy: 0 },
          up:          { dx: 0,    dy: -len },
          down:        { dx: 0,    dy:  len },
          "up-left":   { dx: -106, dy: -106 },
          "up-right":  { dx:  106, dy: -106 },
          "down-left": { dx: -106, dy:  106 },
          "down-right":{ dx:  106, dy:  106 },
        };
        const d = dirMap[command.direction ?? "right"] ?? dirMap.right;
        const line: Drawable = {
          id: uuid(),
          type: "line",
          x: ref.x,
          y: ref.y,
          x2: ref.x + d.dx,
          y2: ref.y + d.dy,
          width: 8,
          height: 8,
          color: command.color ?? "#111827",
        };
        return [...prev, line];
      }

      return prev;
    });
  }

  /* ---- voice / text handler ---- */
  async function handleText(text: string) {
    setLastText(text);

    /* LLM 模式 */
    if (llmConfig.enabled && llmConfig.apiKey) {
      setLlmLoading(true);
      setLlmStatus("");
      try {
        const commands = await callLLM(text, llmConfig);
        const summary = commands.map((c) => `${c.action} ${c.shape ?? ""}`).join(" | ");
        console.log("LLM解析指令:", commands, summary);
        commands.forEach(applyCommand);
        speak(`大模型已执行 ${commands.length} 个指令`);
        setLlmStatus("大模型解析成功");
        setLastText(`${text}\n→ [LLM] ${summary}`);
      } catch (e: any) {
        console.error("LLM error:", e);
        speak("大模型调用失败，已回退到本地解析");
        setLlmStatus("大模型失败，已回退本地解析: " + (e.message ?? "").slice(0, 60));
        /* 回退到本地解析 */
        fallbackLocal(text);
      } finally {
        setLlmLoading(false);
      }
      return;
    }

    /* 本地解析模式 */
    fallbackLocal(text);
  }

  function fallbackLocal(text: string) {
    const parts = splitComplexCommand(text);
    const commands = parts.map(parseOneCommand).filter((c): c is Command => c !== null);
    /* 输出解析结果帮助调试 */
    const summary = commands.map((c) => `${c.action} ${c.shape ?? ""} ${c.color ?? ""}`).join(" | ");
    console.log("解析指令:", commands, summary);
    commands.forEach(applyCommand);
    if (commands.length === 1 && commands[0].action === "move") {
      speak(`已将图形移动到目标位置`);
    } else if (commands.length === 1 && commands[0].action === "delete") {
      speak(`已删除图形`);
    } else if (commands.length === 1 && commands[0].action === "recolor") {
      speak(`已修改颜色`);
    } else {
      speak(`已执行 ${commands.length} 个指令`);
    }
    setLastText(`${text}\n→ ${summary}`);
  }

  function startListening() {
    if (!supportSpeech) {
      alert("当前浏览器不支持 Web Speech API，请使用 Chrome。");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (event: any) => {
      setListening(false);
      const err = event.error || "";
      if (err === "network") {
        setSpeechAvailable(false);
        setLastText("⚠️ 语音服务不可用（需访问 Google）。请使用文字输入框。");
        speak("");
      } else if (err === "not-allowed" || err === "audio-capture") {
        setLastText("⚠️ 麦克风权限未开启，请在浏览器设置中允许访问麦克风。");
        speak("请开启麦克风权限");
      } else if (err === "no-speech") {
        setLastText("未检测到语音，请再说一次。");
        speak("没有听清楚，请再说一次");
      } else {
        setLastText(`语音识别失败：${err || "未知错误"}。可使用文字输入。`);
        speak("没有听清楚，请再说一次");
      }
    };
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      handleText(text);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  /* ---- LLM config handlers ---- */
  async function handleTestConnection() {
    if (!llmConfig.apiKey) {
      setLlmStatus("请先填写 API Key");
      return;
    }
    setLlmStatus("正在测试连接...");
    try {
      const msg = await testLLMConnection(llmConfig);
      setLlmStatus(msg);
    } catch (e: any) {
      setLlmStatus("连接失败: " + (e.message ?? "").slice(0, 80));
    }
  }

  /* ---- UI ---- */
  return (
    <main className="app">
      {/* ====== 左侧面板 ====== */}
      <section className="panel">
        <h1>AI 语音绘图工具</h1>
        <p>仅通过语音完成绘图、修改、撤销和清空。</p>

        {speechAvailable && (
          <button onClick={startListening} className={listening ? "danger" : ""}>
            {listening ? "正在聆听..." : llmLoading ? "大模型处理中..." : "🎤 开始语音"}
          </button>
        )}

        {/* 文字输入（语音不可用时为主输入） */}
        <div className="text-input-row">
          <input
            type="text"
            value={textInput}
            placeholder={speechAvailable ? "或直接输入指令，按 Enter 发送..." : "输入绘图指令，按 Enter 发送..."}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && textInput.trim()) {
                handleText(textInput.trim());
                setTextInput("");
              }
            }}
            autoFocus={!speechAvailable}
          />
          <button
            className="small"
            onClick={() => {
              if (textInput.trim()) {
                handleText(textInput.trim());
                setTextInput("");
              }
            }}
            disabled={!textInput.trim()}
          >
            发送
          </button>
        </div>

        {!speechAvailable && (
          <p className="speech-warning">⚠️ 语音服务不可用 — Google 服务在国内被墙，请使用文字输入</p>
        )}

        <button onClick={() => handleText("撤销")} className="secondary">
          撤销
        </button>
        <button onClick={() => handleText("清空")} className="secondary">
          清空
        </button>

        <div className="box">
          <b>识别结果：</b>
          <p>{lastText}</p>
        </div>

        <div className="box">
          <b>可说指令：</b>
          <p>画一个红色圆形</p>
          <p>在右上角画一个黄色太阳</p>
          <p>删掉第一个圆</p>
          <p>画一条长度200的线，然后以这条线为半径画圆</p>
          <p>画一个点，然后向右延伸一条线</p>
          <p>以这个点为圆心画一个圆</p>
          <p>画蓝色天空和绿色草地</p>
          <p>把太阳移动到左上角</p>
          <p>将蓝色的圆改为黄色</p>
          <p>撤销 / 清空画布</p>
        </div>

        {/* ====== 大模型配置 ====== */}
        <div className="llm-config">
          <div className="llm-header" onClick={() => setShowConfig(!showConfig)}>
            <span className="llm-title">🤖 大模型配置</span>
            <span className="llm-arrow">{showConfig ? "▲" : "▼"}</span>
          </div>

          {showConfig && (
            <div className="llm-body">
              {/* 启用开关 */}
              <label className="llm-row">
                <span>启用大模型解析</span>
                <input
                  type="checkbox"
                  checked={llmConfig.enabled}
                  onChange={(e) =>
                    setLlmConfig((c) => ({ ...c, enabled: e.target.checked }))
                  }
                />
              </label>

              {/* 快捷选择预设 */}
              <label className="llm-row llm-row-col">
                <span>快捷选择</span>
                <select
                  className="llm-select"
                  defaultValue=""
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    if (idx < 0) return;
                    const preset = PROVIDER_PRESETS[idx];
                    setLlmConfig((c) => ({
                      ...c,
                      baseUrl: preset.baseUrl || c.baseUrl,
                      model: preset.model || c.model,
                    }));
                  }}
                >
                  <option value="-1" disabled>
                    选择模型自动填入…
                  </option>
                  {PROVIDER_PRESETS.map((p, i) => (
                    <option key={i} value={i}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* API Key */}
              <label className="llm-row llm-row-col">
                <span>API Key</span>
                <input
                  type="password"
                  value={llmConfig.apiKey}
                  placeholder="sk-xxxxxxxxxxxxxxxx"
                  onChange={(e) =>
                    setLlmConfig((c) => ({ ...c, apiKey: e.target.value.trim() }))
                  }
                />
              </label>

              {/* API 地址 */}
              <label className="llm-row llm-row-col">
                <span>API 地址（自动识别或手动填）</span>
                <input
                  type="text"
                  value={llmConfig.baseUrl}
                  placeholder="https://api.openai.com/v1"
                  onChange={(e) =>
                    setLlmConfig((c) => ({ ...c, baseUrl: e.target.value.trim() }))
                  }
                />
              </label>

              {/* 模型 */}
              <label className="llm-row llm-row-col">
                <span>模型</span>
                <input
                  type="text"
                  value={llmConfig.model}
                  placeholder="gpt-4o-mini"
                  list="model-suggestions"
                  onChange={(e) =>
                    setLlmConfig((c) => ({ ...c, model: e.target.value.trim() }))
                  }
                />
                <datalist id="model-suggestions">
                  {[...new Set(PROVIDER_PRESETS.map((p) => p.model).filter(Boolean))].map(
                    (m) => (
                      <option key={m} value={m} />
                    ),
                  )}
                </datalist>
              </label>

              {/* 测试连接 */}
              <button className="secondary small" onClick={handleTestConnection}>
                测试连接
              </button>

              {llmStatus && <p className="llm-status">{llmStatus}</p>}

              <p className="llm-hint">
                支持 OpenAI 兼容 API（OpenAI / DeepSeek / 阿里百炼 / 智谱 / Moonshot / Ollama 等）。
                API Key 仅保存在浏览器本地。
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ====== 右侧画布 ====== */}
      <section className="canvasWrap">
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="canvas"
        >
          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#f8fafc" />
          {shapes.map(renderShape)}
        </svg>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
