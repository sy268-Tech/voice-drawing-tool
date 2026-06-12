/* ── 中文语音指令解析器（纯本地，不依赖 AI，含同音字模糊匹配）── */

import { Command, ShapeType } from "./types";
import {
  SIZE_MAP,
  WIDTH,
  HEIGHT,
  SHAPE_KEYWORDS,
  COLOR_KEYWORDS,
  SIZE_KEYWORDS,
  POS_KEYWORDS,
  ACTION_KEYWORDS,
} from "./constants";

/** 检查输入是否包含关键词组中的任意一个 */
function matchAny(input: string, keywords: string[]): boolean {
  return keywords.some((k) => input.includes(k));
}

/** 在关键词字典中查找匹配项，返回匹配到的 key */
function matchInDict(input: string, dict: Record<string, string[]>): string | undefined {
  // 长关键词优先匹配（避免"蓝色"被"蓝"先匹配导致不完整）
  const entries = Object.entries(dict).sort(
    ([, a], [, b]) => Math.max(...b.map((k) => k.length)) - Math.max(...a.map((k) => k.length))
  );
  for (const [key, keywords] of entries) {
    if (matchAny(input, keywords)) return key;
  }
  return undefined;
}

/** 提取颜色（含同音字模糊匹配） */
export function parseColor(input: string): string | undefined {
  return matchInDict(input, COLOR_KEYWORDS);
}

/** 提取尺寸（含同音字） */
export function parseSize(input: string): { width: number; height: number } {
  if (matchAny(input, SIZE_KEYWORDS["小"])) return SIZE_MAP["小"];
  if (matchAny(input, SIZE_KEYWORDS["大"])) return SIZE_MAP["大"];
  if (matchAny(input, SIZE_KEYWORDS["中"])) return SIZE_MAP["中"];
  return SIZE_MAP["默认"];
}

/** 提取位置（含同音字） */
export function parsePosition(input: string): { x: number; y: number } {
  const left = matchAny(input, POS_KEYWORDS.left);
  const right = matchAny(input, POS_KEYWORDS.right);
  const top = matchAny(input, POS_KEYWORDS.top);
  const bottom = matchAny(input, POS_KEYWORDS.bottom);

  let x = WIDTH / 2;
  let y = HEIGHT / 2;

  if (left) x = 160;
  if (right) x = WIDTH - 160;
  if (top) y = 120;
  if (bottom) y = HEIGHT - 120;

  if (matchAny(input, POS_KEYWORDS.center)) {
    x = WIDTH / 2;
    y = HEIGHT / 2;
  }

  return { x, y };
}

/** 提取形状类型（含同音字模糊匹配） */
export function parseShape(input: string): ShapeType | undefined {
  if (matchAny(input, SHAPE_KEYWORDS.triangle)) return "triangle";
  if (matchAny(input, SHAPE_KEYWORDS.ellipse)) return "ellipse";
  if (matchAny(input, SHAPE_KEYWORDS.circle)) return "circle";
  if (matchAny(input, SHAPE_KEYWORDS.rect)) return "rect";
  if (matchAny(input, SHAPE_KEYWORDS.line)) return "line";
  if (matchAny(input, SHAPE_KEYWORDS.star)) return "star";
  if (matchAny(input, SHAPE_KEYWORDS.text)) return "text";
  return undefined;
}

/** 提取序号（第几个） */
function parseOrdinal(input: string): number | undefined {
  if (matchAny(input, ["第一个", "低一个", "第一个"])) return 1;
  if (matchAny(input, ["第二个", "第二各", "第二哥"])) return 2;
  if (matchAny(input, ["第三个", "第三各", "第三哥"])) return 3;
  if (matchAny(input, ["最后一个", "上一个", "最后一个"])) return -1;
  return undefined;
}

/** 将复合语句拆分为多个子指令 */
function splitCommand(input: string): string[] {
  return input
    .replace(/，/g, ",")
    .replace(/。/g, ",")
    .replace(/然后/g, ",")
    .replace(/再/g, ",")
    .replace(/并且/g, ",")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 解析单条子指令 */
function parseOneCommand(input: string): Command | null {
  // 撤销
  if (matchAny(input, ACTION_KEYWORDS.undo)) {
    return { action: "undo" };
  }
  // 清空
  if (matchAny(input, ACTION_KEYWORDS.clear)) {
    return { action: "clear" };
  }
  // 删除
  if (matchAny(input, ACTION_KEYWORDS.delete)) {
    return { action: "delete", shape: parseShape(input), ordinal: parseOrdinal(input) };
  }
  // 改色
  if (matchAny(input, ACTION_KEYWORDS.recolor)) {
    const shape = parseShape(input);
    // 从改色动词后面提取新颜色
    const allVerbs = ACTION_KEYWORDS.recolor;
    let colorPart = input;
    for (const v of allVerbs) {
      const idx = input.indexOf(v);
      if (idx >= 0) { colorPart = input.slice(idx + v.length); break; }
    }
    return { action: "recolor", shape, color: parseColor(colorPart), ordinal: parseOrdinal(input) };
  }
  // 移动
  if (matchAny(input, ACTION_KEYWORDS.move)) {
    return { action: "move", shape: parseShape(input), position: input, ordinal: parseOrdinal(input) };
  }
  // 缩放
  if (matchAny(input, ACTION_KEYWORDS.resize)) {
    return { action: "resize", shape: parseShape(input), size: input, ordinal: parseOrdinal(input) };
  }
  // 绘制（必须包含绘图动词）
  if (!matchAny(input, ACTION_KEYWORDS.draw)) return null;

  const shape = parseShape(input) ?? "circle";
  // 文字提取（也匹配同音字"些"/"谢"等）
  const textMatch = input.match(/(?:写|文字|些|谢)\s*[""「]?(.+?)[""」]?\s*$/);

  return {
    action: "draw",
    shape,
    color: parseColor(input),
    position: input,
    size: input,
    text: textMatch?.[1],
  };
}

/** 解析完整用户输入，返回指令数组 */
export function parseVoiceCommand(input: string): Command[] {
  const parts = splitCommand(input);
  return parts
    .map(parseOneCommand)
    .filter((c): c is Command => c !== null);
}
