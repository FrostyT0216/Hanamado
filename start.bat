@echo off
chcp 65001 >nul
title 話窓 Hanamado

echo.
echo   ╔══════════════════════════════════╗
echo   ║       話窓 Hanamado           ║
echo   ║   日语 AI 对话学习工具          ║
echo   ╚══════════════════════════════════╝
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Display Node.js version
for /f "tokens=*" %%i in ('node -v') do echo [信息] Node.js 版本: %%i

:: Check if dependencies are installed
if not exist "node_modules\" (
    echo.
    echo [信息] 首次运行，正在安装依赖...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [错误] 依赖安装失败，请检查网络连接后重试
        pause
        exit /b 1
    )
    echo.
    echo [成功] 依赖安装完成！
)

echo.
echo [启动] 正在启动开发服务器...
echo [提示] 浏览器将自动打开 http://localhost:5173
echo [提示] 按 Ctrl+C 停止服务器
echo.

:: Start dev server and open browser
start "" http://localhost:5173
npx vite --host 0.0.0.0 --port 5173

pause