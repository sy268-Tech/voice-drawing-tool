import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Drawable, Lang } from "./types";
import { WIDTH, HEIGHT, PALETTE } from "./constants";
import { parseVoiceCommand } from "./parser";
import { applyCommand } from "./engine";
import { useSpeechRecognition } from "./useSpeechRecognition";
import "./style.css";

/* ── 双语 UI 文案 ── */

const T = {
  "zh-CN": {
    title: "语音绘图",
    subtitle: "说出形状、颜色、位置，立刻画出来",
    mic: "点击说话",
    micListening: "正在聆听…",
    inputPlaceholder: "或输入指令，回车发送…",
    send: "发送",
    undo: "撤销",
    redo: "重做",
    clear: "清空",
    exportSvg: "导出 SVG",
    exportPng: "导出 PNG",
    result: "识别结果",
    historyLabel: "历史指令",
    helpLabel: "试试这些指令",
    palette: "可用颜色（说出名称即可）",
    continuous: "连续聆听",
    voiceFeedback: "语音播报",
    initLog: "点击麦克风说话，或在下方输入指令。例如：画一个红色圆形",
    notUnderstood: (t: string) => `未能识别："${t}"\n→ 支持同音字与中英文混合，可换种说法试试`,
    speakFail: "没有听懂，请再说一次",
    speakDone: (n: number) => `已执行${n}个指令`,
    executed: "已执行",
    shapesCount: (n: number) => `已绘制 ${n} 个图形`,
    canvasHint: "点击图形可选中，拖动可移动，按 Delete 删除",
    selectedTip: "已选中图形 · 拖动移动 · Delete 删除",
    examples: [
      "画一个红色圆形",
      "在左上角画一个大的蓝色矩形",
      "画三个绿色五角星",
      "画一个粉色爱心，然后画一个金色六边形",
      "把圆形移到右下角",
      "将矩形改为青色",
      "把第一个圆放大",
      "旋转矩形45度",
      "删掉三角形",
      "写 你好世界",
    ],
  },
  "en-US": {
    title: "Voice Draw",
    subtitle: "Say a shape, color and position — it appears instantly",
    mic: "Tap to speak",
    micListening: "Listening…",
    inputPlaceholder: "Or type a command and press Enter…",
    send: "Send",
    undo: "Undo",
    redo: "Redo",
    clear: "Clear",
    exportSvg: "Export SVG",
    exportPng: "Export PNG",
    result: "Recognized",
    historyLabel: "History",
    helpLabel: "Try these commands",
    palette: "Available colors (just say the name)",
    continuous: "Continuous listening",
    voiceFeedback: "Voice feedback",
    initLog: "Tap the mic and speak, or type a command below. e.g. draw a red circle",
    notUnderstood: (t: string) => `Could not understand: "${t}"\n→ Both Chinese and English are supported. Try rephrasing.`,
    speakFail: "Sorry, I didn't catch that. Please try again.",
    speakDone: (n: number) => `Done. ${n} command${n > 1 ? "s" : ""} executed.`,
    executed: "Executed",
    shapesCount: (n: number) => `${n} shape${n === 1 ? "" : "s"} on canvas`,
    canvasHint: "Click a shape to select, drag to move, press Delete to remove",
    selectedTip: "Shape selected · drag to move · Delete to remove",
    examples: [
      "draw a red circle",
      "draw a big blue square at the top left",
      "draw three green stars",
      "draw a pink heart then a gold hexagon",
      "move the circle to the bottom right",
      "change the square to cyan",
      "make the first circle bigger",
      "rotate the square 45 degrees",
      "delete the triangle",
      "write Hello World",
    ],
  },
} as const;

/* ── SVG 渲染单个图形（不含 key/交互，由外层 <g> 承担） ── */

