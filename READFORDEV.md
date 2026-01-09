
# 📘 ISTOIC AI TITANIUM - ARCHITECTURE BLUEPRINT & DEVELOPER MANUAL
**Versi Sistem:** v105.0 (Aurelius Update)
**Status:** Stable / Production Ready
**Dokumen Level:** Kernel Access (Highest Clearance)

---

## 🧭 FILOSOFI ARSITEKTUR
Aplikasi ini bukan sekadar website, melainkan **Cognitive Operating System (OS)** yang berjalan di browser (Client-Side First).

### 3 Pilar Utama:
1.  **Local-First & Privacy Core**: 
    *   Semua data (Chat, Notes, Vector Embeddings) disimpan di `IndexedDB` user. Tidak ada database pusat yang menyimpan data pribadi user.
    *   Enkripsi E2EE diterapkan pada modul `IStok`.
2.  **Hybrid Intelligence (Hydra Engine)**:
    *   Aplikasi tidak bergantung pada satu AI Provider.
    *   **Client-Side**: Menangani logika ringan, UI, Audio Processing (Web Audio API).
    *   **Edge-Side (`/api`)**: Menangani routing API berat, rotasi kunci (Load Balancing), dan streaming untuk menghindari CORS & Rate Limits.
3.  **Resilient Design**:
    *   Sistem dirancang untuk "gagal dengan anggun" (Fail Gracefully). Jika Gemini mati, ia beralih ke OpenAI/Groq secara otomatis tanpa user sadari.

---

## 📂 PETA SISTEM & STRUKTUR DIREKTORI

Berikut adalah bedah anatomi folder dan file dengan penjelasan kausalitas (sebab-akibat) dan konektivitasnya.

### 1. ROOT LEVEL (`/`)
Jantung konfigurasi aplikasi.

*   **`App.tsx`** (The Orchestrator)
    *   **Fungsi**: Titik masuk logika React. Menginisialisasi `Context Providers` (Global State).
    *   **Koneksi**: Membungkus seluruh aplikasi dengan `VaultProvider`, `FeatureProvider`, dan `LiveSessionProvider`.
    *   **Dampak**: 🔴 **CRITICAL**. Salah urutan provider bisa menyebabkan *White Screen of Death* karena *Dependency Injection* gagal.
*   **`main.tsx` / `index.tsx`**:
    *   **Fungsi**: Mounting React ke DOM HTML. Mendaftarkan Service Worker (PWA).
*   **`vite.config.ts`**:
    *   **Fungsi**: Konfigurasi Build tool. Mengatur proxy server lokal dan strategi caching PWA.
*   **`tailwind.config.js`**:
    *   **Fungsi**: Desain sistem. Mengatur warna semantik (`--skin-card`, `--accent`) untuk tema dinamis.

### 2. SERVER-SIDE EDGE FUNCTIONS (`/api`)
Jembatan aman ke dunia luar. Berjalan di Vercel Edge, bukan di browser.

*   **`chat.ts`** (The Mouthpiece)
    *   **Fungsi**: Proxy tunggal untuk semua teks chat. Menerima request -> Memilih API Key -> Streaming respons.
    *   **Kenapa ada ini?**: Untuk menyembunyikan API Key dari "Inspect Element" browser dan menangani header CORS yang rewel.
*   **`routeomnirace.ts`** (The Speedster)
    *   **Fungsi**: Backend untuk fitur **Omni-Race**. Memanggil 3-4 AI sekaligus, mengambil yang tercepat, mematikan sisanya.
*   **`image.ts`**: Proxy ke HuggingFace/Pollinations untuk menghindari mixed-content error.
*   **`tts.ts`**: Proxy ke ElevenLabs untuk streaming audio.

### 3. SERVICES (`/src/services`)
Otak logika bisnis. Kode di sini tidak boleh mengandung UI (React Components).

*   **`melsaKernel.ts` & `stoicKernel.ts`** (The Brains)
    *   **Fungsi**: Mengelola alur percakapan, memori jangka pendek (History Context), dan eksekusi *Tools* (Function Calling).
    *   **Koneksi**: `useChatLogic` -> memanggil `Kernel` -> memanggil `ProviderEngine`.
*   **`hydraVault.ts`** (The Treasurer)
    *   **Fungsi**: Manajemen API Key. Mendeteksi error 429 (Rate Limit), menandai kunci sebagai "Cooldown", dan memberikan kunci cadangan.
*   **`neuralLink.ts`** (The Ears & Mouth)
    *   **Fungsi**: Mengelola WebRTC, VAD (Voice Activity Detection), dan Audio Context.
    *   **Kompleksitas**: Tinggi. Menangani *raw audio buffer* secara real-time.
*   **`vectorDb.ts`** (The Memory)
    *   **Fungsi**: Menghitung *Cosine Similarity* untuk mencari catatan yang relevan (RAG).
*   **`db.ts`**: Wrapper untuk IndexedDB. Tempat penyimpanan fisik data.
*   **`debugService.ts`**: Blackbox Recorder. Mencatat semua log error dan performa untuk ditampilkan di menu "System Health".

