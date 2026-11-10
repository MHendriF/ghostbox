# GhostBox — UI/UX Audit & Redesign Blueprint (`design-taste-frontend`)

**Classification (`design-taste-frontend`):**
- **Page Type / Kind:** `software` (`developer-tool` / `utility web app`)
- **Subject:** Disposable Email & Real-Time Inbound SMTP Inspector
- **Primary Action:** Copy Active Address / Inspect Incoming OTP & Verification Payload
- **Design Bar:** Linear, Raycast, Fastmail, Plain.com, x.ai — utilitarian precision, high-contrast typography, zero generic AI-template tropes.

---

## 1. Executive UI/UX Audit (Current State Assessment)

Berdasarkan evaluasi menyeluruh terhadap kode sumber (`src/frontend/App.svelte`, `src/frontend/styles.css`, dan seluruh komponen di `src/frontend/components/`) menggunakan standar **`design-taste-frontend`**:

### A. Visual & Aesthetic Slop Signals (Critical)
1. **Palet Indigo/Violet/Lavender Generik (`#6366f1` / `#818cf8`)**:
   - `styles.css` menggunakan kombinasi `#09090b` dengan aksen ungu/indigo (`--accent: #6366f1`, `--accent-soft: #818cf8`) dan radial glow ungu di background.
   - Dalam aturan `design-taste-frontend` (*Section 6: Never*), **violet/lavender dilarang keras** karena merupakan penanda visual paling khas dari template UI buatan AI generik.
2. **Gradient Text pada H1 & Kartu Ber-Glow**:
   - Heading utama `GhostBox` menggunakan `-webkit-background-clip: text` dengan gradasi putih ke lavender (`#c7d2fe` -> `#818cf8`), ditambah ikon kartun hantu dengan efek neon cyan-purple shadow.
   - `.hero-card::before` memakai garis gradasi dekoratif di bagian atas kartu yang menambah kebisingan visual tanpa fungsi informasi.
3. **Duplikasi CSS Masif (~1.100 Baris Redundan)**:
   - Aturan CSS ditulis ganda: sekali secara global di `src/frontend/styles.css` (1.103 baris) dan ditulis ulang di dalam blok `<style>` masing-masing komponen Svelte (`HeroCard.svelte` memiliki >700 baris style sendiri).
   - Beberapa selector sudah tidak sinkron (misal `.filter-tab` di `styles.css` vs `.filter-tab-btn` di `MessagesPanel.svelte`).

### B. Information Architecture & Layout Ergonomics
1. **Navigasi Multi-Inbox Tersembunyi di Dalam Dropdown Sempit**:
   - Pengguna dapat memiliki hingga 15+ inbox, tetapi untuk berpindah inbox mereka harus mengklik tombol dropdown `Switch:` di pojok kanan `.hero-card`.
   - Area layar desktop di luar lebar `1024px` terbuang kosong, sementara daftar inbox justru dijejalkan ke dalam popover `320px`.
2. **Accordion Email Inline Menyempitkan Area Baca**:
   - Membuka email di `MessageCard.svelte` merender isi email di dalam accordion dengan indentasi kiri `70px` (`padding: 0 20px 20px 70px`).
   - Saat pengguna membuka beberapa email HTML panjang (newsletter/notifikasi transaksi), halaman memanjang drastis ke bawah dan menggeser posisi daftar pesan lainnya (*scroll jumping*).
3. **Header Bergaya Landing Page, Bukan Aplikasi Kerja**:
   - Header di tengah (`text-align: center; margin-bottom: 32px`) memakan ruang vertikal ~110px di layar pertama hanya untuk menampilkan logo dan subjudul statis, mendorong daftar pesan penting ke bawah lipatan layar (*below the fold*).

### C. Interaction, Accessibility & Micro-UX Flaws
1. **Pelanggaran Aksesibilitas Keyboard (`a11y`)**:
   - Di `MessageCard.svelte` baris 109–111, header kartu pesan menggunakan `<div class="message-card-header" onclick={onToggle}>` dengan komentar `<!-- svelte-ignore a11y_click_events_have_key_events -->`. Pengguna keyboard tidak bisa melakukan `Tab` dan `Enter`/`Space` untuk membuka email.
