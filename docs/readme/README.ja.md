<div align="center">

<img src="../assets/logo.svg" width="116" alt="arena-auto-chat ロゴ" />

# arena-auto-chat

**arena.ai アカウントをエンドツーエンドで作成し、ダイレクトチャットまで自動化。**
新しい使い捨て受信箱、マジックリンク認証、パスワード設定、そして最先端モデルとの実際の会話 —— コマンド1つで。

<br>

[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square)](#-依存ゼロ)
[![CDP](https://img.shields.io/badge/CDP-Chrome%20DevTools-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](#-仕組み)
[![arena.ai](https://img.shields.io/badge/target-arena.ai-7C5CFF?style=flat-square)](https://arena.ai)
[![License](https://img.shields.io/badge/License-MIT-2B8FD6?style=flat-square)](../../LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-555?style=flat-square)](#-要件)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-23D3A6?style=flat-square)](../../CONTRIBUTING.md)
[![No CI](https://img.shields.io/badge/CI-none%20(by%20design)-7C8EA0?style=flat-square)](#-設計思想)

<br>

[English](../../README.md) · [Bahasa Indonesia](README.id.md) · [Español](README.es.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

</div>

---

## ✨ できること

`arena-auto-chat` は実際の [arena.ai](https://arena.ai) Web クライアントを操作します。
1 つのアカウントに対して:

1. 🎲 ランダムな identity を生成 —— メールのローカル部、強力なパスワード、氏名。
2. 📧 新しい [zenvex.dev](https://zenvex.dev) 使い捨て受信箱を開く。
3. ✍️ アドレスを arena.ai のサインアップモーダルに送信。
4. 🔗 受信箱からマジックリンクを読み取り、開く。
5. 🔐 パスワードを設定し、セッションが有効であることを確認。
6. 💬 選択したモデルとの**ダイレクトチャット**を開き、メッセージをやり取り。

すべてエンドツーエンドで自動化され、VPS 上で実行できます。

> **アカウントごとの成果物:** メールアドレス、パスワード、そして
> 動作する arena.ai セッション —— ローカル JSON ファイルに保存されます。

## 🚀 クイックスタート

```bash
git clone https://github.com/0xgetz/arena-auto-chat.git
cd arena-auto-chat

# アカウントを作成し、モデルにテストメッセージを送信
node src/index.mjs run -m deepseek-v4.1-flash-max -p "test"
```

`npm install` は不要。ビルドも不要。必要なのは Node 22 と Chrome/Chromium のバイナリだけです。

## 🧩 要件

- **Node.js ≥ 22** —— CDP クライアントがネイティブのグローバル `WebSocket` を使うため。
- **Google Chrome または Chromium** —— 自動検出、または `CHROME_PATH` を設定。
- `arena.ai` と `zenvex.dev` へのネットワークアクセス。

## 📖 使い方

### コマンド

```bash
node src/index.mjs run      # アカウント作成後にチャット   （デフォルト）
node src/index.mjs create   # アカウント作成のみ
node src/index.mjs chat     # 既存のログインでチャット
```

### 例

```bash
# アカウントを作成してプロンプトを送信
node src/index.mjs run -m deepseek-v4.1-flash-max -p "test"

# 45 秒間隔で 3 アカウントを作成し、ファイルに出力
./examples/run_batch.sh 3 45

# ブラウザプロファイルに保存済みのログインでチャット
node src/index.mjs chat -m gpt-5 -p "雨についての俳句を書いて"

# すでにポート 9222 で起動中の Chrome を引き継ぐ
node src/index.mjs run --cdp http://127.0.0.1:9222

# 実際の動作を目で確認
node src/index.mjs run --headful
```

### オプション

| フラグ | 既定値 | 説明 |
| --- | --- | --- |
| `-n, --count N` | `1` | 作成するアカウント数。 |
| `-d, --domain D` | ランダム | zenvex の受信ドメインを固定。 |
| `-m, --model M` | `deepseek-v4.1-flash-max` | ダイレクトチャットのモデルスラッグ。 |
| `-p, --prompt TEXT` | `test` | 送信するメッセージ。 |
| `-o, --out FILE` | `outputs/arena-accounts-<ts>.json` | 出力 JSON ファイル。 |
| `--cdp URL` | — | 実行中のブラウザに接続（`ws://` または `http://`）。 |
| `-t, --timeout MS` | `180000` | 認証メールの待機ミリ秒。 |
| `--headful` | オフ | ブラウザウィンドウを表示。 |
| `-q, --quiet` | オフ | 最終サマリーのみ表示。 |
| `-h, --help` · `-v, --version` | — | ヘルプ · バージョン。 |

## 🔧 仕組み

```
CLI
 └─ BrowserManager / RemoteBrowser      Chromium を起動、または CDP で接続
     ├─ zenvex.dev      → 使い捨てアドレスを生成し、受信箱を開く
     ├─ arena.ai        → アドレスを送信し、マジックリンクを読み取る
     ├─ 受信箱          → リンクを開き、パスワードを設定し、ログインを確認
     └─ arena.ai        → ダイレクトチャットを開き、入力、送信、返信を読み取る
```

- **`src/browser/cdp.mjs`** —— Node ネイティブ `WebSocket` 上の約 180 行の
  Chrome DevTools Protocol クライアント。コマンドは多重化され、応答は `id`
  で対応付けられ、イベントは購読可能です。
- **`src/arena/dom.mjs`** —— arena.ai のすべてのセレクタとページスクリプト。
  arena.ai の UI 変更は通常この 1 ファイルの修正で済みます。
- **`src/arena/client.mjs`** —— サインアップ、マジックリンク、チャットのフロー。
- **`src/inbox/zenvex.mjs`** —— アドレス生成と受信箱の読み取り。
- **`src/core/provision.mjs`** —— 1 アカウントをエンドツーエンドで編成。

詳細な設計は [docs/ARCHITECTURE.md](../ARCHITECTURE.md)、設定とトラブル
シューティングは [docs/USAGE.md](../USAGE.md) を参照してください。

## 🪶 依存ゼロ

Node 22 には `fetch` と `WebSocket` が同梱されており、CDP クライアントに必要な
ものはこれで全部です。Puppeteer/Playwright を使わないことの意味:

- `git clone` から実行まで数秒 —— インストールするものが何もない、
- 監査すべき推移的依存ツリーが存在しない、
- ブラウザ接続がフレームワークの裏に隠れず、明示的である。

## 🔌 既存のブラウザに接続

```bash
# --remote-debugging-port=9222 で起動したデスクトップ Chrome
node src/index.mjs run --cdp http://127.0.0.1:9222

# ホスト型ブラウザ。WebSocket URL を使用
node src/index.mjs run --cdp wss://host/devtools/browser/<id>
```

スキームのないホスト名は `https://` と見なされます。最速のイテレーション手段
であり、別の出口 IP を持つブラウザを使う最も簡単な方法です。

## 📦 出力

`outputs/arena-accounts-<timestamp>.json`:

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

## ✅ エンドツーエンドテスト

```bash
node src/test_e2e.mjs --cdp http://127.0.0.1:9222
```

実際のサービスに対して各ステージを実行し、
`outputs/e2e-report-<ts>.json` を書き出します。終了コード 0 は全ステージ
成功を意味します。

## ⚙️ 設定

`.env.example` を `.env` にコピーします。フラグは環境変数より優先され、環境
変数はファイルより優先されます。

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `CHROME_PATH` | 自動 | Chrome/Chromium 実行ファイル。 |
| `HEADLESS` | `1` | ウィンドウなしで実行。 |
| `CDP_URL` | — | 起動せずに実行中のブラウザに接続。 |
| `BROWSER_PROXY` | — | ブラウザ専用プロキシ。例 `socks5://127.0.0.1:10808`。 |
| `PROFILE_DIR` | 一時 | 永続プロファイル。ログインを保持。 |
| `EMAIL_TIMEOUT` | `180000` | 認証メールの待機ミリ秒。 |
| `REPLY_TIMEOUT` | `180000` | チャット返信の待機ミリ秒。 |
| `ZENVEX_DOMAIN` | ランダム | zenvex の受信ドメインを固定。 |
| `ARENA_MODEL` | `deepseek-v4.1-flash-max` | 既定のチャットモデル。 |
| `ARENA_PROMPT` | `test` | 既定のチャットプロンプト。 |

## 🧠 設計思想

- **依存ゼロ。** Node 22 にすべてが揃っています。ブラウザフレームワークは
  リポジトリ全体より大きくなります。
- **小さく正直なモジュール。** 1 ファイル 1 責務、隠れた魔法はなし。
- **セレクタは 1 か所に。** arena.ai は変わります。`dom.mjs` が影響範囲です。
- **CI は意図的に無し。** このパイプラインはレート制限とアンチボットの壁を
  持つ第三者サイトとライブで通信します。毎プッシュの緑チェックはノイズに
  なるだけです。`src/test_e2e.mjs` を必要なときに実行してください。

## ⚠️ 免責事項

本プロジェクトは学習および技術研究のみを目的としています。arena.ai と
zenvex.dev の利用規約、および現地の法律を遵守する責任は利用者にあります。
アカウントの認証情報を公開・アップロードしないでください。

## 📄 ライセンス

[MIT](../../LICENSE)
