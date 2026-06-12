/* ── 中英双语指令解析器（纯本地，不依赖 AI，含同音字模糊匹配） ── */

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
  COUNT_WORDS,
} from "./constants";

/** 检查输入是否包含关键词组中的任意一个 */
function matchAny(input: string, keywords: string[]): boolean {
  return keywords.some((k) => input.includes(k));
}

/** 在关键词字典中查找匹配项，返回匹配到的 key */
function matchInDict(input: string, dict: Record<string, string[]>): string | undefined {
  // 长关键词优先匹配（避免"蓝色"被"蓝"先匹配、"sky"被"s"误配等）
  const flat: { key: string; kw: string }[] = [];
  for (const [key, kws] of Object.entries(dict)) {
    for (const kw of kws) flat.push({ key, kw });
  }
  flat.sort((a, b) => b.kw.length - a.kw.length);
  for (const { key, kw } of flat) {
    if (input.includes(kw)) return key;
  }
  return undefined;
}

/** 提取颜色（中英 + 同音字） */
export function parseColor(input: string): string | undefined {
  return matchInDict(input, COLOR_KEYWORDS);
}

/** 提取尺寸（中英 + 同音字） */
export function parseSize(input: string): { width: number; height: number } {
  if (matchAny(input, SIZE_KEYWORDS["小"])) return SIZE_MAP["小"];
  if (matchAny(input, SIZE_KEYWORDS["大"])) return SIZE_MAP["大"];
  if (matchAny(input, SIZE_KEYWORDS["中"])) return SIZE_MAP["中"];
  return SIZE_MAP["默认"];
}

/** 提取位置（中英 + 同音字） */
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

/** 提取形状类型（中英 + 同音字），按特异性排序避免误配 */
export function parseShape(input: string): ShapeType | undefined {
  const order: ShapeType[] = [
    "triangle", "hexagon", "ellipse", "diamond", "arrow",
    "heart", "cloud", "star", "arc", "rect", "circle", "line", "text",
  ];
  for (const t of order) {
    if (matchAny(input, SHAPE_KEYWORDS[t])) return t;
  }
  return undefined;
}

/** 提取序号（第几个 / first second…） */
function parseOrdinal(input: string): number | undefined {
  if (matchAny(input, ["第一个", "低一个", "first", "1st"])) return 1;
  if (matchAny(input, ["第二个", "第二各", "第二哥", "second", "2nd"])) return 2;
  if (matchAny(input, ["第三个", "第三各", "第三哥", "third", "3rd"])) return 3;
  if (matchAny(input, ["最后一个", "最后", "last"])) return -1;
  return undefined;
}

/** 提取数量：「画三个圆」→ 3，"draw 3 circles" → 3 */
function parseCount(input: string): number {
  // 阿拉伯数字：画3个 / draw 3 circles
  const digit = input.match(/(\d+)\s*(?:个|条|颗|只|circles?|squares?|stars?|shapes?|times)?/);
  if (digit) {
    const n = parseInt(digit[1], 10);
    if (n >= 2 && n <= 20) return n;
  }
  // 中文数字 + 量词 / 英文数词
  for (const [word, n] of Object.entries(COUNT_WORDS)) {
    if (n < 2) continue;
    if (/[a-z]/.test(word)) {
      if (new RegExp(`\\b${word}\\b`).test(input)) return n;
    } else if (input.includes(word + "个") || input.includes(word + "条") || input.includes(word + "颗")) {
      return n;
    }
  }
  return 1;
}

/** 提取旋转角度：「旋转90度」/ "rotate 30 degrees"，默认 45 */
function parseDegrees(input: string): number {
  // 去掉英文序数词（1st/2nd/3rd…），避免误判为角度
  const cleaned = input.replace(/\d+(?:st|nd|rd|th)/g, "");
  const m = cleaned.match(/(\d+)\s*(?:度|°|deg|degrees?)?/);
  if (m) {
    const d = parseInt(m[1], 10);
    if (d >= 1 && d <= 360) return d;
  }
  return 45;
}

/** 将复合语句拆分为多个子指令（中英分隔词） */
function splitCommand(input: string): string[] {
  return input
    .replace(/，/g, ",")
    .replace(/。/g, ",")
    .replace(/；/g, ",")
    .replace(/;/g, ",")
    .replace(/然后/g, ",")
    .replace(/接着/g, ",")
    .replace(/再画/g, ",画")
    .replace(/再写/g, ",写")
    .replace(/\bthen\b/g, ",")
    .replace(/\band then\b/g, ",")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 解析单条子指令 */
function parseOneCommand(raw: string): Command | null {
  const input = raw.toLowerCase(); // 英文统一小写，中文不受影响

  // 重做（先于撤销判断，避免英文场景误判）
  if (matchAny(input, ACTION_KEYWORDS.redo)) {
    return { action: "redo" };
  }
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
  // 旋转
  if (matchAny(input, ACTION_KEYWORDS.rotate)) {
    return {
      action: "rotate",
      shape: parseShape(input),
      ordinal: parseOrdinal(input),
      degrees: parseDegrees(input),
    };
  }
  // 改色（注意英文 "turn/change … to red" 也走这里）
  if (matchAny(input, ACTION_KEYWORDS.recolor)) {
    const shape = parseShape(input);
    // 从改色动词后面提取新颜色
    let colorPart = input;
    for (const v of ACTION_KEYWORDS.recolor) {
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
  // 绘制：包含绘图动词，或（容错）虽无动词但明确提到了某个图形
  const hasDrawVerb = matchAny(input, ACTION_KEYWORDS.draw);
  const shapeGuess = parseShape(input);
  if (!hasDrawVerb && !shapeGuess) return null;

  const shape = shapeGuess ?? "circle";
  // 文字提取（中文同音字 + 英文 write/say/text）
  const textMatch =
    raw.match(/(?:写|文字|些|谢)\s*[""「]?(.+?)[""」]?\s*$/) ??
    raw.match(/(?:write|say|text)\s+["']?(.+?)["']?\s*$/i);

  return {
    action: "draw",
    shape,
    color: parseColor(input),
    position: input,
    size: input,
    text: textMatch?.[1],
    count: parseCount(input),
  };
}

/** 解析完整用户输入，返回指令数组 */
export function parseVoiceCommand(input: string): Command[] {
  const parts = splitCommand(input);
  return parts
    .map(parseOneCommand)
    .filter((c): c is Command => c !== null);
}