2. **Ukuran Tap Target di Bawah Standar (`< 44px`)**:
   - Tombol aksi pesan (`.icon-btn` untuk download `.eml` dan delete) berukuran `28px × 28px`, serta tombol chip filter berukuran tinggi `~26px`. Pada layar sentuh (390px), ini melanggar aturan minimum tap target (`44px`) dan rawan salah tekan (*mis-tap*).
3. **Ketidakkonsistenan Konfirmasi Aksi Destruktif**:
   - Tombol **Clean Empty Inboxes** sudah menggunakan pola *inline two-step confirmation* (`Confirm (N)` dengan tombol batal `✕`), tetapi tombol **Delete Inbox** (`App.svelte` baris 151) masih memanggil dialog `window.confirm()` bawaan browser yang memblokir thread UI.
4. **Bahasa Antarmuka Tidak Konsisten (Mixed Locale)**:
   - Seluruh label UI berbahasa Inggris (`Incoming Messages`, `Active Disposable Address`, `Quick Random`), namun pesan toast pada `handleCleanEmptyInboxes()` di `App.svelte` menggunakan bahasa Indonesia (`Tidak ada inbox kosong yang perlu dibersihkan`).

---

## 2. Redesign Philosophy & Visual Direction

### A. Design Archetype: *"Tactical Dark Utility"* (Linear / Raycast / x.ai Bar)
Mengubah GhostBox dari tampilan "kartu SaaS ungu" menjadi **Terminal Inspeksi Email Berpresisi Tinggi**:
- **Satu Sistem Permukaan (Carbon & Zinc Monolith)**:
  Menggunakan permukaan karbon murni tanpa campuran warna biru/ungu, dipadukan dengan batas 1px tajam (`hairline borders`) dan kontras tipografi yang tegas.
- **Aksen Fungsional (Signal Emerald / Amber / Crisp White)**:
  Mengganti aksen indigo/violet dengan **Crisp Phosphor Emerald (`#10b981`)** untuk status aktif/OTP dan **High-Contrast Off-White (`#f4f4f5`)** untuk aksi primer.

### B. Color Token System (Anti-Violet Palette)

| Token | Nilai Lama (Indigo Slop) | Nilai Baru (Carbon & Signal) | Peran |
|---|---|---|---|
| `--bg-root` | `#09090b` + radial violet | `#0a0a0b` (Flat Carbon) | Latar belakang utama tanpa kabut ungu |
| `--bg-surface` | `#121216` | `#111113` | Panel utama & sidebar |
| `--bg-elevated` | `#18181f` | `#18181b` | Elemen interaktif, input, kartu aktif |
| `--bg-hover` | `#22222d` | `#222226` | State hover baris & tombol |
| `--border` | `rgba(255,255,255,0.08)` | `#27272a` (Solid Zinc-800) | Garis batas struktural yang tegas |
| `--border-subtle` | — | `#1f1f22` | Pemisah antar baris pesan |
| `--text-primary` | `#f8fafc` | `#f4f4f5` (Zinc-100) | Teks utama & subjek email |
| `--text-secondary` | `#94a3b8` | `#a1a1aa` (Zinc-400) | Pengirim, pratinjau, metadata |
| `--text-muted` | `#64748b` | `#71717a` (Zinc-500) | Timestamp, shortcut hint |
| `--accent` | `#6366f1` (Violet/Indigo) | `#10b981` (Signal Emerald) | OTP badge, indikator live, fokus |
| `--action-primary-bg` | `#6366f1` | `#f4f4f5` (Teks `#09090b`) | Tombol utama (`Copy Address`, `Create`) |
| `--danger` | `#f43f5e` | `#ef4444` | Aksi hapus & peringatan |
| `--radius-sm` | `8px` | `6px` | Tombol, badge, input (`sharp/soft` tech) |
| `--radius` | `12px` | `8px` | Kartu & modal |
| `--radius-lg` | `16px–20px` | `10px` | Panel workspace utama |

