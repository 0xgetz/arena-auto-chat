<div align="center">

<img src="../assets/logo.svg" width="116" alt="arena-auto-chat 标志" />

# arena-auto-chat

**端到端创建 arena.ai 账号并自动进行直接对话。**
全新临时收件箱、魔法链接验证、设置密码，以及与前沿模型的真实对话 —— 一条命令完成。

<br>

[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square)](#-零依赖)
[![CDP](https://img.shields.io/badge/CDP-Chrome%20DevTools-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](#-工作原理)
[![arena.ai](https://img.shields.io/badge/target-arena.ai-7C5CFF?style=flat-square)](https://arena.ai)
[![License](https://img.shields.io/badge/License-MIT-2B8FD6?style=flat-square)](../../LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-555?style=flat-square)](#-环境要求)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-23D3A6?style=flat-square)](../../CONTRIBUTING.md)
[![No CI](https://img.shields.io/badge/CI-none%20(by%20design)-7C8EA0?style=flat-square)](#-设计理念)

<br>

[English](../../README.md) · [Bahasa Indonesia](README.id.md) · [Español](README.es.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

</div>

---

## ✨ 功能

`arena-auto-chat` 驱动真实的 [arena.ai](https://arena.ai) 网页客户端。
针对一个账号，它会：

1. 🎲 生成随机身份 —— 邮箱本地部分、强密码、全名。
2. 📧 打开一个全新的 [zenvex.dev](https://zenvex.dev) 临时收件箱。
3. ✍️ 将邮箱地址提交到 arena.ai 的注册弹窗。
4. 🔗 从收件箱读取魔法链接并打开它。
5. 🔐 设置密码，并确认会话已激活。
6. 💬 与所选模型开启**直接对话**并交换消息。

全流程自动化，可直接在 VPS 上运行。

> **每个账号的产出：** 邮箱、密码，以及一个可用的 arena.ai 会话 ——
> 保存在本地 JSON 文件中。

## 🚀 快速开始

```bash
git clone https://github.com/0xgetz/arena-auto-chat.git
cd arena-auto-chat

# 创建一个账号，并向模型发送一条测试消息
node src/index.mjs run -m deepseek-v4.1-flash-max -p "test"
```

无需 `npm install`，无需构建。只需要 Node 22 和一个 Chrome/Chromium 可执行文件。

## 🧩 环境要求

- **Node.js ≥ 22** —— 因为 CDP 客户端使用原生全局 `WebSocket`。
- **Google Chrome 或 Chromium** —— 自动探测，或设置 `CHROME_PATH`。
- 能访问 `arena.ai` 和 `zenvex.dev`。

## 📖 用法

### 命令

```bash
node src/index.mjs run      # 创建账号后对话   （默认）
node src/index.mjs create   # 仅创建账号
node src/index.mjs chat     # 使用已有登录状态对话
```

### 示例

```bash
# 创建一个账号并发送提示
node src/index.mjs run -m deepseek-v4.1-flash-max -p "test"

# 创建三个账号，间隔 45 秒，写入文件
./examples/run_batch.sh 3 45

# 使用浏览器配置中已保存的登录状态对话
node src/index.mjs chat -m gpt-5 -p "写一首关于雨的俳句"

# 接管你已经运行在 9222 端口的 Chrome
node src/index.mjs run --cdp http://127.0.0.1:9222

# 观看实际过程
node src/index.mjs run --headful
```

### 选项

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `-n, --count N` | `1` | 要创建的账号数量。 |
| `-d, --domain D` | 随机 | 固定 zenvex 接收域名。 |
| `-m, --model M` | `deepseek-v4.1-flash-max` | 直接对话的模型标识。 |
| `-p, --prompt TEXT` | `test` | 要发送的消息。 |
| `-o, --out FILE` | `outputs/arena-accounts-<ts>.json` | 输出 JSON 文件。 |
| `--cdp URL` | — | 连接到运行中的浏览器（`ws://` 或 `http://`）。 |
| `-t, --timeout MS` | `180000` | 等待验证邮件的毫秒数。 |
| `--headful` | 关闭 | 显示浏览器窗口。 |
| `-q, --quiet` | 关闭 | 只打印最终摘要。 |
| `-h, --help` · `-v, --version` | — | 帮助 · 版本。 |

## 🔧 工作原理

```
CLI
 └─ BrowserManager / RemoteBrowser      启动 Chromium 或通过 CDP 连接
     ├─ zenvex.dev      → 生成临时地址，打开其收件箱
     ├─ arena.ai        → 提交地址，读取魔法链接
     ├─ 收件箱          → 打开链接，设置密码，确认登录
     └─ arena.ai        → 打开直接对话，输入，发送，读取回复
```

- **`src/browser/cdp.mjs`** —— 约 180 行的 Chrome DevTools 协议客户端，基于
  Node 原生 `WebSocket`。命令多路复用，响应按 `id` 关联，事件可订阅。
- **`src/arena/dom.mjs`** —— 所有 arena.ai 选择器和页面脚本。arena.ai 的
  UI 变动通常只需修改这一个文件。
- **`src/arena/client.mjs`** —— 注册、魔法链接与对话流程。
- **`src/inbox/zenvex.mjs`** —— 地址生成与收件箱读取。
- **`src/core/provision.mjs`** —— 端到端编排单个账号。

完整设计见 [docs/ARCHITECTURE.md](../ARCHITECTURE.md)，配置与排错见
[docs/USAGE.md](../USAGE.md)。

## 🪶 零依赖

Node 22 内置 `fetch` 和 `WebSocket`，这正是 CDP 客户端所需的全部。不使用
Puppeteer/Playwright 意味着：

- 从 `git clone` 到运行只需几秒 —— 无需安装任何东西，
- 没有需要审计的传递依赖树，
- 浏览器连接是显式的，而非隐藏在框架背后。

## 🔌 连接到已有浏览器

```bash
# 用 --remote-debugging-port=9222 启动的桌面 Chrome
node src/index.mjs run --cdp http://127.0.0.1:9222

# 托管浏览器，使用其 WebSocket URL
node src/index.mjs run --cdp wss://host/devtools/browser/<id>
```

不带协议的主机名默认使用 `https://`。这是最快的迭代方式，也是使用不同出口
IP 浏览器的最简单方式。

## 📦 输出

`outputs/arena-accounts-<timestamp>.json`：

```json
[
  {
    "ok": true,
    "provider": "arena.ai",
    "email": "swiftfox482913@souss.dev",
    "password": "K7!mQ2pXz9wRt4vB",
    "full_name": "Putri Maharani",
    "email_provider": "zenvex.dev (souss.dev)",
    "login_url": "https://arena.ai/",
    "elapsed_ms": 41230,
    "created_at": "2026-10-01T16:12:48.031Z"
  }
]
```

## ✅ 端到端测试

```bash
node src/test_e2e.mjs --cdp http://127.0.0.1:9222
```

对真实服务执行每个阶段，并写入 `outputs/e2e-report-<ts>.json`。退出码 0
表示所有阶段通过。

## ⚙️ 配置

将 `.env.example` 复制为 `.env`。命令行参数优先于环境变量，环境变量优先于
配置文件。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `CHROME_PATH` | 自动 | Chrome/Chromium 可执行文件。 |
| `HEADLESS` | `1` | 无窗口运行。 |
| `CDP_URL` | — | 连接运行中的浏览器而非启动新的。 |
| `BROWSER_PROXY` | — | 仅浏览器代理，例如 `socks5://127.0.0.1:10808`。 |
| `PROFILE_DIR` | 临时 | 持久化配置目录；保留登录状态。 |
| `EMAIL_TIMEOUT` | `180000` | 等待验证邮件的毫秒数。 |
| `REPLY_TIMEOUT` | `180000` | 等待对话回复的毫秒数。 |
| `ZENVEX_DOMAIN` | 随机 | 固定 zenvex 接收域名。 |
| `ARENA_MODEL` | `deepseek-v4.1-flash-max` | 默认对话模型。 |
| `ARENA_PROMPT` | `test` | 默认对话提示。 |

## 🧠 设计理念

- **零依赖。** Node 22 已具备一切；浏览器框架会比整个仓库还大。
- **小而诚实的模块。** 每个文件单一职责，没有隐藏魔法。
- **选择器集中在一处。** arena.ai 会变；`dom.mjs` 就是影响范围。
- **刻意不设 CI。** 该流水线要与有速率限制和反机器人门槛的第三方实时站点
  通信。每次推送都亮绿勾只会是噪音；请按需运行 `src/test_e2e.mjs`。

## ⚠️ 免责声明

本项目仅供学习与技术研究。你有责任遵守 arena.ai 和 zenvex.dev 的服务条款
以及当地法律。切勿公开或上传任何账号凭据。

## 📄 许可证

[MIT](../../LICENSE)
