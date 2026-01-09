
// @ts-ignore
import { initializeApp } from "firebase/app";
// @ts-ignore
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
// @ts-ignore
import { getFirestore } from "firebase/firestore";

// Konfigurasi Firebase dari Environment Variables (Vite Native)
const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
let auth: any = null;
let db: any = null;
let googleProvider: any = null;

try {
    if (firebaseConfig.apiKey) {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        googleProvider = new GoogleAuthProvider();
    } else {
        console.warn("Firebase Config Missing. IStok Google Login will be disabled.");
    }
} catch (e) {
    console.error("Firebase Init Error:", e);
}

export { auth, db, googleProvider, signInWithPopup, signOut };