### 4. FEATURES (MODUL UI) (`/src/features`)

#### A. `aiChat` (Tampilan Chat Utama)
*   **`hooks/useChatLogic.ts`**:
    *   **Fungsi**: Hook raksasa yang menyatukan state chat, streaming, dan tools.
*   **`components/ChatWindow.tsx`**:
    *   **Fungsi**: Merender ribuan pesan chat secara efisien menggunakan teknik *Virtualization*.
*   **`components/AIProviderInfo.tsx`**:
    *   **Fungsi**: Chip kecil di bawah pesan yang memberi tahu user model apa yang menjawab (misal: "Gemini Flash | 400ms").

#### B. `istok` (P2P Secure Communication)
*   **`IStokView.tsx`**: Interface utama.
*   **`services/istokIdentity.ts`**: Mengatur profil samaran (Codename) user.
*   **`components/QRScanner.tsx`**: Modul kamera untuk pairing device instan.

#### C. `smartNotes` (Catatan Cerdas)
*   **`SmartNotesView.tsx`**: Tampilan grid/list catatan.
*   **`NoteAgentConsole.tsx`**: Panel "AI Agent" yang bisa diperintah untuk merapikan, merangkum, atau mengkategorikan catatan secara otomatis.

#### D. `systemHealth` (Diagnostik)
*   **`SystemHealthView.tsx`**: Dashboard teknis untuk melihat detak jantung sistem (Latency, Memory Usage, Error Log).

---

## 3. ALUR DATA (DATA FLOW MAP)

### Skenario 1: User Mengirim Chat Teks
1.  **Input**: User mengetik di `ChatInput`.
2.  **Logic**: `useChatLogic` menangkap input, menambahkan ke state sementara (Optimistic UI).
3.  **Kernel**: `melsaKernel` menyusun *Context Window* (History chat + System Prompt).
4.  **Security**: Kernel meminta kunci API aktif ke `hydraVault`.
5.  **Transport**: Request dikirim via `providerEngine` (bisa langsung ke API jika kunci lokal, atau via `/api/chat` jika pakai proxy).
6.  **Streaming**: Data diterima per-chunk (potongan kata) dan di-render real-time di `ChatWindow`.
7.  **Storage**: Setelah selesai, pesan disimpan permanen ke `IndexedDB` via `db.ts`.

### Skenario 2: User Bicara (Neural Link)
1.  **Mic**: `neuralLink.ts` menangkap audio dari mikrofon.
2.  **VAD**: Mendeteksi jika user sedang bicara atau diam (untuk menghemat bandwidth).
3.  **Transport**: Mengirim audio buffer via WebSocket ke Gemini Live API.
4.  **Response**: Menerima audio balasan -> Di-decode -> Dimainkan di speaker.
5.  **Visual**: `NeuralLinkOverlay` menganalisis frekuensi audio untuk animasi gelombang suara.

---

## 4. IMPACT ANALYSIS (BACA SEBELUM EDIT)

Panduan mitigasi risiko saat melakukan perubahan kode.

| File / Komponen | Risiko | Dampak Jika Error | Tips Maintenance |
| :--- | :--- | :--- | :--- |
| `hydraVault.ts` | **TINGGI** | Aplikasi gagal chat (Error 429/401) terus menerus. | Pastikan logika rotasi array kunci tidak *infinite loop*. |
| `App.tsx` | **KRITIS** | Aplikasi Blank/White Screen. | Hati-hati mengubah urutan *Context Provider*. |
| `db.ts` | **TINGGI** | Hilangnya data user (Catatan/Chat). | Jangan ubah nama Database/Store tanpa migrasi versi. |
| `neuralLink.ts` | **SEDANG** | Fitur suara mati/kresek-kresek. | Selalu cek *Sample Rate* (16000 vs 24000) dan *Audio Context State*. |
| `AIProviderInfo.tsx`| **RENDAH** | Kosmetik/Info salah. | Aman untuk diedit styling-nya. |

---

## 5. PANDUAN UNTUK MECHANIC AI (SELF-REPAIR)

Jika Anda adalah AI Mechanic yang membaca ini untuk memperbaiki sistem:

1.  **Diagnosa Awal**: Cek `debugService.ts`. Baca array `logs` untuk pola error yang berulang.
2.  **Integritas UI**: Cek `registry.ts`. Pastikan semua ID tombol yang dipanggil di UI *benar-benar ada* di file registry. Ketidakcocokan ID menyebabkan tombol tidak berfungsi.
3.  **Optimasi**: Jika memori bocor (Lag), periksa `useEffect` di `useChatLogic` dan `NeuralLink`. Pastikan semua *Event Listeners* dan *Intervals* dibersihkan (`clearInterval`, `removeEventListener`) pada fungsi *cleanup*.
4.  **Keamanan**: Jangan pernah men-hardcode API Key di file `ts/tsx`. Selalu panggil via `process.env` atau `hydraVault`.

---

**Dokumen ini adalah kebenaran tunggal (Single Source of Truth) untuk arsitektur IStoicAI.**
*Dibuat oleh Aurelius Architect Core untuk menjaga keberlangsungan sistem.*