### C. Typography Scale
- **UI Sans**: `'Inter'` atau `'Plus Jakarta Sans'` — ukuran dasar `13.5px`, `font-feature-settings: "cv02", "cv03", "cv04", "cv11"`.
- **Technical Mono**: `'JetBrains Mono'` — digunakan secara eksklusif untuk:
  - Alamat email (`activeAddress`)
  - Kode OTP / verifikasi (`otp-pill`)
  - Countdown timer & timestamp (`tabular-nums`)
  - Keyboard shortcuts (`<kbd>`)

---

## 3. Structural Layout Redesign (Workspace Architecture)

Menggantikan tata letak satu kolom vertikal yang membuang ruang menjadi **2-Pane / 3-Pane Adaptive Workspace** yang muat dalam 1 layar penuh di desktop (`1440×900`):

```
+-----------------------------------------------------------------------------------+
| [GhostBox Icon] GhostBox    [Live • 14s]              [/ Search] [N New] [Lock]   | <- Compact Top Bar (52px)
+---------------------------+-------------------------------------------------------+
| INBOXES (12)   [Clean 4]  | ACTIVE INBOX COMMAND BAR                              |
| [+ New Custom] [🎲 Rand]  | [ user98@rinjaniglobal.com ] [Copy (C)] [Refresh] [🗑] |
| ------------------------- | ----------------------------------------------------- |
| [Search inboxes...      ] | MESSAGES (3)       [All] [Today] [OTP 1] [Actions]    |
| [All] [Active 8] [Empty 4]| ----------------------------------------------------- |
|                           | ● GitHub <noreply@github.com>      [OTP: 849201]  2m  |
| > user98@rinjani..  [3]   |   [GitHub] Your verification code                 [v] |
|    paypal@rinjani..  [1]   | ----------------------------------------------------- |
|    steam@rinjani...  [5]   |   +-----------------------------------------------+   |
|    temp01@rinjani..  [0]   |   | [Action Detected: Verify Email ->]            |   |
|    temp02@rinjani..  [0]   |   | [HTML Email] [Raw] [Light/Dark]   [Copy Body] |   |
|                           |   |                                               |   |
|                           |   |  (Full-Width Sandboxed Email Reader Canvas)   |   |
|                           |   +-----------------------------------------------+   |
+---------------------------+-------------------------------------------------------+
```

### Keunggulan Tata Letak Baru:
1. **Compact Header Bar (Tinggi 52px, Bukan 110px)**:
   - Brand di kiri, indikator status live polling + countdown di tengah/kanan, tombol shortcut & `Lock` di kanan.
   - Menghemat ~60px ruang vertikal sehingga email langsung terlihat tanpa perlu scroll.
2. **Dedicated Inbox Sidebar (Desktop `>= 900px`) / Bottom Sheet (Mobile `< 900px`)**:
   - Daftar seluruh inbox terlihat langsung di panel kiri (`280px`).
   - Berpindah antar inbox cukup **1 klik** (tidak perlu membuka dropdown -> klik item).
   - Pencarian inbox, filter `All / Active / Empty`, dan tombol `Clean Empty` berada langsung di header sidebar.
   - Pembuatan *Custom Inbox* terintegrasi rapi di bagian atas area kerja tanpa mendorong seluruh halaman secara mengejutkan.
3. **Full-Width Message Reader**:
   - Menghilangkan indentasi kosong `70px` di sebelah kiri body email (`padding: 0 20px 20px 70px` -> `padding: 16px 20px`). Area baca email menjadi 100% lebar panel pesan.
4. **One-Click OTP & Action First**:
   - Jika email memiliki kode OTP atau tautan verifikasi (*Action Link*), keduanya ditampilkan sebagai elemen prioritas di baris header kartu pesan sehingga pengguna bahkan **tidak perlu membuka isi email** untuk menyalin OTP atau mengklik link verifikasi.

---

## 4. Component-by-Component Improvements

### 1. `Header.svelte` -> Compact App Topbar
- Hapus teks gradasi ungu dan kurangi margin berlebih.
- Tambahkan indikator koneksi `Live • {countdown}s` dan badge jumlah inbox langsung di bar atas.
- Pindahkan tombol `Lock` dan petunjuk tombol pintas (`Keyboard Shortcuts`) ke dalam topbar agar rapi.

