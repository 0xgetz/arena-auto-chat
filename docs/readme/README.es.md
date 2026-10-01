<div align="center">

<img src="../assets/logo.svg" width="116" alt="logotipo de arena-auto-chat" />

# arena-auto-chat

**Creador de cuentas de arena.ai de extremo a extremo y automatización de chat directo.**
Bandeja desechable nueva, verificación por enlace mágico, creación de contraseña y un chat real con un modelo de frontera — en un solo comando.

<br>

[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square)](#-cero-dependencias)
[![CDP](https://img.shields.io/badge/CDP-Chrome%20DevTools-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](#-cómo-funciona)
[![arena.ai](https://img.shields.io/badge/target-arena.ai-7C5CFF?style=flat-square)](https://arena.ai)
[![License](https://img.shields.io/badge/License-MIT-2B8FD6?style=flat-square)](../../LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-555?style=flat-square)](#-requisitos)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-23D3A6?style=flat-square)](../../CONTRIBUTING.md)
[![No CI](https://img.shields.io/badge/CI-none%20(by%20design)-7C8EA0?style=flat-square)](#-filosofía)

<br>

[English](../../README.md) · [Bahasa Indonesia](README.id.md) · [Español](README.es.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

</div>

---

## ✨ Qué hace

`arena-auto-chat` controla el cliente web real de [arena.ai](https://arena.ai).
Para una cuenta:

1. 🎲 Genera una identidad aleatoria — parte local del correo, contraseña fuerte, nombre completo.
2. 📧 Abre una bandeja desechable nueva de [zenvex.dev](https://zenvex.dev).
3. ✍️ Envía la dirección al modal de registro de arena.ai.
4. 🔗 Lee el enlace mágico de verificación de la bandeja y lo abre.
5. 🔐 Establece una contraseña y confirma que la sesión está activa.
6. 💬 Abre un **chat directo** con el modelo elegido e intercambia mensajes.

Todo está automatizado de principio a fin y listo para ejecutarse en un VPS.

> **Resultado por cuenta:** el correo, la contraseña y una sesión de arena.ai
> funcional — guardados en un archivo JSON local.

## 🚀 Inicio rápido

```bash
git clone https://github.com/0xgetz/arena-auto-chat.git
cd arena-auto-chat

# Crea una cuenta y envía un mensaje de prueba a un modelo
node src/index.mjs run -m deepseek-v4.1-flash-max -p "test"
```

Sin `npm install`. Sin compilación. Solo necesitas Node 22 y un binario de
Chrome/Chromium.

## 🧩 Requisitos

- **Node.js ≥ 22** — por el global nativo `WebSocket` que usa el cliente CDP.
- **Google Chrome o Chromium** — se detecta automáticamente, o define `CHROME_PATH`.
- Acceso de red a `arena.ai` y `zenvex.dev`.

## 📖 Uso

### Comandos

```bash
node src/index.mjs run      # crea una cuenta y luego chatea   (por defecto)
node src/index.mjs create   # solo crea una cuenta
node src/index.mjs chat     # chatea con el inicio de sesión existente
```

### Ejemplos

```bash
# Crea una cuenta y envía un prompt
node src/index.mjs run -m deepseek-v4.1-flash-max -p "test"

# Crea tres cuentas, con 45s entre ellas, en un archivo
./examples/run_batch.sh 3 45

# Chatea con el inicio de sesión ya existente en el perfil del navegador
node src/index.mjs chat -m gpt-5 -p "escribe un haiku sobre la lluvia"

# Controla un Chrome que ya tienes abierto en el puerto 9222
node src/index.mjs run --cdp http://127.0.0.1:9222

# Míralo en acción
node src/index.mjs run --headful
```

### Opciones

| Flag | Por defecto | Descripción |
| --- | --- | --- |
| `-n, --count N` | `1` | Número de cuentas a crear. |
| `-d, --domain D` | aleatorio | Fija un dominio receptor de zenvex. |
| `-m, --model M` | `deepseek-v4.1-flash-max` | Slug del modelo para el chat directo. |
| `-p, --prompt TEXT` | `test` | Mensaje a enviar. |
| `-o, --out FILE` | `outputs/arena-accounts-<ts>.json` | Archivo JSON de salida. |
| `--cdp URL` | — | Conéctate a un navegador en ejecución (`ws://` o `http://`). |
| `-t, --timeout MS` | `180000` | Tiempo de espera del correo de verificación. |
| `--headful` | off | Muestra la ventana del navegador. |
| `-q, --quiet` | off | Imprime solo el resumen final. |
| `-h, --help` · `-v, --version` | — | Ayuda · versión. |

## 🔧 Cómo funciona

```
CLI
 └─ BrowserManager / RemoteBrowser      lanza Chromium o se conecta por CDP
     ├─ zenvex.dev      → genera una dirección desechable, abre su bandeja
     ├─ arena.ai        → envía la dirección, lee el enlace mágico
     ├─ bandeja         → abre el enlace, define la contraseña, confirma el login
     └─ arena.ai        → abre el chat directo, escribe, envía, lee la respuesta
```

- **`src/browser/cdp.mjs`** — un cliente del protocolo Chrome DevTools de ~180
  líneas sobre el `WebSocket` nativo de Node. Los comandos se multiplexan, las
  respuestas se correlacionan por `id` y los eventos son suscribibles.
- **`src/arena/dom.mjs`** — todos los selectores y scripts de arena.ai. Un
  cambio de UI en arena.ai normalmente se arregla en un solo archivo.
- **`src/arena/client.mjs`** — los flujos de registro, enlace mágico y chat.
- **`src/inbox/zenvex.mjs`** — generación de direcciones y lectura de la bandeja.
- **`src/core/provision.mjs`** — orquesta una cuenta de principio a fin.

Lee [docs/ARCHITECTURE.md](../ARCHITECTURE.md) para el diseño completo y
[docs/USAGE.md](../USAGE.md) para configuración y solución de problemas.

## 🪶 Cero dependencias

Node 22 incluye `fetch` y `WebSocket`, que es todo lo que necesita un cliente
CDP. Evitar Puppeteer/Playwright significa:

- de `git clone` a ejecutar en segundos — nada que instalar,
- sin árbol de dependencias transitivas que auditar,
- la conexión del navegador es explícita en vez de estar oculta tras un framework.

## 🔌 Conectarse a un navegador existente

```bash
# Chrome de escritorio iniciado con --remote-debugging-port=9222
node src/index.mjs run --cdp http://127.0.0.1:9222

# Un navegador alojado, con su URL de WebSocket
node src/index.mjs run --cdp wss://host/devtools/browser/<id>
```

Un nombre de host sin esquema se asume `https://`. Es la forma más rápida de
iterar y la más sencilla de usar un navegador con otra IP de salida.

## 📦 Salida

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

## ✅ Prueba de extremo a extremo

```bash
node src/test_e2e.mjs --cdp http://127.0.0.1:9222
```

Ejecuta cada etapa contra los servicios reales y escribe
`outputs/e2e-report-<ts>.json`. El código de salida 0 significa que todas las
etapas pasaron.

## ⚙️ Configuración

Copia `.env.example` a `.env`. Los flags tienen prioridad sobre las variables de
entorno, que tienen prioridad sobre el archivo.

| Variable | Por defecto | Descripción |
| --- | --- | --- |
| `CHROME_PATH` | auto | Ejecutable de Chrome/Chromium. |
| `HEADLESS` | `1` | Ejecutar sin ventana visible. |
| `CDP_URL` | — | Conectarse a un navegador en ejecución en vez de lanzar uno. |
| `BROWSER_PROXY` | — | Proxy solo para el navegador, p. ej. `socks5://127.0.0.1:10808`. |
| `PROFILE_DIR` | temporal | Perfil persistente; conserva los inicios de sesión. |
| `EMAIL_TIMEOUT` | `180000` | ms de espera del correo de verificación. |
| `REPLY_TIMEOUT` | `180000` | ms de espera de una respuesta del chat. |
| `ZENVEX_DOMAIN` | aleatorio | Fija el dominio receptor de zenvex. |
| `ARENA_MODEL` | `deepseek-v4.1-flash-max` | Modelo de chat por defecto. |
| `ARENA_PROMPT` | `test` | Prompt de chat por defecto. |

## 🧠 Filosofía

- **Cero dependencias.** Node 22 ya tiene todo; un framework de navegador sería
  lo más grande del repositorio.
- **Módulos pequeños y honestos.** Una responsabilidad por archivo, sin magia
  oculta.
- **Selectores en un solo lugar.** arena.ai cambia; `dom.mjs` es el radio de
  impacto.
- **Sin CI, a propósito.** El pipeline habla con sitios de terceros en vivo con
  límites de tasa y barreras anti-bot. Una marca verde en cada push sería ruido;
  ejecuta `src/test_e2e.mjs` a propósito.

## ⚠️ Aviso

Este proyecto es solo para aprendizaje e investigación técnica. Eres responsable
de cumplir con los términos de servicio de arena.ai y zenvex.dev y con la
legislación local. Nunca publiques ni subas credenciales de cuentas.

## 📄 Licencia

[MIT](../../LICENSE)