function renderShapeBody(s: Drawable) {
  switch (s.type) {
    case "circle":
      return <circle cx={s.x} cy={s.y} r={s.width / 2} fill={s.color} stroke="#1e293b" strokeWidth="2" />;
    case "ellipse":
      return <ellipse cx={s.x} cy={s.y} rx={s.width / 2} ry={s.height / 3} fill={s.color} stroke="#1e293b" strokeWidth="2" />;
    case "rect":
      return (
        <rect x={s.x - s.width / 2} y={s.y - s.height / 2} width={s.width} height={s.height}
          fill={s.color} stroke="#1e293b" strokeWidth="2" rx="4" />
      );
    case "triangle": {
      const top = `${s.x},${s.y - s.height / 2}`;
      const left = `${s.x - s.width / 2},${s.y + s.height / 2}`;
      const right = `${s.x + s.width / 2},${s.y + s.height / 2}`;
      return <polygon points={`${top} ${left} ${right}`} fill={s.color} stroke="#1e293b" strokeWidth="2" />;
    }
    case "star":
      return (
        <polygon points={makeStarPoints(s.x, s.y, s.width / 2, s.width / 4, 5)}
          fill={s.color} stroke="#1e293b" strokeWidth="2" />
      );
    case "line":
      return (
        <line x1={s.x} y1={s.y} x2={s.x2 ?? s.x + s.width} y2={s.y2 ?? s.y}
          stroke={s.color} strokeWidth="4" strokeLinecap="round" />
      );
    case "text":
      return (
        <text x={s.x} y={s.y} fill={s.color} fontSize="32" textAnchor="middle" dominantBaseline="central">
          {s.text || "文字"}
        </text>
      );
    case "arrow":
      return (
        <g>
          <line x1={s.x} y1={s.y} x2={s.x2 ?? s.x + s.width} y2={s.y2 ?? s.y}
            stroke={s.color} strokeWidth="4" strokeLinecap="round" />
          <polygon points={arrowHeadPoints(s.x, s.y, s.x2 ?? s.x + s.width, s.y2 ?? s.y)} fill={s.color} />
        </g>
      );
    case "diamond": {
      const r = s.width / 2;
      const points = `${s.x},${s.y - r * 1.2} ${s.x + r},${s.y} ${s.x},${s.y + r * 1.2} ${s.x - r},${s.y}`;
      return <polygon points={points} fill={s.color} stroke="#1e293b" strokeWidth="2" />;
    }
    case "heart":
      return <path d={makeHeartPath(s.x, s.y, s.width / 2)} fill={s.color} stroke="#1e293b" strokeWidth="2" />;
    case "arc":
      return (
        <path d={makeArcPath(s.x, s.y, s.width / 2, s.height || s.width / 4)}
          fill="none" stroke={s.color} strokeWidth="4" strokeLinecap="round" />
      );
    case "hexagon":
      return (
        <polygon points={makePolygonPoints(s.x, s.y, s.width / 2, 6)}
          fill={s.color} stroke="#1e293b" strokeWidth="2" />
      );
    case "cloud":
      return (
        <path d={makeCloudPath(s.x, s.y, s.width / 2)}
          fill={s.color} stroke="#1e293b" strokeWidth="2" strokeLinejoin="round" />
      );
    default:
      return null;
  }
}

/** 图形包围盒（用于选中高亮） */
function bbox(s: Drawable) {
  if (s.x2 != null && s.y2 != null) {
    const x1 = Math.min(s.x, s.x2), x2 = Math.max(s.x, s.x2);
    const y1 = Math.min(s.y, s.y2), y2 = Math.max(s.y, s.y2);
    return { x: x1 - 10, y: y1 - 14, w: x2 - x1 + 20, h: y2 - y1 + 28 };
  }
  const pad = s.type === "heart" || s.type === "diamond" ? s.width * 0.18 : 8;
  return {
    x: s.x - s.width / 2 - pad,
    y: s.y - s.height / 2 - pad,
    w: s.width + pad * 2,
    h: s.height + pad * 2,
  };
}

/** 生成五角星顶点 */
function makeStarPoints(cx: number, cy: number, outerR: number, innerR: number, points: number): string {
  const coords: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    coords.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return coords.join(" ");
}

/** 计算箭头三角顶点 */
function arrowHeadPoints(x1: number, y1: number, x2: number, y2: number): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = 18;
  const spread = 12;
  const baseX = x2 - len * Math.cos(angle);
  const baseY = y2 - len * Math.sin(angle);
  const leftX = baseX - spread * Math.cos(angle - Math.PI / 2);
  const leftY = baseY - spread * Math.sin(angle - Math.PI / 2);
  const rightX = baseX - spread * Math.cos(angle + Math.PI / 2);
  const rightY = baseY - spread * Math.sin(angle + Math.PI / 2);
  return `${x2},${y2} ${leftX},${leftY} ${rightX},${rightY}`;
}

