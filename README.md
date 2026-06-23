# CLI Manager

[中文](#中文) | [English](#english)

Desktop application for managing and monitoring multiple AI CLIs in one place.

Currently supported:

- Claude CLI
- GitHub Copilot CLI
- Codex CLI
- Qoder CLI

## 中文

### 项目简介

CLI Manager 是一个基于 Electron + React 构建的桌面应用，用来统一管理多个 AI 命令行工具。它把终端会话、运行状态、配置读写和历史记录整合到一个界面里，适合在本地同时使用多种 CLI 的开发场景。

### 核心功能

- 多 CLI 统一入口：在同一个应用中管理 Claude CLI、GitHub Copilot CLI、Codex CLI 和 Qoder CLI
- 内置终端会话：通过集成式终端直接启动和使用各类 CLI
- 状态监控：查看 CLI 是否安装、版本号、运行状态、PID、CPU 和内存占用
- 配置管理：读取和写入对应 CLI 的配置目录或配置文件
- 会话与历史：保存对话/命令历史，支持收藏与后续检索
- 桌面端体验：基于 Electron，适合本地开发环境常驻使用

### 技术栈

- Electron 28
- React 18
- TypeScript
- Vite 5
- xterm.js
- node-pty
- Zustand
- Tailwind CSS
- better-sqlite3

### 快速开始

#### 环境要求

- Node.js 18+
- npm 9+
- 本机已安装至少一种目标 CLI

#### 安装依赖

```bash
npm install
```

#### 启动开发环境

```bash
npm run dev
```

macOS 下也可以直接双击项目根目录的 `start-mac.command` 一键启动。

#### 全局后台启动命令

在项目根目录执行一次：

```bash
npm link
```

之后可以在任意目录后台启动 CLI Manager：

```bash
cli-manager-start
```

启动日志会写入 `~/.cli-manager/cli-manager-dev.log`，PID 会写入 `~/.cli-manager/cli-manager-dev.pid`。

#### 构建产物

```bash
npm run build
```

#### 打包桌面应用

```bash
npm run package
```

平台打包命令：

```bash
npm run package:mac:dir
npm run package:mac:dir:smoke
npm run package:mac
npm run package:win
npm run package:linux
```

#### 原生模块与冒烟验证

项目依赖 `better-sqlite3` 和 `node-pty` 原生模块。安装依赖后会自动按 Electron ABI 重建；如果切换 Electron/Node 版本或遇到 native module 加载失败，可手动执行：

```bash
npm run rebuild:native
npm run smoke:native
```

打包后可验证产物结构、`app.asar.unpacked` 内的原生模块，以及打包应用是否能无界面启动并自动退出：

```bash
npm run smoke:package
```

### 常用脚本

```bash
npm run dev
npm run start:background
npm run build
npm run build:electron
npm run typecheck
npm run test
npm run preview
npm run rebuild
npm run rebuild:native
npm run smoke:native
npm run smoke:package
npm run smoke:full
npm run lint
```

### 项目结构

```text
cli-manager/
├── electron/                 # Electron 主进程与本地服务
│   ├── main.ts               # 主进程入口
│   ├── preload.ts            # 预加载脚本 / IPC bridge
│   └── services/             # CLI 状态、终端、配置、会话等服务
├── src/                      # React 前端
│   ├── components/           # 页面与界面组件
│   ├── hooks/                # 自定义 hooks
│   ├── stores/               # Zustand 状态管理
│   ├── types/                # TypeScript 类型定义
│   └── utils/                # 工具函数
├── public/                   # 静态资源
├── package.json              # 项目脚本与依赖
└── electron-builder.json     # 打包配置
```

### 适用场景

- 需要在一个桌面应用里统一管理多个 AI CLI
- 希望减少频繁切换终端窗口和配置目录
- 需要观察 CLI 进程状态和资源占用
- 需要保留历史记录做复用或追踪

### License

MIT

---

## English

### Overview

CLI Manager is a desktop app built with Electron and React for managing multiple AI command-line tools from a single interface. It combines terminal sessions, runtime status, config access, and command history in one place for local development workflows.

### Features

- Unified CLI hub for Claude CLI, GitHub Copilot CLI, Codex CLI, and Qoder CLI
- Embedded terminal sessions for launching and using each CLI directly
- Status monitoring for installation state, version, process status, PID, CPU, and memory usage
- Configuration management for reading and writing CLI-specific config files
- Conversation and command history with favorites support
- Desktop-first workflow designed for local multi-CLI usage

### Tech Stack

- Electron 28
- React 18
- TypeScript
- Vite 5
- xterm.js
- node-pty
- Zustand
- Tailwind CSS
- better-sqlite3

### Getting Started

#### Requirements

- Node.js 18+
- npm 9+
- At least one supported CLI installed locally

#### Install dependencies

```bash
npm install
```

#### Start development

```bash
npm run dev
```

#### Global background launcher

Run this once in the project root:

```bash
npm link
```

Then start CLI Manager in the background from any directory:

```bash
cli-manager-start
```

Logs are written to `~/.cli-manager/cli-manager-dev.log`, and the PID is stored in `~/.cli-manager/cli-manager-dev.pid`.

#### Build the app

```bash
npm run build
```

#### Package for distribution

```bash
npm run package
```

Platform-specific packaging:

```bash
npm run package:mac:dir
npm run package:mac:dir:smoke
npm run package:mac
npm run package:win
npm run package:linux
```

#### Native modules and smoke checks

The app uses native modules (`better-sqlite3` and `node-pty`). `npm install` rebuilds them for Electron automatically. If you change Electron/Node versions or see native module load errors, run:

```bash
npm run rebuild:native
npm run smoke:native
```

After packaging, validate the artifact layout, native modules under `app.asar.unpacked`, and a headless packaged-app launch/quit cycle:

```bash
npm run smoke:package
```

### Useful Scripts

```bash
npm run dev
npm run start:background
npm run build
npm run build:electron
npm run typecheck
npm run test
npm run preview
npm run rebuild
npm run rebuild:native
npm run smoke:native
npm run smoke:package
npm run smoke:full
npm run lint
```

### Project Structure

```text
cli-manager/
├── electron/                 # Electron main process and local services
│   ├── main.ts               # Main process entry
│   ├── preload.ts            # Preload script / IPC bridge
│   └── services/             # CLI status, terminal, config, and conversation services
├── src/                      # React frontend
│   ├── components/           # UI components and panels
│   ├── hooks/                # Custom hooks
│   ├── stores/               # Zustand stores
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility helpers
├── public/                   # Static assets
├── package.json              # Scripts and dependencies
└── electron-builder.json     # Packaging configuration
```

### Use Cases

- Managing multiple AI CLIs from one desktop interface
- Reducing context switching between terminals and config directories
- Monitoring running CLI processes and resource usage
- Keeping reusable command or conversation history

### License

MIT
