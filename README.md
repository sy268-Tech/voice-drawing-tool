# AI 语音绘图工具 🎨

基于 **Vite + React + TypeScript + SVG** 的纯语音绘图应用。使用浏览器 Web Speech API 进行中文语音识别，支持本地规则解析和**大模型（LLM）智能解析**双模式。

## ✨ 功能

- 🎤 **语音识别**：浏览器 Web Speech API，支持中文
- 🧠 **大模型解析**：接入 OpenAI 兼容 LLM，理解任意自然语言绘图指令
- 📐 **本地解析**：前端规则引擎，无需网络即可处理预设指令
- 🎨 **SVG 绘图**：对象级绘图，支持移动、缩放、删除
- 🔄 **失败回退**：LLM 调用失败时自动回退到本地解析

### 支持绘制的图形

| 图形 | 说明 |
|------|------|
| ⭕ 圆形 | 普通圆形 |
| ⬜ 矩形 | 矩形 / 方形 |
| 📏 线条 | 直线 |
| 📝 文字 | 自定义文字 |
| ☀️ 太阳 | 圆形（默认黄色） |
| 🌳 树 | 圆形树冠 + 树干 |
| 🌿 草地 | 底部绿色矩形背景 |
| ☁️ 天空 | 顶部蓝色矩形背景 |

### 支持的操作

绘制 · 移动 · 缩放 · 删除 · 撤销 · 清空

### 复杂指令拆解

自动将"画蓝色天空和绿色草地，然后在右上角画一个太阳"拆解为多条指令依次执行。

## 🚀 快速开始

```bash
npm install
npm run dev
```

用 **Chrome** 浏览器打开终端显示的地址，点击「开始语音」即可。

> ⚠️ Web Speech API 在 Chrome 中支持最好，建议使用 Chrome。

## 🤖 大模型配置

在界面左侧「🤖 大模型配置」面板中展开设置：

1. **启用大模型解析**：打开开关
2. **快捷选择**：下拉选择预设模型（自动填入 API 地址和模型名）
3. **API Key**：填入你的 API Key
4. **测试连接**：点击验证配置
5. 开始语音绘图

### 支持的 LLM 提供商

| 提供商 | 默认 API 地址 | 可用模型 |
|--------|--------------|---------|
| OpenAI | `https://api.openai.com/v1` | gpt-4o-mini, gpt-4o, gpt-4-turbo, o3-mini |
| DeepSeek | `https://api.deepseek.com/v1` | deepseek-chat, deepseek-reasoner, deepseek-v4-pro |
| 阿里百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | qwen-plus, qwen-max, qwen-turbo |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | glm-4-flash, glm-4-plus |
| Moonshot | `https://api.moonshot.cn/v1` | moonshot-v1-8k |
| Ollama | `http://localhost:11434/v1` | 本地模型 |

任何兼容 OpenAI Chat Completions API 的服务均可使用。

> 🔒 API Key 仅保存在浏览器 localStorage，不会上传到任何服务器。

## 🗣️ 语音指令示例

### 本地解析模式

| 指令 | 效果 |
|------|------|
| 画一个红色圆形 | 在画布中央画红色圆 |
| 在右上角画一个黄色太阳 | 在右上角画太阳 |
| 画蓝色天空和绿色草地 | 批量绘制天空和草地 |
| 画一棵树 | 在中央画一棵树 |
| 把太阳移动到左上角 | 移动太阳到左上角 |
| 把刚才的圆变大 | 放大最近画的圆 |
| 撤销 | 撤销上一步 |
| 清空画布 | 清除所有图形 |

### 大模型模式（可理解任意自然语言）

| 指令 |
|------|
| 在画布左边画一个紫色的大圆形 |
| 画一片蓝天，下面画绿色草地，中间画一棵大树 |
| 在左上角写"Hello World"，红色字体 |
| 把树变小一点 |
| 把圆形向右移动 |

## 🏗️ 项目结构

```
voice-drawing-tool/
├── index.html          # 入口 HTML
├── package.json        # 依赖与脚本
├── tsconfig.json       # TypeScript 配置
├── vite.config.ts      # Vite 配置
└── src/
    ├── main.tsx        # 应用主代码（含 LLM 客户端）
    └── style.css       # 样式
```

## 🔧 技术实现

1. **语音识别**：Web Speech API（`SpeechRecognition`），语言设置为 `zh-CN`
2. **本地解析**：关键词匹配 + 规则拆解，将中文指令转为 Command 对象
3. **LLM 解析**：调用 OpenAI 兼容 API，System Prompt 约束输出结构化 JSON
4. **SVG 渲染**：React 组件驱动 SVG，每个图形为独立 DOM 节点
5. **语音反馈**：Web Speech API（`SpeechSynthesis`）语音播报执行结果

## 📦 构建部署

```bash
npm run build     # 生产构建，输出到 dist/
npm run preview   # 预览构建结果
```

`dist/` 目录可直接部署到任意静态托管服务（Vercel、Netlify、GitHub Pages 等）。

## 🔮 可扩展方向

- 支持画布导出 PNG / SVG
- 多轮对话与语音确认纠错
- 手势 + 语音混合交互
- 接入更多 LLM 提供商
- 图形库扩展（箭头、星形、多边形等）
