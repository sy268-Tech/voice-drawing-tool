/* ── 常量与配置（中英双语关键词库） ── */

export const WIDTH = 900;
export const HEIGHT = 560;

/**
 * 形状关键词组：规范中文词 + 常见语音同音字误识 + 英文关键词
 * 英文关键词请保持小写（解析前输入会统一转小写）
 */
export const SHAPE_KEYWORDS: Record<string, string[]> = {
  circle:   ["圆", "元", "原", "园", "源", "员", "缘", "远", "圆形", "圆型", "元形",
              "circle", "round"],
  rect:     ["矩形", "巨型", "句型", "方形", "正方形", "正方行", "方块", "方向", "长方", "长方行",
              "rectangle", "rect", "square", "box"],
  triangle: ["三角", "三角行", "三角型", "3角", "triangle"],
  ellipse:  ["椭圆", "妥圆", "脱圆", "椭圆型", "ellipse", "oval"],
  star:     ["星", "五角星", "五角行", "五角形", "五角型", "星星", "行行", "star"],
  line:     ["线", "直线", "现", "县", "先", "鲜", "显", "限", "线条", "现条", " line"],
  text:     ["文字", "蚊子", "温字", "文子", "写", "写字", "些字", "谢字", "文本",
              "text", "write", "word"],
  arrow:    ["箭头", "箭", "建", "见", "剑头", "键头", "见头", "arrow"],
  diamond:  ["菱形", "零星", "灵形", "钻", "钻石", "凌形", "菱", "棱形", "diamond", "rhombus"],
  heart:    ["心形", "爱心", "心", "爱", "行形", "新型", "芯", "薪", "心型", "heart", "love"],
  arc:      ["弧形", "圆弧", "弧", "曲线", "壶", "胡", "湖", "乎", "狐", "arc", "curve"],
  hexagon:  ["六边形", "六边行", "6边形", "六角形", "六角", "溜边形", "6角形", "hexagon", "hex"],
  cloud:    ["云朵", "云", "云形", "运", "晕", "允", "云彩", "白云", "云多", "cloud"],
};

/** 颜色关键词组（含同音字与英文） */
export const COLOR_KEYWORDS: Record<string, string[]> = {
  "#ef4444": ["红", "红色", "虹", "宏", "鸿", "洪", "虹色", "宏色", "red"],
  "#3b82f6": ["蓝", "蓝色", "兰", "栏", "篮", "兰色", "烂色", "blue"],
  "#22c55e": ["绿", "绿色", "律", "率", "律色", "率色", "green"],
  "#eab308": ["黄", "黄色", "皇", "慌", "煌", "皇色", "慌色", "yellow"],
  "#111827": ["黑", "黑色", "嘿", "嘿色", "black"],
  "#ffffff": ["白", "白色", "百", "摆", "百色", "摆色", "white"],
  "#a855f7": ["紫", "紫色", "子", "字", "自", "子色", "字色", "purple", "violet"],
  "#f97316": ["橙", "橙色", "成", "程", "城", "承", "成色", "程色", "城色", "orange"],
  "#ec4899": ["粉", "粉色", "分", "份", "氛", "分色", "份色", "pink"],
  "#92400e": ["棕", "棕色", "宗", "综", "总", "踪", "综色", "brown"],
  "#6b7280": ["灰", "灰色", "会", "回", "慧", "辉", "汇", "会色", "回色", "gray", "grey"],
  // ── 新增颜色 ──
  "#06b6d4": ["青", "青色", "清", "轻", "青蓝", "cyan", "teal"],
  "#fbbf24": ["金", "金色", "今", "斤", "津", "gold", "golden"],
  "#0ea5e9": ["天蓝", "天蓝色", "添蓝", "sky"],
  "#84cc16": ["青柠", "草绿", "黄绿", "lime"],
  "#6366f1": ["靛", "靛蓝", "靛色", "电蓝", "indigo"],
};

