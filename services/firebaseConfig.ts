// src/services/firebaseConfig.ts

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// 🔒 Init sekali saja
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Provider hanya didefinisikan, TIDAK dipakai di sini
export const googleProvider = new GoogleAuthProvider();

/**
 * ✅ Pastikan session auth "nempel" (persist) di browser / webview (Capacitor).
 * Ini mencegah user ke-logout saat reload / restart.
 *
 * NOTE:
 * - Pada environment yang tidak mendukung persistence tertentu, kita fallback tanpa melempar error.
 */
export const ensureAuthPersistence = async () => {
  try {
    // browserLocalPersistence bekerja untuk Web + Capacitor WebView
    await setPersistence(auth, browserLocalPersistence);
  } catch (e) {
    // Jangan bikin build/run gagal hanya karena persistence tidak tersedia
    console.warn("[firebase] setPersistence failed, continuing without it:", e);
  }
};

// Re-export helpers biar pemanggilan konsisten dari service layer
export const firebaseSignInWithPopup = signInWithPopup;
export const firebaseSignInWithRedirect = signInWithRedirect;
export { signOut };
