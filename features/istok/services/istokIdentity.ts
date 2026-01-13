// src/features/istok/services/istokIdentity.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { auth, db, googleProvider, firebaseConfigError } from "../../../services/firebaseConfig";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

import {
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { debugService } from "../../../services/debugService";

export interface IStokUserIdentity {
  uid: string;
  istokId: string;
  codename: string;
  email: string;
  displayName: string;
  photoURL: string;
  lastIdChange?: any;
  idChangeCount?: number;
}

export type GoogleLoginResult =
  | { status: "REDIRECT_STARTED" }
  | { status: "SIGNED_IN"; identity: IStokUserIdentity }
  | { status: "CANCELLED"; message: string }
  | { status: "ERROR"; message: string };

const AUTH_TIMEOUT_MS = 15000;

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function isIosPwa(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  return isIos && isStandalone;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = AUTH_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timeout. Please try again.")), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function ensureAuthPersistence(mode: "local" | "session" = "local") {
  if (!auth) return;
  const persistence = mode === "session" ? browserSessionPersistence : browserLocalPersistence;
  try {
    await setPersistence(auth, persistence);
  } catch (error) {
    console.warn("[ISTOK_AUTH] Failed to set auth persistence.", error);
  }
}

function friendlyAuthError(error: any): string {
  const errCode = error?.code || "";
  const errMsg = error?.message || String(error || "");

  if (errCode === "auth/popup-closed-by-user" || errMsg.includes("closed-by-user")) {
    return "Login cancelled by user.";
  }

  if (
    errCode === "auth/popup-blocked" ||
    errMsg.includes("Cross-Origin-Opener-Policy") ||
    errMsg.includes("window.closed")
  ) {
    return "Popup blocked by browser policy. Please allow popups or try another browser.";
  }

  if (errCode === "auth/unauthorized-domain" || errMsg.includes("unauthorized-domain")) {
    const currentDomain = window.location.hostname;
    return `Domain "${currentDomain}" unauthorized. Add it in Firebase Console → Auth → Settings → Authorized domains.`;
  }

  if (errCode === "auth/network-request-failed") {
    return "Network connection failed. Please check your internet.";
  }

  return errMsg || "Login failed.";
}

async function fetchProfile(uid: string): Promise<IStokUserIdentity | null> {
  if (!db) return null;
  const userRef = doc(db, "users", uid);
  const snap = await withTimeout(getDoc(userRef));
  if (!snap.exists()) return null;
  return snap.data() as IStokUserIdentity;
}

function normalizeUser(user: User): Pick<IStokUserIdentity, "uid" | "email" | "displayName" | "photoURL"> {
  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || (user.email ? user.email.split("@")[0] : "User"),
    photoURL: user.photoURL || "",
  };
}

async function persistIdentity(identity: IStokUserIdentity | null) {
  if (typeof window !== "undefined") {
    if (identity) {
      window.localStorage.setItem("istok_user_identity", JSON.stringify(identity));
    } else {
      window.localStorage.removeItem("istok_user_identity");
    }
  }

  if (isNative()) {
    if (identity) {
      await Preferences.set({ key: "istok_user_identity", value: JSON.stringify(identity) });
    } else {
      await Preferences.remove({ key: "istok_user_identity" });
    }
  }
}

