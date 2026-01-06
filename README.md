# IStoicAI v13.5 Platinum Cognitive Terminal

Selamat datang di masa depan produktivitas kognitif. Project ini adalah terminal pribadi yang menggabungkan filsafat Stoikisme dengan kecerdasan buatan multi-engine (Gemini, Llama, DeepSeek).

## 🚀 Persiapan Menjalankan di Localhost

### 1. Prasyarat
- **Node.js LTS** (v20.x atau terbaru)
- **Koneksi Internet**

### 2. Instalasi
Ekstrak project ini, buka terminal di folder project, lalu jalankan:
```bash
npm install
```

### 3. Konfigurasi API Key (.env.local)
Aplikasi ini membutuhkan API Key untuk berfungsi. Buat file bernama `.env.local` di folder utama project.

```env
# --- WAJIB: AI CORE ---
VITE_GEMINI_API_KEY=AIzaSy...

# --- OPSIONAL: PROVIDER LAIN ---
VITE_GROQ_API_KEY=gsk_...
VITE_DEEPSEEK_API_KEY=sk-...

# --- OPSIONAL: KONEKSI ISTOK (ANTI-BLOKIR) ---
# Daftar di https://www.metered.ca/ untuk akun gratis (50GB Relay/bulan).
# Ini menjamin koneksi IStok tembus firewall ketat/provider seluler.
VITE_METERED_API_KEY=kunci_metered_anda
VITE_METERED_DOMAIN=nama_app_anda.metered.live
```

### 4. Menjalankan Aplikasi
Ketik perintah berikut di terminal:
```bash
npm run dev
```
Buka browser dan buka alamat: `http://localhost:3000`

---

## 📱 Menjalankan di Mobile (Android/iOS)

Untuk menjalankan IStoicAI di HP Anda melalui koneksi lokal:
1. Pastikan PC dan HP terhubung ke **Wi-Fi yang sama**.
2. Cari alamat IP Lokal PC Anda (Windows: ketik `ipconfig` di CMD, cari `IPv4 Address`).
3. Di HP Anda, buka browser (Chrome/Safari) dan ketik: `http://[IP-PC-ANDA]:3000`.

---

## 🛡️ IStok: Secure P2P
Fitur **IStok** menggunakan teknologi WebRTC.
- **Mode Standar**: Menggunakan server STUN publik Google (Gratis). Mungkin gagal di jaringan seluler ketat (Symmetric NAT).
- **Mode Titanium**: Jika `VITE_METERED_API_KEY` diisi, sistem akan menggunakan TURN Relay Server untuk menjamin koneksi 99.9% berhasil menembus firewall apapun.

---

## 🛠 Troubleshooting (Solusi Masalah)

### Error: "Command not recognized"
Pastikan Node.js sudah terinstal dengan benar. Coba restart terminal atau jalankan `npm install` kembali.

### Fitur Neural Link Tidak Bisa Digunakan
Fitur suara (Neural Link) memerlukan **HTTPS** atau akses **localhost**. Di browser mobile, fitur ini mungkin diblokir jika tidak menggunakan HTTPS. Namun, di localhost PC, fitur ini akan berjalan normal.

---
**IStoicAI Team | Platinum Edition v13.5**
*"Efficiency is the foundation of ataraxia."*