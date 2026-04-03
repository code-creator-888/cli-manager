#!/bin/zsh

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "CLI Manager macOS 启动脚本"
echo "项目目录: $SCRIPT_DIR"
echo ""

cd "$SCRIPT_DIR" || {
  echo "无法进入项目目录: $SCRIPT_DIR"
  read -r "?按回车退出..."
  exit 1
}

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js，请先安装 Node.js 18+"
  read -r "?按回车退出..."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "未检测到 npm，请先安装 npm 9+"
  read -r "?按回车退出..."
  exit 1
fi

echo "Node 版本: $(node -v)"
echo "npm 版本: $(npm -v)"
echo ""

if [ ! -d "node_modules" ]; then
  echo "未检测到 node_modules，开始安装依赖..."
  npm install
  INSTALL_EXIT_CODE=$?

  if [ $INSTALL_EXIT_CODE -ne 0 ]; then
    echo ""
    echo "依赖安装失败，退出码: $INSTALL_EXIT_CODE"
    read -r "?按回车退出..."
    exit $INSTALL_EXIT_CODE
  fi

  echo ""
fi

echo "正在启动 CLI Manager 开发环境..."
echo "关闭当前终端窗口即可停止服务。"
echo ""

npm run dev
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "CLI Manager 已退出。"
else
  echo "CLI Manager 启动失败或异常退出，退出码: $EXIT_CODE"
fi

read -r "?按回车关闭窗口..."
exit $EXIT_CODE
