#!/usr/bin/env bash
set -e

echo ""
echo "  ╔══════════════════════════════════╗"
echo "  ║       話窓 Hanamado           ║"
echo "  ║   日语 AI 对话学习工具          ║"
echo "  ╚══════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装 Node.js"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

echo "[信息] Node.js 版本: $(node -v)"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "[信息] 首次运行，正在安装依赖..."
    echo ""
    npm install
    echo ""
    echo "[成功] 依赖安装完成！"
fi

echo ""
echo "[启动] 正在启动开发服务器..."
echo "[提示] 浏览器将自动打开 http://localhost:5173"
echo "[提示] 按 Ctrl+C 停止服务器"
echo ""

# Open browser based on OS
case "$(uname -s)" in
    Darwin)    open http://localhost:5173 ;;
    Linux)     xdg-open http://localhost:5173 2>/dev/null || true ;;
    MINGW*|MSYS*|CYGWIN*)  start http://localhost:5173 ;;
esac

npx vite --host 0.0.0.0 --port 5173