# GhostBox — Disposable Temp Mail on Cloudflare Workers

GhostBox adalah layanan **email sekali pakai (*disposable / temp-mail*) mandiri** yang berjalan sepenuhnya di atas ekosistem **Cloudflare Workers** — tanpa memerlukan VPS, tanpa daemon Postfix, dan tanpa biaya server. 

Sistem memanfaatkan Cloudflare Email Workers untuk menerima email masuk secara native, Cloudflare D1 (SQLite) untuk penyimpanan data terisolasi, Cron Triggers untuk pembersihan data otomatis berkala, dan Cloudflare Assets untuk menyajikan antarmuka web modern dari edge global.

> **Repositori Resmi**: [github.com/MHendriF/ghostbox](https://github.com/MHendriF/ghostbox)

---

## Daftar Isi
1. [Arsitektur & Cara Kerja](#arsitektur--cara-kerja)
2. [Fitur Keamanan & Hardening](#fitur-keamanan--hardening)
3. [Prasyarat Sistem](#prasyarat-sistem)
4. [Panduan Instalasi Step-by-Step](#panduan-instalasi-step-by-step)
   - [Langkah 1: Kloning Repositori & Instal Dependensi](#langkah-1-kloning-repositori--instal-dependensi)
   - [Langkah 2: Autentikasi Cloudflare CLI (Wrangler)](#langkah-2-autentikasi-cloudflare-cli-wrangler)
   - [Langkah 3: Pembuatan Database Cloudflare D1](#langkah-3-pembuatan-database-cloudflare-d1)
   - [Langkah 4: Konfigurasi wrangler.toml](#langkah-4-konfigurasi-wranglertoml)
   - [Langkah 5: Migrasi Skema Basis Data](#langkah-5-migrasi-skema-basis-data)
   - [Langkah 6: Konfigurasi Email Routing Cloudflare](#langkah-6-konfigurasi-email-routing-cloudflare)
   - [Langkah 7: Konfigurasi DNS & Proteksi Reputasi Domain](#langkah-7-konfigurasi-dns--proteksi-reputasi-domain)
   - [Langkah 8: Pengujian Lokal & Validasi](#langkah-8-pengujian-lokal--validasi)
   - [Langkah 9: Deployment ke Cloudflare](#langkah-9-deployment-ke-cloudflare)
   - [Langkah 10: Uji Coba Pengiriman Email](#langkah-10-uji-coba-pengiriman-email)
5. [Siklus Retensi & Pembersihan Otomatis (Cron)](#siklus-retensi--pembersihan-otomatis-cron)
6. [Struktur Proyek](#struktur-proyek)
7. [Daftar Perintah (Cheat Sheet)](#daftar-perintah-cheat-sheet)
8. [Troubleshooting & Solusi Masalah](#troubleshooting--solusi-masalah)
9. [Lisensi & Keamanan](#lisensi--keamanan)

---

## Arsitektur & Cara Kerja

```
[ Pengirim Email ]
        │ (SMTP)
        ▼
[ Cloudflare MX Records ]
        │
        ▼
[ Cloudflare Email Worker ] (src/email-handler.ts)
   ├── Verifikasi Whitelist Domain Penerima
   ├── Pembatasan Ukuran Raw Stream (Maks 1 MB)
   ├── Truncation Body & Subject (RFC 5322)
   ├── Deduplikasi Message-ID (INSERT OR IGNORE)
   └── Simpan ke Cloudflare D1 (SQLite)
        │
        ▼
[ Cloudflare D1 Database ] ◄── [ Cron Triggers: Purge >24 Jam ] (src/index.ts scheduled)
        │
        ▼
[ Hono REST API & Web Assets ] (src/api/routes.ts & src/web/)
   ├── Session Isolation & Anti-Hijacking (409 Conflict)
   ├── Strict Security Headers (CSP, nosniff, frame-ancestors)
   └── DOM Text-Safe Rendering + Sandboxed Iframe (Zero Stored XSS)
        │
        ▼
[ Pengguna di Browser ] (Web UI)
```

- **Serverless**: Berjalan di 300+ lokasi edge Cloudflare di seluruh dunia.
- **Biaya Nol**: Masuk ke dalam batas kuota gratis Cloudflare Workers (100.000 req/hari) dan D1 (5M baris baca, 100k baris tulis/hari).
- **Isolasi Penuh**: Tiap sesi browser anonim memiliki ID unik, mencegah pengguna lain membaca pesan Anda.

---

## Fitur Keamanan & Hardening

Proyek ini telah diperkuat (*hardened*) sesuai rekomendasi audit keamanan komprehensif:

| Vektor Keamanan | Mekanisme Proteksi GhostBox |
|---|---|
| **Stored XSS** | Seluruh data pesan dirender menggunakan DOM API aman (`textContent`). Konten email berformat HTML diisolasi di dalam `<iframe sandbox="allow-popups">` tanpa script dan tanpa akses origin ke `localStorage`. |
| **Security Headers** | Content Security Policy (CSP) ketat tanpa `unsafe-inline` untuk skrip, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, dan `X-Frame-Options: DENY`. |
| **Anti-Hijacking** | Menerapkan *Strict Creator-Ownership*. Alamat inbox yang telah dibuat oleh sesi aktif ditolak jika diklaim ulang oleh sesi lain (`409 Conflict`). |
| **Input Sanitization** | `localPart` divalidasi dengan regex ketat (`1-32` karakter alfanumerik) serta pemblokiran alamat sistem terlarang (`admin`, `abuse`, `postmaster`, dll). |
| **Rate Limiting / Quota** | Kuota pembuatan inbox dibatasi maksimal 10 inbox per sesi aktif (`429 Too Many Requests`). |
| **Ingestion Defense** | Email berukuran > 1 MB otomatis diabaikan, subject dipotong maksimal 998 byte (RFC 5322), dan body dipotong maksimal 500 KB sebelum write ke D1. |
| **Deduplikasi Pesan** | Kolom `message_id UNIQUE` mencegah duplikasi pesan akibat *at-least-once delivery* dari server pengirim. |
| **Auto-Retention** | Cron Trigger membersihkan pesan dan inbox yatim piatu lebih dari 24 jam secara otomatis setiap jam. |

---

## Prasyarat Sistem

Pastikan Anda memiliki:
1. **Akun Cloudflare**: [Daftar akun gratis](https://dash.cloudflare.com/sign-up).
2. **Domain Aktif**: Nameserver domain telah diarahkan ke Cloudflare (*Active on Cloudflare*).
3. **Node.js**: Versi `18.x` atau lebih baru (`v20+` disarankan). Cek dengan `node -v`.
4. **npm**: Versi `9.x` atau lebih baru. Cek dengan `npm -v`.

---

## Panduan Instalasi Step-by-Step

### Langkah 1: Kloning Repositori & Instal Dependensi

Buka terminal dan jalankan:

```bash
git clone https://github.com/MHendriF/ghostbox.git
cd ghostbox
npm install
```

Verifikasi bahwa instalasi dependensi dan tipe berjalan tanpa kesalahan:

```bash
npm run typecheck
npm test
```

Kedua perintah di atas harus keluar dengan status sukses (`0 errors`).

---

### Langkah 2: Autentikasi Cloudflare CLI (Wrangler)

Masuk ke akun Cloudflare Anda menggunakan Wrangler CLI:

```bash
npx wrangler login
```

Browser Anda akan terbuka secara otomatis. Klik **Allow** untuk memberikan izin otorisasi (*Workers, D1, Email Routing, Assets*).

Setelah selesai, periksa status login Anda:

```bash
npx wrangler whoami
```

Pastikan terminal menampilkan nama akun dan Account ID Cloudflare Anda.

---

### Langkah 3: Pembuatan Database Cloudflare D1

Buat basis data D1 baru di Cloudflare:

```bash
npm run db:create
```
*(Atau: `npx wrangler d1 create ghostbox-db`)*

Terminal akan menampilkan output seperti berikut:

```text
✅ Successfully created DB 'ghostbox-db'!

[[d1_databases]]
binding = "DB"
database_name = "ghostbox-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Simpan nilai `database_id` tersebut karena akan dimasukkan ke konfigurasi `wrangler.toml`.

---

### Langkah 4: Konfigurasi wrangler.toml

Buka file [`wrangler.toml`](file:///d:/Work/projects/ghostbox/wrangler.toml) di editor teks Anda. Perbarui baris berikut sesuai dengan domain dan ID database Anda:

```toml
name = "ghostbox"
main = "src/index.ts"
compatibility_date = "2025-10-01"
workers_dev = false

# ---- D1 Database ----
[[d1_databases]]
binding = "DB"
database_name = "ghostbox-db"
database_id = "GANTI_DENGAN_DATABASE_ID_DARI_LANGKAH_3"

# ---- Email Worker ----
[email]
action = "process"

# ---- Custom Domain Route ----
[[routes]]
pattern = "ghostbox.DOMAINANDA.com"
custom_domain = true

# ---- Variabel Lingkungan ----
[vars]
APP_NAME = "GhostBox"
MAIL_DOMAIN = "DOMAINANDA.com"
WEB_HOST = "ghostbox.DOMAINANDA.com"
RETENTION_HOURS = "24"
MAX_INBOXES_PER_SESSION = "10"
MAX_EMAIL_SIZE_BYTES = "1048576"
MAX_BODY_SIZE_BYTES = "524288"
AUTO_REFRESH_INTERVAL_MS = "15000"
DEFAULT_MESSAGES_LIMIT = "50"
MAX_MESSAGES_LIMIT = "100"

# ---- Static Assets & Cron ----
[assets]
directory = "./src/web"

[triggers]
crons = ["0 * * * *"]

[observability]
enabled = true
```

#### Tabel Variabel Lingkungan yang Dapat Dikonfigurasi:

| Variabel | Tipe | Default | Deskripsi |
|---|---|---|---|
| `APP_NAME` | string | `"GhostBox"` | Nama aplikasi pada judul web dan UI |
| `MAIL_DOMAIN` | string | - | Domain penerima email (pisahkan koma jika multi-domain) |
| `WEB_HOST` | string | - | Hostname antarmuka web |
| `RETENTION_HOURS` | string/number | `"24"` | Durasi retensi pesan sebelum dihapus otomatis (dalam jam) |
| `MAX_INBOXES_PER_SESSION` | string/number | `"10"` | Batas kuota jumlah inbox aktif per sesi browser |
| `MAX_EMAIL_SIZE_BYTES` | string/number | `"1048576"` | Batas maksimal raw payload email (1 MB = 1048576) |
| `MAX_BODY_SIZE_BYTES` | string/number | `"524288"` | Batas panjang body email sebelum disimpan ke D1 (500 KB) |
| `AUTO_REFRESH_INTERVAL_MS` | string/number | `"15000"` | Interval auto-refresh polling pada web UI (dalam ms) |
| `DEFAULT_MESSAGES_LIMIT` | string/number | `"50"` | Limit default pesan yang dikembalikan API |
| `MAX_MESSAGES_LIMIT` | string/number | `"100"` | Batas tertinggi parameter query `?limit=` |

> **Tips Multi-Domain**: Jika Anda ingin menerima email dari beberapa domain sekaligus, pisahkan dengan koma pada `MAIL_DOMAIN`, misalnya:
> `MAIL_DOMAIN = "domainutama.com, domainkedua.my.id"`

---

### Langkah 5: Migrasi Skema Basis Data

Jalankan perintah berikut untuk mengeksekusi skema tabel ke database Cloudflare D1 remote Anda:

```bash
npm run db:migrate
```

Perintah ini akan membuat dan memverifikasi tabel:
- `inboxes` (menyimpan alamat email dan `owner_session_id`)
- `messages` (menyimpan pesan masuk dengan `message_id UNIQUE` dan timestamp ISO)
- `sessions` (token sesi anonim pengguna)
- `session_inboxes` (relasi kepemilikan inbox ke sesi)

Untuk memverifikasi tabel yang sudah terbuat di remote D1:

```bash
npx wrangler d1 execute ghostbox-db --remote --command="PRAGMA table_list;"
```

---

### Langkah 6: Konfigurasi Email Routing Cloudflare

1. Masuk ke **[Cloudflare Dashboard](https://dash.cloudflare.com/)**.
2. Pilih domain Anda.
3. Di bilah menu kiri, klik **Email Routing**.
4. Jika belum aktif, klik **Get Started** atau **Enable Email Routing**. Cloudflare akan secara otomatis menambahkan MX records ke tabel DNS Anda.
5. Masuk ke tab **Routing Rules**:
   - Cari bagian **Catch-all rule**.
   - Klik **Edit**.
   - Atur **Action**: Pilih `Send to a Worker`.
   - Pilih Worker: `ghostbox`.
   - Pastikan status toggle menjadi **Active / Enabled**.
   - Klik **Save**.

Atau periksa via CLI:

```bash
npx wrangler email routing rules list DOMAINANDA.com
```

Output yang diharapkan:
```text
Catch-all rule: enabled, action: worker:ghostbox
```

---

### Langkah 7: Konfigurasi DNS & Proteksi Reputasi Domain

Masuk ke **Cloudflare Dashboard → Domain Anda → DNS → Records**. Pastikan record berikut terpasang:

#### 7a. Record Web UI
Cloudflare akan membuat record custom domain secara otomatis saat Worker di-deploy. Jika belum ada, tambahkan:
- **Type**: `CNAME`
- **Name**: `ghostbox`
- **Target**: `ghostbox.workers.dev` (atau domain fallback Worker Anda)
- **Proxy Status**: Proxied (Orange cloud)

#### 7b. MX Records (Inbound Mail)
Cloudflare Email Routing biasanya membuat 3 record ini secara otomatis:
- `MX @ route1.mx.cloudflare.net (Priority: 81)`
- `MX @ route2.mx.cloudflare.net (Priority: 5)`
- `MX @ route3.mx.cloudflare.net (Priority: 25)`

#### 7c. SPF Record (Mencegah Spam Flagging)
Tambahkan record TXT pada root domain:

| Type | Name | Content | TTL |
|---|---|---|---|
| `TXT` | `@` | `v=spf1 include:_spf.mx.cloudflare.net ~all` | Auto |

#### 7d. DMARC & Proteksi Reputasi (Krusial)
Domain *disposable mail* sangat rentan menjadi sasaran spoofing. Pasang DMARC untuk melindungi reputasi domain Anda:

| Type | Name | Content | TTL |
|---|---|---|---|
| `TXT` | `_dmarc` | `v=DMARC1; p=quarantine; sp=quarantine; rua=mailto:abuse@DOMAINANDA.com` | Auto |

> **Catatan**: Buat routing alias untuk `abuse@DOMAINANDA.com` di menu Email Routing yang meneruskan email ke kotak masuk pribadi Anda agar keluhan pihak ketiga dapat segera terbaca.

---

### Langkah 8: Pengujian Lokal & Validasi

Sebelum mempublikasikan ke production, lakukan uji validasi otomatis:

```bash
# 1. Jalankan pengujian keamanan & unit tests
npm test

# 2. Jalankan validasi tipe TypeScript dan Frontend JS
npm run typecheck

# 3. Validasi konfigurasi deployment wrangler tanpa publish
npx wrangler deploy --dry-run
```

Jika ingin menjalankan server dev lokal:

```bash
# Siapkan database lokal
npm run db:local

# Jalankan dev server
npm run dev
```

Buka `http://localhost:8787` di peramban Anda.

---

### Langkah 9: Deployment ke Cloudflare

Deploy Worker dan seluruh aset web frontend ke edge Cloudflare menggunakan perintah:

```bash
# Perintah deployment utama:
npx wrangler deploy

# Atau menggunakan shortcut npm:
npm run deploy
```

> **Penting**: Pastikan Anda telah menjalankan `npx wrangler deploy` minimal satu kali sebelum mengonfigurasi **Email Routing** di Dashboard Cloudflare. Dashboard Cloudflare hanya dapat menampilkan Worker pada menu *"Send to a Worker"* jika Worker tersebut sudah pernah di-deploy ke edge network Cloudflare.

Wrangler akan mengunggah:
1. Logika Worker API & Ingestion Email.
2. Aset antarmuka web ke Cloudflare Assets CDN.
3. Cron Triggers retention.
4. Binding database D1 dan konfigurasi rute kustom.

Setelah selesai, terminal akan mengonfirmasi URL aktif:
```text
Deployed ghostbox triggers:
  ghostbox.DOMAINANDA.com (custom domain)
```

---

### Langkah 10: Uji Coba Pengiriman Email

1. Buka peramban dan akses alamat `https://ghostbox.DOMAINANDA.com`.
2. Klik tombol **🎲 Random** untuk membuat alamat acak (misal: `kopihujan42@DOMAINANDA.com`), atau klik **✦ Create** untuk membuat username kustom.
3. Buka akun email pribadi Anda (Gmail, Yahoo, Outlook, dsb).
4. Kirimkan email uji coba ke alamat GhostBox yang baru dibuat.
5. Tunggu 3–5 detik. Antarmuka GhostBox akan melakukan auto-refresh berkala (setiap 15 detik), atau Anda dapat menekan tombol **🔄 Refresh**.
6. Pesan akan muncul lengkap dengan pengirim, subjek, waktu penerimaan lokal, dan isi pesan yang terisolasi aman.

---

## Siklus Retensi & Pembersihan Otomatis (Cron)

GhostBox dilengkapi dengan cron job otomatis untuk menghemat ruang D1:
- **Jadwal**: Dijalankan setiap jam (`0 * * * *`).
- **Masa Retensi Pesan**: Pesan yang diterima lebih dari 24 jam yang lalu akan dihapus secara permanen.
- **Pembersihan Inbox Yatim Piatu**: Alamat inbox yang tidak lagi terhubung ke sesi mana pun dan tidak memiliki pesan akan dibersihkan.
- **Penghapusan Manual**: Pengguna dapat menghapus pesan satu per satu melalui ikon tempat sampah (`🗑`) di antarmuka web, atau menghapus seluruh inbox via tombol **Delete**.

---

## Struktur Proyek

```
ghostbox/
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI (Typecheck & Security Tests)
├── src/
│   ├── index.ts               # Entry point Workers: fetch(), email(), scheduled()
│   ├── email-handler.ts       # Parser email masuk (PostalMime) + limits + D1 insert
│   ├── api/
│   │   └── routes.ts          # Hono Router: /config, /session, /inboxes, /messages
│   ├── db/
│   │   ├── schema.sql         # Skema D1 SQLite + indeks unik & timestamps
│   │   └── queries.ts         # Query database D1 terisolasi
│   ├── utils/
│   │   └── random-address.ts  # Generator nama inbox acak gaya Indonesia
│   └── web/                   # Antarmuka web frontend (Vanilla JS + CSS)
│       ├── index.html         # Struktur HTML utama
│       ├── app.js             # Logika aplikasi client-side (safe DOM + iframe sandbox)
│       └── styles.css         # Styling modern dark-mode
├── test/
│   └── security.test.js       # Test suite validasi regex, domain, dan parsing
├── API.md                     # Dokumentasi spesifikasi REST API
├── SECURITY.md                # Kebijakan pelaporan kerentanan keamanan
├── code-review.md             # Hasil audit kode awal
├── plan.md                    # Dokumentasi rencana hardening
├── tsconfig.json              # Konfigurasi TypeScript backend worker
├── tsconfig.web.json          # Konfigurasi TypeScript frontend client
├── package.json               # Dependensi proyek & scripts
└── wrangler.toml              # Konfigurasi Cloudflare Workers & D1
```

---

## Daftar Perintah (Cheat Sheet)

| Perintah | Deskripsi |
|---|---|
| `npx wrangler deploy` | Mempublikasikan Worker, aset web statis, dan cron triggers ke Cloudflare edge |
| `npm run deploy` | Shortcut untuk `wrangler deploy` |
| `npm run dev` | Menjalankan Worker dan antarmuka web secara lokal |
| `npm test` | Menjalankan automated test suite verifikasi keamanan |
| `npm run typecheck` | Memvalidasi tipe TypeScript backend dan frontend sekaligus |
| `npm run db:migrate` | Menerapkan skema SQL ke database D1 remote di Cloudflare |
| `npm run db:local` | Menerapkan skema SQL ke database D1 lokal untuk pengujian |
| `npx wrangler tail` | Menampilkan live streaming log Worker secara real-time |
| `npx wrangler d1 execute ghostbox-db --remote --command="SELECT COUNT(*) FROM messages;"` | Menghitung total pesan di database remote |

---

## Troubleshooting & Solusi Masalah

### 1. `DNS_PROBE_FINISHED_NXDOMAIN` saat membuka URL Web
- **Penyebab**: Propagasi DNS domain belum selesai atau nameserver domain belum diarahkan ke Cloudflare.
- **Solusi**: Periksa dengan `dig +short DOMAINANDA.com NS`. Pastikan nameserver yang muncul berakhiran `.ns.cloudflare.com`.

### 2. Email tidak masuk ke antarmuka web
- **Penyebab A**: Catch-all rule pada Email Routing belum diarahkan ke Worker `ghostbox`.
  - **Cek**: Masuk ke Cloudflare Dashboard → Email Routing → Routing Rules → Pastikan Catch-all Rule aktif dan diarahkan ke Worker `ghostbox`.
- **Penyebab B**: Email berukuran lebih dari 1 MB (otomatis di-drop untuk proteksi memori D1).
- **Penyebab C**: Pantau log saat email dikirim:
  ```bash
  npx wrangler tail --format pretty
  ```

### 3. Error `Address already registered by another session` (HTTP 409)
- **Penyebab**: Fitur *Anti-Hijacking* aktif. Alamat username kustom yang Anda minta sudah pernah dibuat oleh browser/sesi lain.
- **Solusi**: Gunakan nama username kustom lain atau buat alamat acak baru.

### 4. Error `Session inbox limit reached` (HTTP 429)
- **Penyebab**: Batas kuota proteksi 10 inbox per sesi tercapai.
- **Solusi**: Hapus salah satu inbox lama yang tidak terpakai menggunakan tombol **🗑 Delete** pada antarmuka web.

---

## Lisensi & Keamanan

- **Lisensi**: [MIT License](LICENSE)
- **Kebijakan Keamanan**: Lihat [SECURITY.md](SECURITY.md) untuk pedoman pelaporan kerentanan.

Dikembangkan oleh [MHendriF](https://github.com/MHendriF).