/** 尺寸关键词组 */
export const SIZE_KEYWORDS: Record<string, string[]> = {
  "大": ["大", "打", "达", "答", "big", "large", "huge", "giant"],
  "小": ["小", "晓", "笑", "消", "效", "small", "tiny", "little", "mini"],
  "中": ["中", "钟", "终", "忠", "种", "medium", "mid"],
};

/** 方位关键词组 */
export const POS_KEYWORDS: Record<string, string[]> = {
  left:   ["左", "作", "坐", "昨", "left"],
  right:  ["右", "又", "有", "由", "油", "right"],
  top:    ["上", "商", "伤", "赏", "top", "up"],
  bottom: ["下", "夏", "吓", "虾", "bottom", "down"],
  center: ["中间", "中坚", "中兼", "中央", "中秧", "中心", "中新", "忠心", "中部",
            "center", "centre", "middle"],
};

/** 动作关键词组 */
export const ACTION_KEYWORDS: Record<string, string[]> = {
  draw:    ["画", "绘", "添加", "创建", "放", "话", "化", "花", "划", "写",
             "draw", "add", "create", "make", "put", "place", "write", "say"],
  move:    ["移动", "移到", "放到", "挪到", "疑动", "移东", "一道", "move"],
  resize:  ["变大", "放大", "变小", "缩小", "编大", "边大", "编小", "变晓", "所小",
             "bigger", "larger", "enlarge", "grow", "smaller", "shrink", "resize"],
  recolor: ["改为", "改成", "换成", "变成", "盖为", "盖成", "编成", "还成",
             "change", "paint", "turn", "recolor"],
  rotate:  ["旋转", "转动", "转一下", "选转", "悬转", "rotate", "spin"],
  delete:  ["删除", "删掉", "去掉", "移除", "闪烁", "山出", "山掉", "渠道",
             "delete", "remove", "erase"],
  undo:    ["撤销", "返回", "彻消", "彻销", "反回", "undo"],
  redo:    ["重做", "重作", "恢复", "崇左", "redo"],
  clear:   ["清空", "清除", "全部删除", "清屏", "晴空", "情空", "清楚",
             "clear", "clean", "reset"],
};

/** 缩小判定关键词（resize 时区分放大/缩小） */
export const SHRINK_KEYWORDS = ["小", "晓", "笑", "缩", "所",
  "smaller", "shrink", "tiny", "little"];

/** 数量词映射（中文数字 + 英文数词） */
export const COUNT_WORDS: Record<string, number> = {
  "一": 1, "两": 2, "二": 2, "三": 3, "四": 4, "五": 5,
  "六": 6, "七": 7, "八": 8, "九": 9, "十": 10,
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/** 尺寸关键词映射 */
export const SIZE_MAP: Record<string, { width: number; height: number }> = {
  小: { width: 60, height: 60 },
  大: { width: 180, height: 180 },
  中: { width: 110, height: 110 },
  默认: { width: 110, height: 110 },
};

/** 画板可选色（用于 UI 色板展示） */
export const PALETTE: { hex: string; zh: string; en: string }[] = [
  { hex: "#ef4444", zh: "红", en: "red" },
  { hex: "#f97316", zh: "橙", en: "orange" },
  { hex: "#fbbf24", zh: "金", en: "gold" },
  { hex: "#eab308", zh: "黄", en: "yellow" },
  { hex: "#84cc16", zh: "青柠", en: "lime" },
  { hex: "#22c55e", zh: "绿", en: "green" },
  { hex: "#06b6d4", zh: "青", en: "cyan" },
  { hex: "#0ea5e9", zh: "天蓝", en: "sky" },
  { hex: "#3b82f6", zh: "蓝", en: "blue" },
  { hex: "#6366f1", zh: "靛", en: "indigo" },
  { hex: "#a855f7", zh: "紫", en: "purple" },
  { hex: "#ec4899", zh: "粉", en: "pink" },
  { hex: "#92400e", zh: "棕", en: "brown" },
  { hex: "#6b7280", zh: "灰", en: "gray" },
  { hex: "#111827", zh: "黑", en: "black" },
  { hex: "#ffffff", zh: "白", en: "white" },
];
