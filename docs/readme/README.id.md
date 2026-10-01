<div align="center">

<img src="../assets/logo.svg" width="116" alt="logo arena-auto-chat" />

# arena-auto-chat

**Pembuat akun arena.ai end-to-end dan otomatisasi chat langsung.**
Inbox sementara baru, verifikasi magic link, pembuatan password, dan chat nyata dengan model frontier — dalam satu perintah.

<br>

[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square)](#-nol-dependensi)
[![CDP](https://img.shields.io/badge/CDP-Chrome%20DevTools-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](#-cara-kerja)
[![arena.ai](https://img.shields.io/badge/target-arena.ai-7C5CFF?style=flat-square)](https://arena.ai)
[![License](https://img.shields.io/badge/License-MIT-2B8FD6?style=flat-square)](../../LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-555?style=flat-square)](#-kebutuhan)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-23D3A6?style=flat-square)](../../CONTRIBUTING.md)
[![No CI](https://img.shields.io/badge/CI-none%20(by%20design)-7C8EA0?style=flat-square)](#-filosofi)

<br>

[English](../../README.md) · [Bahasa Indonesia](README.id.md) · [Español](README.es.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

</div>

---

## ✨ Apa yang dilakukannya

`arena-auto-chat` mengendalikan klien web [arena.ai](https://arena.ai) yang asli.
Untuk satu akun, ia akan:

1. 🎲 Membuat identitas acak — local-part email, password kuat, nama lengkap.
2. 📧 Membuka inbox sementara [zenvex.dev](https://zenvex.dev) yang baru.
3. ✍️ Mengirim alamat tersebut ke modal pendaftaran arena.ai.
4. 🔗 Membaca tautan verifikasi (magic link) dari inbox lalu membukanya.
5. 🔐 Menetapkan password dan memastikan sesi sudah aktif.
6. 💬 Membuka **chat langsung** dengan model pilihan dan bertukar pesan.

Semuanya terotomatisasi dari awal sampai akhir dan siap dijalankan di VPS.

> **Hasil per akun:** email, password, dan sesi arena.ai yang berfungsi —
> ditulis ke file JSON lokal.

## 🚀 Mulai cepat

```bash
git clone https://github.com/0xgetz/arena-auto-chat.git
cd arena-auto-chat

# Buat satu akun, lalu kirim pesan uji ke sebuah model
node src/index.mjs run -m deepseek-v4.1-flash-max -p "test"
```

Tidak perlu `npm install`. Tidak ada proses build. Hanya butuh Node 22 dan
biner Chrome/Chromium.

## 🧩 Kebutuhan

- **Node.js ≥ 22** — untuk global `WebSocket` bawaan yang dipakai klien CDP.
- **Google Chrome atau Chromium** — dideteksi otomatis, atau set `CHROME_PATH`.
- Akses jaringan ke `arena.ai` dan `zenvex.dev`.

## 📖 Penggunaan

### Perintah

```bash
node src/index.mjs run      # buat akun, lalu chat        (default)
node src/index.mjs create   # hanya buat akun
node src/index.mjs chat     # chat dengan login yang sudah ada
```

### Contoh

```bash
# Buat akun dan kirim prompt
node src/index.mjs run -m deepseek-v4.1-flash-max -p "test"

# Buat tiga akun, jeda 45 detik, ke satu file
./examples/run_batch.sh 3 45

# Chat dengan login arena.ai yang sudah ada di profil browser
node src/index.mjs chat -m gpt-5 -p "tulis haiku tentang hujan"

# Kendalikan Chrome yang sudah terbuka di port 9222
node src/index.mjs run --cdp http://127.0.0.1:9222

# Lihat prosesnya
node src/index.mjs run --headful
```

### Opsi

| Flag | Default | Keterangan |
| --- | --- | --- |
| `-n, --count N` | `1` | Jumlah akun yang dibuat. |
| `-d, --domain D` | acak | Kunci domain penerima zenvex. |
| `-m, --model M` | `deepseek-v4.1-flash-max` | Slug model untuk chat langsung. |
| `-p, --prompt TEXT` | `test` | Pesan yang dikirim. |
| `-o, --out FILE` | `outputs/arena-accounts-<ts>.json` | File JSON hasil akun. |
| `--cdp URL` | — | Sambung ke browser yang berjalan (`ws://` atau `http://`). |
| `-t, --timeout MS` | `180000` | Batas waktu email verifikasi. |
| `--headful` | mati | Tampilkan jendela browser. |
| `-q, --quiet` | mati | Hanya cetak ringkasan akhir. |
| `-h, --help` · `-v, --version` | — | Bantuan · versi. |

## 🔧 Cara kerja

```
CLI
 └─ BrowserManager / RemoteBrowser      jalankan Chromium atau sambung via CDP
     ├─ zenvex.dev      → buat alamat sementara, buka inbox-nya
     ├─ arena.ai        → kirim alamat, baca magic link
     ├─ inbox           → buka tautan, set password, pastikan login
     └─ arena.ai        → buka chat langsung, ketik, kirim, baca balasan
```

- **`src/browser/cdp.mjs`** — klien Chrome DevTools Protocol ~180 baris di atas
  `WebSocket` bawaan Node. Perintah dimultipleks, respons dicocokkan lewat `id`,
  event bisa dilanggan.
- **`src/arena/dom.mjs`** — semua selektor dan skrip dalam-halaman arena.ai.
  Perubahan UI arena.ai biasanya cukup diperbaiki di satu file ini.
- **`src/arena/client.mjs`** — alur pendaftaran, magic link, dan chat.
- **`src/inbox/zenvex.mjs`** — pembuatan alamat sementara dan pembacaan inbox.
- **`src/core/provision.mjs`** — mengorkestrasi satu akun dari awal sampai akhir.

Baca [docs/ARCHITECTURE.md](../ARCHITECTURE.md) untuk desain lengkap dan
[docs/USAGE.md](../USAGE.md) untuk konfigurasi dan pemecahan masalah.

## 🪶 Nol dependensi

Node 22 sudah menyertakan `fetch` dan `WebSocket`, yang merupakan semua
kebutuhan klien CDP. Melewati Puppeteer/Playwright berarti:

- dari `git clone` ke berjalan dalam hitungan detik — tidak ada yang dipasang,
- tidak ada pohon dependensi transitif yang harus diaudit,
- koneksi browser menjadi eksplisit, bukan tersembunyi di balik framework.

## 🔌 Menyambung ke browser yang sudah ada

```bash
# Chrome desktop yang dijalankan dengan --remote-debugging-port=9222
node src/index.mjs run --cdp http://127.0.0.1:9222

# Browser hosted, dengan URL WebSocket-nya
node src/index.mjs run --cdp wss://host/devtools/browser/<id>
```

Nama host tanpa skema dianggap `https://`. Ini cara tercepat untuk iterasi dan
cara termudah untuk memakai browser dengan IP keluar yang berbeda.

## 📦 Keluaran

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

## ✅ Uji end-to-end

```bash
node src/test_e2e.mjs --cdp http://127.0.0.1:9222
```

Menjalankan setiap tahap terhadap layanan asli dan menulis
`outputs/e2e-report-<ts>.json`. Kode keluar 0 berarti semua tahap lulus.

## ⚙️ Konfigurasi

Salin `.env.example` ke `.env`. Flag mengalahkan variabel lingkungan, yang
mengalahkan file.

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `CHROME_PATH` | otomatis | Biner Chrome/Chromium. |
| `HEADLESS` | `1` | Jalankan tanpa jendela terlihat. |
| `CDP_URL` | — | Sambung ke browser yang berjalan alih-alih menjalankan baru. |
| `BROWSER_PROXY` | — | Proxy khusus browser, mis. `socks5://127.0.0.1:10808`. |
| `PROFILE_DIR` | sementara | Profil persisten; menyimpan login antar jalankan. |
| `EMAIL_TIMEOUT` | `180000` | ms menunggu email verifikasi. |
| `REPLY_TIMEOUT` | `180000` | ms menunggu balasan chat. |
| `ZENVEX_DOMAIN` | acak | Kunci domain penerima zenvex. |
| `ARENA_MODEL` | `deepseek-v4.1-flash-max` | Model chat default. |
| `ARENA_PROMPT` | `test` | Prompt chat default. |

## 🧠 Filosofi

- **Nol dependensi.** Node 22 sudah punya semuanya; framework browser akan
  menjadi hal terbesar di repo ini.
- **Modul kecil dan jujur.** Satu tanggung jawab per file, tanpa sihir
  tersembunyi.
- **Selektor di satu tempat.** arena.ai berubah; `dom.mjs` adalah radius
  dampaknya.
- **Tanpa CI, memang sengaja.** Pipeline ini berbicara ke situs pihak ketiga
  langsung dengan rate limit dan gerbang anti-bot. Centang hijau di setiap push
  hanya akan jadi kebisingan; jalankan `src/test_e2e.mjs` secara sadar.

## ⚠️ Penafian

Proyek ini hanya untuk pembelajaran dan riset teknis. Anda bertanggung jawab
mematuhi ketentuan layanan arena.ai dan zenvex.dev serta hukum setempat. Jangan
pernah meng-commit atau mempublikasikan kredensial akun.

## 📄 Lisensi

[MIT](../../LICENSE)