### 2. `HeroCard.svelte` -> Active Inbox Command Bar + Sidebar List
- **Active Address Bar**: Tampilkan alamat email aktif dengan ukuran `JetBrains Mono` yang jelas, klik langsung pada alamat atau tombol `Copy Address` (dengan kontras tinggi putih di atas hitam) untuk menyalin.
- **Inline Delete Confirmation**: Ganti `window.confirm()` saat menghapus inbox dengan konfirmasi inline 2-langkah (`Delete` -> `Confirm Delete? [Yes] [No]`) yang konsisten dengan tombol `Clean Empty`.
- **Unifikasi Bahasa**: Selaraskan semua teks toast dan tombol ke Bahasa Inggris yang lugas dan konsisten.

### 3. `MessagesPanel.svelte` & `MessageCard.svelte`
- **Keyboard Accessibility**: Ubah `.message-card-header` agar memiliki `role="button"`, `tabindex="0"`, dan handler `onkeydown` untuk tombol `Enter` / `Space`.
- **Quick Action Link di Header Baris**: Selain pill `OTP: 123456`, tampilkan juga tombol pintas `Open Link ↗` langsung di baris pesan jika `extractActionLink` mendeteksi tautan aktivasi/login.
- **Tap Targets 44px pada Mobile**: Pastikan tombol aksi pada layar `< 640px` memiliki area sentuh minimal `36px–44px` dengan jarak aman minimal `8px`.
- **Pembersihan CSS**: Hapus duplikasi aturan di `styles.css` sehingga token desain terpusat di `:root` (`styles.css`) dan gaya spesifik komponen berada di masing-masing file `.svelte`.

### 4. `AuthModal.svelte`
- Ganti ikon gembok ungu berlapis glow dengan tampilan dialog otentikasi bergaya *minimal security gate* (flat carbon surface, border tegas `#27272a`, tombol submit kontras tinggi).
- Hilangkan `letter-spacing: 2px` dan `text-align: center` pada input username agar mudah dibaca saat mengetik.

---

## 5. Implementation Roadmap (Step-by-Step)

1. **Tahap 1 — Design Tokens & CSS Consolidation (`src/frontend/styles.css`)**:
   - Ganti variabel warna `:root` dari palet Indigo/Violet ke palet Carbon/Zinc + Signal Emerald.
   - Hapus aturan komponen yang terduplikasi di `styles.css`, sisakan reset, variabel global, tipografi, dan utilitas umum.
2. **Tahap 2 — Workspace Shell & Header (`src/frontend/App.svelte`, `Header.svelte`)**:
   - Terapkan layout grid 2 kolom responsif (`280px 1fr` pada desktop, 1 kolom pada tablet/mobile).
   - Ubah `Header.svelte` menjadi topbar aplikasi yang ringkas.
   - Samakan seluruh teks toast ke Bahasa Inggris yang konsisten dan ganti `window.confirm()` dengan state konfirmasi UI.
3. **Tahap 3 — Inbox Sidebar & Command Bar (`HeroCard.svelte`, `NewInboxDrawer.svelte`)**:
   - Pisahkan kontrol navigasi daftar inbox ke panel kiri (dengan mode drawer/dropdown otomatis di layar mobile) dan bar alamat aktif di bagian atas panel kanan.
4. **Tahap 4 — Accessible Message List & Full-Width Reader (`MessagesPanel.svelte`, `MessageCard.svelte`, `AuthModal.svelte`)**:
   - Perbaiki aksesibilitas keyboard (`tabindex="0"`, `Enter`/`Space`) pada `MessageCard.svelte`.
   - Tambahkan *Quick Action Link* di baris header pesan.
   - Perlebar area baca email (hapus indentasi kiri 70px).
   - Perbarui `AuthModal.svelte` dengan gaya visual baru.
5. **Tahap 5 — Verification & Build**:
   - Jalankan `npm test`, `npm run typecheck`, dan `npm run build` untuk memastikan 0 error dan bundle tetap ringan.

