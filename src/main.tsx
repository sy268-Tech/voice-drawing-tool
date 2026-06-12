import React, { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { Drawable } from "./types";
import { WIDTH, HEIGHT } from "./constants";
import { parseVoiceCommand } from "./parser";
import { applyCommand } from "./engine";
import { useSpeechRecognition } from "./useSpeechRecognition";
import "./style.css";

/* ── SVG 渲染单个图形 ── */

function renderShape(s: Drawable) {
  switch (s.type) {
    case "circle":
      return (
        <circle
          key={s.id}
          cx={s.x}
          cy={s.y}
          r={s.width / 2}
          fill={s.color}
          stroke="#1e293b"
          strokeWidth="2"
        />
      );
    case "ellipse":
      return (
        <ellipse
          key={s.id}
          cx={s.x}
          cy={s.y}
          rx={s.width / 2}
          ry={s.height / 3}
          fill={s.color}
          stroke="#1e293b"
          strokeWidth="2"
        />
      );
    case "rect":
      return (
        <rect
          key={s.id}
          x={s.x - s.width / 2}
          y={s.y - s.height / 2}
          width={s.width}
          height={s.height}
          fill={s.color}
          stroke="#1e293b"
          strokeWidth="2"
          rx="4"
        />
      );
    case "triangle": {
      const top = `${s.x},${s.y - s.height / 2}`;
      const left = `${s.x - s.width / 2},${s.y + s.height / 2}`;
      const right = `${s.x + s.width / 2},${s.y + s.height / 2}`;
      return (
        <polygon
          key={s.id}
          points={`${top} ${left} ${right}`}
          fill={s.color}
          stroke="#1e293b"
          strokeWidth="2"
        />
      );
    }
    case "star": {
      const points = makeStarPoints(s.x, s.y, s.width / 2, s.width / 4, 5);
      return (
        <polygon
          key={s.id}
          points={points}
          fill={s.color}
          stroke="#1e293b"
          strokeWidth="2"
        />
      );
    }
    case "line":
      return (
        <line
          key={s.id}
          x1={s.x}
          y1={s.y}
          x2={s.x2 ?? s.x + s.width}
          y2={s.y2 ?? s.y}
          stroke={s.color}
          strokeWidth="4"
          strokeLinecap="round"
        />
      );
    case "text":
      return (
        <text
          key={s.id}
          x={s.x}
          y={s.y}
          fill={s.color}
          fontSize="32"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {s.text || "文字"}
        </text>
      );
    // ── 新增图形 ──
    case "arrow":
      return (
        <g key={s.id}>
          <line
            x1={s.x}
            y1={s.y}
            x2={s.x2 ?? s.x + s.width}
            y2={s.y2 ?? s.y}
            stroke={s.color}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <polygon
            points={arrowHeadPoints(s.x, s.y, s.x2 ?? s.x + s.width, s.y2 ?? s.y)}
            fill={s.color}
          />
        </g>
      );
    case "diamond": {
      const r = s.width / 2;
      const points = `${s.x},${s.y - r * 1.2} ${s.x + r},${s.y} ${s.x},${s.y + r * 1.2} ${s.x - r},${s.y}`;
      return (
        <polygon
          key={s.id}
          points={points}
          fill={s.color}
          stroke="#1e293b"
          strokeWidth="2"
        />
      );
    }
    case "heart": {
      const d = makeHeartPath(s.x, s.y, s.width / 2);
      return (
        <path
          key={s.id}
          d={d}
          fill={s.color}
          stroke="#1e293b"
          strokeWidth="2"
        />
      );
    }
    case "arc":
      return (
        <path
          key={s.id}
          d={makeArcPath(s.x, s.y, s.width / 2, s.height || s.width / 4)}
          fill="none"
          stroke={s.color}
          strokeWidth="4"
          strokeLinecap="round"
        />
      );
    case "hexagon": {
      const pts = makePolygonPoints(s.x, s.y, s.width / 2, 6);
      return (
        <polygon
          key={s.id}
          points={pts}
          fill={s.color}
          stroke="#1e293b"
          strokeWidth="2"
        />
      );
    }
    case "cloud": {
      const d = makeCloudPath(s.x, s.y, s.width / 2);
      return (
        <path
          key={s.id}
          d={d}
          fill={s.color}
          stroke="#1e293b"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      );
    }
    default:
      return null;
  }
}

/** 生成五角星顶点 */
function makeStarPoints(
  cx: number, cy: number,
  outerR: number, innerR: number,
  points: number
): string {
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
  const tipX = x2;
  const tipY = y2;
  const baseX = tipX - len * Math.cos(angle);
  const baseY = tipY - len * Math.sin(angle);
  const leftX = baseX - spread * Math.cos(angle - Math.PI / 2);
  const leftY = baseY - spread * Math.sin(angle - Math.PI / 2);
  const rightX = baseX - spread * Math.cos(angle + Math.PI / 2);
  const rightY = baseY - spread * Math.sin(angle + Math.PI / 2);
  return `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`;
}

/** 生成心形 SVG path */
function makeHeartPath(cx: number, cy: number, r: number): string {
  // 标准心形贝塞尔路径
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

/** 生成云朵 SVG path（多个圆弧拼接） */
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

/* ── 语音朗读反馈 ── */

function speak(text: string) {
  if (!text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

/* ── App 主组件 ── */

function App() {
  const [shapes, setShapes] = useState<Drawable[]>([]);
  const [log, setLog] = useState("说出指令开始绘图，例如：画一个红色圆形");
  const [textInput, setTextInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  const handleInput = useCallback((text: string) => {
    const commands = parseVoiceCommand(text);
    if (commands.length === 0) {
      setLog(`未能识别："${text}"\n→ 支持同音字模糊匹配，可尝试换种说法`);
      speak("没有听懂，请再说一次");
      return;
    }

    setShapes((prev) => {
      let current = prev;
      for (const cmd of commands) {
        current = applyCommand(current, cmd);
      }
      return current;
    });

    const summary = commands.map((c) => `${c.action}${c.shape ? " " + c.shape : ""}`).join(", ");
    setLog(`✓ ${text}\n→ ${summary}`);
    setHistory((h) => [...h.slice(-9), text]);
    speak(`已执行${commands.length}个指令`);
  }, []);

  const speech = useSpeechRecognition(handleInput);

  return (
    <main className="app">
      {/* 左侧控制面板 */}
      <aside className="panel">
        <h1>🎨 语音绘图</h1>
        <p className="subtitle">说出形状、颜色、位置，即可自动绘图</p>

        {/* 语音按钮 */}
        <button
          className={speech.listening ? "btn-mic listening" : "btn-mic"}
          onClick={speech.listening ? speech.stopListening : speech.startListening}
        >
          {speech.listening ? "🔴 正在聆听..." : "🎤 点击说话"}
        </button>

        {/* 文本输入 */}
        <div className="input-row">
          <input
            type="text"
            value={textInput}
            placeholder="或输入指令按回车..."
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
            发送
          </button>
        </div>

        {/* 快捷操作 */}
        <div className="actions">
          <button className="btn-secondary" onClick={() => handleInput("撤销")}>↩ 撤销</button>
          <button className="btn-secondary" onClick={() => handleInput("清空")}>🗑 清空</button>
        </div>

        {/* 识别结果 */}
        <div className="result-box">
          <span className="label">识别结果</span>
          <p>{log}</p>
        </div>

        {/* 语音错误提示 */}
        {speech.error && <p className="error-msg">⚠️ {speech.error}</p>}

        {/* 历史指令 */}
        {history.length > 0 && (
          <div className="history-box">
            <span className="label">历史指令</span>
            {history.map((h, i) => (
              <p key={i} className="history-item" onClick={() => handleInput(h)}>{h}</p>
            ))}
          </div>
        )}

        {/* 用法提示 */}
        <div className="help-box">
          <span className="label">支持的指令（含同音字识别）</span>
          <p>画一个红色圆形（元→圆自动纠正）</p>
          <p>在左上角画一个大的蓝色矩形</p>
          <p>画一个绿色三角形</p>
          <p>画一个黄色五角星 / 粉色爱心</p>
          <p>画一个红色箭头 / 蓝色菱形</p>
          <p>画一个紫色六边形 / 白色云朵</p>
          <p>画一条弧形 / 写Hello</p>
          <p>把圆形移到右边 / 将矩形改为红色</p>
          <p>把圆放大 / 删掉三角形</p>
          <p>撤销 / 清空</p>
          <p className="help-note">💡 共13种图形 · 同音字自动容错匹配</p>
        </div>
      </aside>

      {/* 右侧画布 */}
      <section className="canvas-wrap">
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="canvas"
        >
          {/* 背景 */}
          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#fafafa" />
          {/* 网格参考线 */}
          <line x1={WIDTH / 2} y1="0" x2={WIDTH / 2} y2={HEIGHT} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" />
          <line x1="0" y1={HEIGHT / 2} x2={WIDTH} y2={HEIGHT / 2} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" />
          {/* 图形 */}
          {shapes.map(renderShape)}
        </svg>
        <p className="canvas-info">画布 {WIDTH}×{HEIGHT} · 已绘制 {shapes.length} 个图形</p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
