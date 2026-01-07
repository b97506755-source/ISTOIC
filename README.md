
# IStoicAI v101.0 Platinum Cognitive Terminal

Selamat datang di **IStoicAI v101.0 Platinum**. Sistem operasi kognitif pribadi yang menggabungkan filsafat Stoikisme dengan orkestrasi AI multi-engine (Hydra Omni-Race).

## 🚀 Fitur Baru di v101.0

- **Guided Interactive Tutorial**: Tur sistem interaktif yang memandu pengguna melalui setiap fitur dengan navigasi otomatis dan sorotan visual.
- **Hydra Omni-Race v101**: Optimasi engine switching untuk latensi nol.
- **IStok Secure P2P v101**: Enkripsi E2EE yang diperkuat untuk privasi total.

## 🛠 Persiapan Menjalankan

### 1. Prasyarat
- **Node.js LTS** (v20.x atau terbaru)
- **Koneksi Internet** (Untuk AI API)

### 2. Instalasi
```bash
npm install
```

### 3. Konfigurasi API (.env.local)
Buat file `.env.local` di root project:

```env
# --- AI CORE (Wajib) ---
VITE_GEMINI_API_KEY=AIzaSy...

# --- HYDRA NODES (Opsional) ---
VITE_GROQ_API_KEY=gsk_...
VITE_DEEPSEEK_API_KEY=sk-...

# --- ISTOK RELAY (Untuk Koneksi Seluler Stabil) ---
VITE_METERED_API_KEY=kunci_metered
VITE_METERED_DOMAIN=app.metered.live
```

### 4. Menjalankan
```bash
npm run dev
```
Akses di `http://localhost:3000`.

---

## 📱 Akses Mobile

Untuk akses dari HP di jaringan yang sama:
1. Pastikan PC & HP di Wi-Fi yang sama.
2. Cek IP PC (`ipconfig` / `ifconfig`).
3. Buka browser HP: `http://[IP-PC]:3000`.

---
**IStoicAI Team | Platinum Edition v101.0**
*"Efficiency is the foundation of ataraxia."*