/** 生成心形 SVG path */
function makeHeartPath(cx: number, cy: number, r: number): string {
  const topY = cy - r * 0.7;
  const bottomY = cy + r * 1.1;
  const leftX = cx - r;
  const rightX = cx + r;
  const cp = r * 0.55;
  return [
    `M ${cx} ${bottomY}`,
    `C ${cx - r * 1.2} ${bottomY - r * 0.4}, ${leftX} ${cy - r * 0.3}, ${leftX} ${topY}`,
    `C ${leftX} ${topY - r * 0.7}, ${cx - cp} ${topY - r * 0.5}, ${cx} ${cy - r * 0.15}`,
    `C ${cx + cp} ${topY - r * 0.5}, ${rightX} ${topY - r * 0.7}, ${rightX} ${topY}`,
    `C ${rightX} ${cy - r * 0.3}, ${cx + r * 1.2} ${bottomY - r * 0.4}, ${cx} ${bottomY}`,
    "Z",
  ].join(" ");
}

/** 生成弧形 SVG path（上半弧） */
function makeArcPath(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`;
}

/** 生成正多边形顶点 */
function makePolygonPoints(cx: number, cy: number, r: number, sides: number): string {
  const coords: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 / sides) * i - Math.PI / 2;
    coords.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return coords.join(" ");
}

/** 生成云朵 SVG path */
function makeCloudPath(cx: number, cy: number, r: number): string {
  const rr = r * 0.45;
  return [
    `M ${cx - r * 0.6} ${cy + rr * 0.6}`,
    `a ${rr} ${rr} 0 0 1 0 ${-rr * 1.5}`,
    `a ${rr * 1.1} ${rr * 1.1} 0 0 1 ${rr * 1.8} ${-rr * 0.3}`,
    `a ${rr * 1.2} ${rr * 1.2} 0 0 1 ${rr * 1.9} ${rr * 0.5}`,
    `a ${rr * 0.9} ${rr * 0.9} 0 0 1 ${rr * 1.2} ${rr * 1.0}`,
    `a ${rr * 0.8} ${rr * 0.8} 0 0 1 ${-rr * 0.3} ${rr * 0.6}`,
    `a ${rr * 1.1} ${rr * 1.1} 0 0 1 ${-rr * 2.4} ${rr * 0.2}`,
    `a ${rr * 1.0} ${rr * 1.0} 0 0 1 ${-rr * 2.2} ${-rr * 0.5}`,
    "Z",
  ].join(" ");
}

/* ── 文档状态（含撤销/重做历史栈） ── */

type Doc = {
  shapes: Drawable[];
  past: Drawable[][];
  future: Drawable[][];
};

const MAX_HISTORY = 60;

/* ── App 主组件 ── */

function App() {
  const [lang, setLang] = useState<Lang>("zh-CN");
  const t = T[lang];

  const [doc, setDoc] = useState<Doc>({ shapes: [], past: [], future: [] });
  const [log, setLog] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [continuous, setContinuous] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    orig: Drawable;
    snapshot: Drawable[];
    moved: boolean;
  } | null>(null);

  /* 语音朗读反馈（可静音） */
  const speak = useCallback((text: string) => {
    if (!voiceOn || !text || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }, [voiceOn, lang]);

  /* 应用一批指令到文档（含撤销/重做处理） */
  const handleInput = useCallback((text: string) => {
    const commands = parseVoiceCommand(text);
    if (commands.length === 0) {
      setLog(t.notUnderstood(text));
      speak(t.speakFail);
      return;
    }

    setDoc((d) => {
      let { shapes, past, future } = d;
      for (const cmd of commands) {
        if (cmd.action === "undo") {
          if (past.length > 0) {
            future = [shapes, ...future];
            shapes = past[past.length - 1];
            past = past.slice(0, -1);
          }
        } else if (cmd.action === "redo") {
          if (future.length > 0) {
            past = [...past, shapes];
            shapes = future[0];
            future = future.slice(1);
          }
        } else {
          past = [...past, shapes].slice(-MAX_HISTORY);
          shapes = applyCommand(shapes, cmd);
          future = [];
        }
      }
      return { shapes, past, future };
    });

    const summary = commands
      .map((c) => `${c.action}${c.shape ? " " + c.shape : ""}${c.count && c.count > 1 ? " ×" + c.count : ""}`)
      .join(", ");
    setLog(`✓ ${text}\n→ ${summary}`);
    setCmdHistory((h) => [...h.slice(-9), text]);
    speak(t.speakDone(commands.length));
  }, [speak, t]);

  const speech = useSpeechRecognition(handleInput, lang, continuous);

  /* 撤销 / 重做 / 清空 按钮 */
  const undo = useCallback(() => setDoc((d) => {
    if (d.past.length === 0) return d;
    return {
      shapes: d.past[d.past.length - 1],
      past: d.past.slice(0, -1),
      future: [d.shapes, ...d.future],
    };
  }), []);

  const redo = useCallback(() => setDoc((d) => {
    if (d.future.length === 0) return d;
    return {
      shapes: d.future[0],
      past: [...d.past, d.shapes],
      future: d.future.slice(1),
    };
  }), []);

  const clearAll = useCallback(() => setDoc((d) => {
    if (d.shapes.length === 0) return d;
    return { shapes: [], past: [...d.past, d.shapes].slice(-MAX_HISTORY), future: [] };
  }), []);

  /* 画布坐标换算 */
  const toSvgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * WIDTH,
      y: ((clientY - r.top) / r.height) * HEIGHT,
    };
  }, []);

  /* 选中 + 拖拽 */
  const onShapeMouseDown = useCallback((e: React.MouseEvent, s: Drawable) => {
    e.stopPropagation();
    setSelectedId(s.id);
    const p = toSvgPoint(e.clientX, e.clientY);
    dragRef.current = {
      id: s.id,
      startX: p.x,
      startY: p.y,
      orig: s,
      snapshot: doc.shapes,
      moved: false,
    };
  }, [doc.shapes, toSvgPoint]);

  const onCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    const dx = p.x - drag.startX;
    const dy = p.y - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    setDoc((d) => ({
      ...d,
      shapes: d.shapes.map((s) => {
        if (s.id !== drag.id) return s;
        const o = drag.orig;
        const next: Drawable = { ...s, x: o.x + dx, y: o.y + dy };
        if (o.x2 != null) next.x2 = o.x2 + dx;
        if (o.y2 != null) next.y2 = o.y2 + dy;
        return next;
      }),
    }));
  }, [toSvgPoint]);

  const onCanvasMouseUp = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved) {
      // 拖拽完成后记入历史
      setDoc((d) => ({
        ...d,
        past: [...d.past, drag.snapshot].slice(-MAX_HISTORY),
        future: [],
      }));
    }
  }, []);

  /* 键盘删除选中图形 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (!selectedId) return;
      e.preventDefault();
      setDoc((d) => {
        if (!d.shapes.some((s) => s.id === selectedId)) return d;
        return {
          shapes: d.shapes.filter((s) => s.id !== selectedId),
          past: [...d.past, d.shapes].slice(-MAX_HISTORY),
          future: [],
        };
      });
      setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  /* 导出 */
  const exportSvg = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "voice-drawing.svg";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportPng = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = WIDTH * 2;
      canvas.height = HEIGHT * 2;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fbfaf7";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((png) => {
          if (!png) return;
          const pngUrl = URL.createObjectURL(png);
          const a = document.createElement("a");
          a.href = pngUrl;
          a.download = "voice-drawing.png";
          a.click();
          URL.revokeObjectURL(pngUrl);
        });
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const selected = doc.shapes.find((s) => s.id === selectedId);
  const shownLog = log ?? t.initLog;

  return (
    <div className="shell">
      {/* 顶部条 */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="topbar-right">
          <div className="lang-switch" role="group" aria-label="language">
            <button
              className={lang === "zh-CN" ? "on" : ""}
              onClick={() => setLang("zh-CN")}
            >中文</button>
            <button
              className={lang === "en-US" ? "on" : ""}
              onClick={() => setLang("en-US")}
            >EN</button>
          </div>
        </div>
      </header>

      <main className="app">
        {/* 左侧控制台 */}
        <aside className="panel">
          {/* 麦克风 */}
          <button
            className={speech.listening ? "btn-mic listening" : "btn-mic"}
            onClick={speech.listening ? speech.stopListening : speech.startListening}
          >
            <span className="mic-icon">🎤</span>
            <span className="mic-label">
              {speech.listening ? t.micListening : t.mic}
            </span>
            <span className="eq" aria-hidden="true">
              <i /><i /><i /><i /><i />
            </span>
          </button>

          {/* 实时识别中间结果 */}
          {speech.interim && (
            <p className="interim">「{speech.interim}」</p>
          )}

          {/* 聆听设置 */}
          <div className="toggles">
            <label className="toggle">
              <input
                type="checkbox"
                checked={continuous}
                onChange={(e) => setContinuous(e.target.checked)}
              />
              <span>{t.continuous}</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={voiceOn}
                onChange={(e) => setVoiceOn(e.target.checked)}
              />
              <span>{t.voiceFeedback}</span>
            </label>
          </div>

          {/* 文本输入 */}
          <div className="input-row">
            <input
              type="text"
              value={textInput}
              placeholder={t.inputPlaceholder}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && textInput.trim()) {
                  handleInput(textInput.trim());
                  setTextInput("");
                }
              }}
            />
            <button
              className="btn-send"
              disabled={!textInput.trim()}
              onClick={() => {
                if (textInput.trim()) {
                  handleInput(textInput.trim());
                  setTextInput("");
                }
              }}
            >
              {t.send}
            </button>
          </div>

          {/* 识别结果 */}
          <div className="result-box">
            <span className="label">{t.result}</span>
            <p>{shownLog}</p>
          </div>

          {/* 语音错误提示 */}
          {speech.error && <p className="error-msg">⚠️ {speech.error}</p>}

          {/* 历史指令 */}
          {cmdHistory.length > 0 && (
            <div className="history-box">
              <span className="label">{t.historyLabel}</span>
              {cmdHistory.slice().reverse().map((h, i) => (
                <p key={i} className="history-item" onClick={() => handleInput(h)}>{h}</p>
              ))}
            </div>
          )}

          {/* 示例指令 chips */}
          <div className="help-box">
            <span className="label">{t.helpLabel}</span>
            <div className="chips">
              {t.examples.map((ex) => (
                <button key={ex} className="chip" onClick={() => handleInput(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* 色板 */}
          <div className="palette-box">
            <span className="label">{t.palette}</span>
            <div className="palette">
              {PALETTE.map((c) => (
                <span key={c.hex} className="swatch" title={lang === "zh-CN" ? c.zh : c.en}>
                  <i style={{ background: c.hex }} />
                  <em>{lang === "zh-CN" ? c.zh : c.en}</em>
                </span>
              ))}
            </div>
          </div>
        </aside>

        {/* 右侧画布 */}
        <section className="canvas-wrap">
          {/* 画布工具条 */}
          <div className="canvas-toolbar">
            <div className="tool-group">
              <button onClick={undo} disabled={doc.past.length === 0}>↩ {t.undo}</button>
              <button onClick={redo} disabled={doc.future.length === 0}>↪ {t.redo}</button>
              <button onClick={clearAll} disabled={doc.shapes.length === 0}>🗑 {t.clear}</button>
            </div>
            <div className="tool-group">
              <button onClick={exportSvg} disabled={doc.shapes.length === 0}>⬇ {t.exportSvg}</button>
              <button onClick={exportPng} disabled={doc.shapes.length === 0}>⬇ {t.exportPng}</button>
            </div>
          </div>

          <svg
            ref={svgRef}
            width={WIDTH}
            height={HEIGHT}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="canvas"
            xmlns="http://www.w3.org/2000/svg"
            onMouseDown={() => setSelectedId(null)}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
          >
            {/* 背景 + 点阵网格 */}
            <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#fbfaf7" />
            <g fill="#d8d4c8">
              {Array.from({ length: Math.floor(WIDTH / 40) - 1 }, (_, i) =>
                Array.from({ length: Math.floor(HEIGHT / 40) - 1 }, (_, j) => (
                  <circle key={`${i}-${j}`} cx={(i + 1) * 40} cy={(j + 1) * 40} r="1.2" />
                ))
              )}
            </g>
            {/* 中心参考线 */}
            <line x1={WIDTH / 2} y1="0" x2={WIDTH / 2} y2={HEIGHT} stroke="#e7e3d8" strokeWidth="1" strokeDasharray="4" />
            <line x1="0" y1={HEIGHT / 2} x2={WIDTH} y2={HEIGHT / 2} stroke="#e7e3d8" strokeWidth="1" strokeDasharray="4" />

            {/* 图形 */}
            {doc.shapes.map((s) => (
              <g
                key={s.id}
                className="shape"
                transform={s.rotation ? `rotate(${s.rotation} ${s.x} ${s.y})` : undefined}
                onMouseDown={(e) => onShapeMouseDown(e, s)}
              >
                {renderShapeBody(s)}
              </g>
            ))}

            {/* 选中高亮框 */}
            {selected && (() => {
              const b = bbox(selected);
              return (
                <rect
                  className="select-ring"
                  x={b.x} y={b.y} width={b.w} height={b.h}
                  fill="none" stroke="#ff6b4a" strokeWidth="2"
                  strokeDasharray="6 4" rx="8"
                  transform={selected.rotation ? `rotate(${selected.rotation} ${selected.x} ${selected.y})` : undefined}
                  pointerEvents="none"
                />
              );
            })()}
          </svg>

          <p className="canvas-info">
            {t.shapesCount(doc.shapes.length)} · {selected ? t.selectedTip : t.canvasHint}
          </p>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