export const IstokIdentityService = {
  loginWithGoogle: async (): Promise<GoogleLoginResult> => {
    if (firebaseConfigError) {
      return { status: "ERROR", message: firebaseConfigError };
    }
    if (!auth || !db) {
      return { status: "ERROR", message: "Firebase belum dikonfigurasi. Hubungi administrator." };
    }

    await ensureAuthPersistence();

    try {
      if (isNative() || isIosPwa()) {
        await signInWithRedirect(auth, googleProvider);
        return { status: "REDIRECT_STARTED" };
      }

      const result = await withTimeout(signInWithPopup(auth, googleProvider));
      const user = result.user;

      const existing = await fetchProfile(user.uid);
      if (existing) return { status: "SIGNED_IN", identity: existing };

      const base = normalizeUser(user);
      return {
        status: "SIGNED_IN",
        identity: {
          ...base,
          istokId: "",
          codename: "",
        },
      };
    } catch (err: any) {
      const msg = friendlyAuthError(err);
      if (msg.includes("cancelled")) {
        return { status: "CANCELLED", message: msg };
      }
      debugService.log("ERROR", "ISTOK_AUTH", "LOGIN_FAIL", msg);
      return { status: "ERROR", message: msg };
    }
  },

  finalizeRedirectIfAny: async (): Promise<IStokUserIdentity | null> => {
    if (!auth || !db) return null;

    await ensureAuthPersistence();

    try {
      const result = await withTimeout(getRedirectResult(auth));
      if (!result?.user) return null;

      const user = result.user;
      const existing = await fetchProfile(user.uid);
      if (existing) return existing;

      const base = normalizeUser(user);
      return {
        ...base,
        istokId: "",
        codename: "",
      };
    } catch (err: any) {
      const msg = friendlyAuthError(err);
      debugService.log("WARN", "ISTOK_AUTH", "REDIRECT_FINALIZE_FAIL", msg);
      return null;
    }
  },

  watchAuthState: (cb: (user: User | null) => void) => {
    if (!auth) return () => {};
    return onAuthStateChanged(auth, cb);
  },

  createProfile: async (identity: IStokUserIdentity) => {
    if (!db || !identity?.uid) return;

    await withTimeout(
      setDoc(doc(db, "users", identity.uid), {
        ...identity,
        createdAt: serverTimestamp(),
        lastIdChange: serverTimestamp(),
        idChangeCount: 0,
      })
    );

    await persistIdentity(identity);
  },

  updateCodename: async (uid: string, newCodename: string): Promise<{ success: boolean; msg: string }> => {
    if (!db) return { success: false, msg: "Database offline" };

    const userRef = doc(db, "users", uid);
    const userSnap = await withTimeout(getDoc(userRef));

    if (!userSnap.exists()) return { success: false, msg: "User not found" };

    const data: any = userSnap.data();
    const now = new Date();
    const lastChange = data.lastIdChange?.toDate ? data.lastIdChange.toDate() : new Date(0);

    const daysSince = (now.getTime() - lastChange.getTime()) / (1000 * 3600 * 24);
    let count = data.idChangeCount || 0;

    if (daysSince > 30) count = 0;

    if (count >= 2) {
      return {
        success: false,
        msg: `Limit reached. You can change ID again in ${Math.ceil(30 - daysSince)} days.`,
      };
    }

    const clean = newCodename.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const newId = `ISTOIC-${clean}`;

    try {
      await withTimeout(
        updateDoc(userRef, {
          codename: clean,
          istokId: newId,
          lastIdChange: serverTimestamp(),
          idChangeCount: count + 1,
        })
      );

      const newIdentity = { ...data, codename: clean, istokId: newId };
      await persistIdentity(newIdentity);

      return { success: true, msg: "ID Updated Successfully." };
    } catch (e: any) {
      return { success: false, msg: e?.message || "Update failed" };
    }
  },

  logout: async () => {
    if (auth) {
      await withTimeout(firebaseSignOut(auth));
    }
    await persistIdentity(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("bio_auth_enabled");
    }
    if (isNative()) {
      await Preferences.remove({ key: "bio_auth_enabled" });
    }
  },

  formatId: (rawName: string): string => {
    const clean = rawName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return `ISTOIC-${clean}`;
  },

  resolveId: (input: string): string => {
    const cleanInput = input.trim().toUpperCase();
    if (cleanInput.startsWith("ISTOIC-")) return cleanInput;
    return `ISTOIC-${cleanInput}`;
  },
};
