# 話窓 Hanamado

> 一款纯网页架构的日语 AI 对话学习工具，通过 AI 角色对话提升日语能力。

## ✨ 功能特色

- **AI 角色对话**：与 6 种不同角色（便利店店员、大学朋友、面试官、居酒屋老板、旅行向导、同事）进行情景对话
- **三级难度**：初级（N5–N4）、中级（N3–N2）、高级（N1+），自动调整 AI 用词和语法复杂度
- **自动分词**：AI 回复自动分词，每个词可点击查词
- **点击查词**：点击任意单词，右侧面板弹出字典详情（读音、词性、释义）
- **语法查询**：选中句子 → "询问语法"，AI 用中文解释语法点
- **Apple 风格**：毛玻璃效果、圆角卡片、柔和阴影、浅色/深色模式
- **本地存储**：所有数据保存在浏览器，刷新不丢失
- **API 灵活配置**：支持 OpenAI 兼容接口（GPT-4o、DeepSeek 等）

## 🛠️ 技术栈

- **框架**：React 18 + TypeScript
- **构建工具**：Vite
- **样式**：Tailwind CSS + 自定义毛玻璃效果
- **状态管理**：Zustand（persist 中间件）
- **Markdown 渲染**：react-markdown
- **图标**：game-icon-pack（自定义 SVG 封装）
- **部署**：Vercel（静态站点）

## 🚀 快速开始

### 前提条件

- Node.js 18+
- npm 或 pnpm

### 一键启动（推荐）

**Windows 用户**：双击 `start.bat` 即可自动安装依赖并启动应用。

**Mac / Linux 用户**：终端运行 `./start.sh`（首次需 `chmod +x start.sh`）。

**命令行方式**：

```bash
npm start
```

以上方式均会自动打开浏览器访问 `http://localhost:5173`。

### 安装与运行

```bash
# 克隆项目
git clone <repo-url>
cd hanamado

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

### 配置 API

1. 启动应用后，点击左侧栏 ⚙️ 设置图标
2. 填写 API 配置：
   - **API 基础 URL**：如 `https://api.openai.com/v1`
   - **API Key**：你的 API 密钥（仅保存在本地浏览器）
   - **模型名称**：如 `gpt-4o-mini`、`deepseek-chat`
3. 点击「测试连接」验证配置
4. 保存后即可开始对话

### 安全提示

> ⚠️ API Key 仅保存在本地浏览器 localStorage 中，不会上传至任何服务器。
> 建议使用额度较小的 API Key 或设置使用限额。
> 如需更高安全性，可部署 Vercel Edge Functions 代理 API 请求。

## 📁 项目结构

```
hanamado/
├── public/
│   ├── favicon.svg
│   └── dict/                    # 离线词典数据（可选）
├── src/
│   ├── components/
│   │   ├── layout/              # 布局组件
│   │   │   ├── AppLayout.tsx    # 三栏布局
│   │   │   ├── Sidebar.tsx      # 左侧栏
│   │   │   ├── ChatArea.tsx     # 中央聊天区
│   │   │   └── KnowledgePanel.tsx # 右侧知识面板
│   │   ├── chat/                # 聊天组件
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── TokenBlock.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   ├── GrammarMenu.tsx
│   │   │   └── EmptyState.tsx
│   │   ├── sidebar/             # 侧栏组件
│   │   ├── panel/               # 面板组件
│   │   ├── dialogs/             # 对话框
│   │   ├── common/              # 通用组件
│   │   └── about/               # 关于页面
│   ├── hooks/                   # 自定义 Hooks
│   │   ├── useChat.ts           # AI 对话编排
│   │   ├── useDictionary.ts     # 词典查询
│   │   ├── useTextSelection.ts  # 文本选择
│   │   └── useAutoScroll.ts     # 自动滚动
│   ├── services/                # 服务层
│   │   ├── ai.ts                # AI API 调用
│   │   ├── dictionary.ts        # 词典服务
│   │   └── storage.ts           # 存储服务
│   ├── store/
│   │   └── chatStore.ts         # Zustand 状态管理
│   ├── types/
│   │   └── index.ts             # 类型定义
│   ├── utils/                   # 工具函数
│   ├── data/
│   │   └── roles.ts             # 角色数据
│   └── context/
│       └── ThemeContext.tsx      # 主题上下文
├── docs/
│   └── REQUIREMENTS.md          # 需求文档
├── vercel.json                  # Vercel 部署配置
└── README.md
```

## 📦 部署到 Vercel

### 静态站点部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel --prod
```

### 环境变量（可选）

在 Vercel 仪表板中设置：

| 变量名 | 说明 |
|--------|------|
| `VITE_APP_NAME` | 应用名称 |

## 🔧 开发说明

- 桌面端优先设计（≥1024px），移动端基础适配
- 所有会话数据保存在 localStorage，使用 Zustand persist 中间件自动同步
- API Key 使用 Base64 编码存储（非真正加密，仅防明文泄露）
- 词典数据按需懒加载，不阻塞首屏渲染

## 📄 许可

MIT