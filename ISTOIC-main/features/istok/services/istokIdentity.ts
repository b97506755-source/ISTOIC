
import { auth, db, googleProvider, signInWithPopup, signOut } from "../../../services/firebaseConfig";
// @ts-ignore
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { debugService } from "../../../services/debugService";

export interface IStokUserIdentity {
    uid: string;         
    istokId: string;     
    codename: string;    
    email: string;       
    displayName: string; 
    photoURL: string;
    lastIdChange?: any; // Timestamp Firestore
    idChangeCount?: number;
}

export const IstokIdentityService = {
    
    loginWithGoogle: async (): Promise<IStokUserIdentity> => {
        if (!auth) {
            throw new Error("Firebase Configuration Missing in .env");
        }
        
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            
            // Check Firestore for existing profile
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                // Return existing profile from DB
                return userSnap.data() as IStokUserIdentity;
            } else {
                // New User (Needs Setup)
                return {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    istokId: "", // Will be set in next step
                    codename: ""
                } as IStokUserIdentity;
            }
        } catch (error: any) {
            console.error("[ISTOK_AUTH] Detailed Error:", error);
            
            const errCode = error.code || '';
            const errMsg = error.message || String(error);

            // Handle User Cancellation Gracefully
            if (errCode === 'auth/popup-closed-by-user' || errMsg.includes('closed-by-user')) {
                throw new Error("Login cancelled by user.");
            }

            // Handle Cross-Origin-Opener-Policy blocking (Browsers blocking window.closed)
            if (
                errCode === 'auth/popup-blocked' || 
                errMsg.includes('Cross-Origin-Opener-Policy') ||
                errMsg.includes('window.closed')
            ) {
                throw new Error("Popup blocked by browser policy (COOP). Please use Chrome/Edge or check popup settings.");
            }

            debugService.log('ERROR', 'ISTOK_AUTH', 'LOGIN_FAIL', `${errCode}: ${errMsg}`);
            
            // Handle Unauthorized Domain (Common Dev Error)
            let friendlyMsg = errMsg;
            
            // Robust check for domain error
            if (
                errCode === 'auth/unauthorized-domain' || 
                errMsg.includes('auth/unauthorized-domain') ||
                errMsg.includes('unauthorized-domain')
            ) {
                const currentDomain = window.location.hostname;
                friendlyMsg = `Domain "${currentDomain}" unauthorized. Add to Firebase Console > Auth > Settings.`;
            } else if (errCode === 'auth/network-request-failed') {
                friendlyMsg = "Network connection failed. Please check your internet.";
            }

            throw new Error(friendlyMsg);
        }
    },

    // Save initial profile
    createProfile: async (identity: IStokUserIdentity) => {
        if (!db || !identity.uid) return;
        try {
            await setDoc(doc(db, "users", identity.uid), {
                ...identity,
                createdAt: serverTimestamp(),
                lastIdChange: serverTimestamp(),
                idChangeCount: 0
            });
            // Update LocalStorage mirror
            localStorage.setItem('istok_user_identity', JSON.stringify(identity));
        } catch (e) {
            console.error("Profile Creation Error", e);
            throw e;
        }
    },

    // Update ID with Restrictions (2x per month)
    updateCodename: async (uid: string, newCodename: string): Promise<{success: boolean, msg: string}> => {
        if (!db) return { success: false, msg: "Database offline" };
        
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) return { success: false, msg: "User not found" };
        
        const data = userSnap.data();
        const now = new Date();
        const lastChange = data.lastIdChange?.toDate ? data.lastIdChange.toDate() : new Date(0);
        
        // Logic: Reset count if last change was > 30 days ago
        const daysSince = (now.getTime() - lastChange.getTime()) / (1000 * 3600 * 24);
        let count = data.idChangeCount || 0;
        
        if (daysSince > 30) {
            count = 0; // Reset quota
        }

        if (count >= 2) {
            return { 
                success: false, 
                msg: `Limit reached. You can change ID again in ${Math.ceil(30 - daysSince)} days.` 
            };
        }

        const clean = newCodename.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const newId = `ISTOIC-${clean}`;

        try {
            await updateDoc(userRef, {
                codename: clean,
                istokId: newId,
                lastIdChange: serverTimestamp(),
                idChangeCount: count + 1
            });
            
            // Update local
            const newIdentity = { ...data, codename: clean, istokId: newId };
            localStorage.setItem('istok_user_identity', JSON.stringify(newIdentity));
            
            return { success: true, msg: "ID Updated Successfully." };
        } catch (e: any) {
            return { success: false, msg: e.message };
        }
    },

    logout: async () => {
        if (auth) await signOut(auth);
        localStorage.removeItem('istok_user_identity');
        localStorage.removeItem('bio_auth_enabled');
        // Do NOT remove sys_vault_hash to prevent lock-out from local data, 
        // but typically logout implies clearing sensitive access.
    },

    formatId: (rawName: string): string => {
        const clean = rawName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return `ISTOIC-${clean}`;
    },

    resolveId: (input: string): string => {
        const cleanInput = input.trim().toUpperCase();
        if (cleanInput.startsWith('ISTOIC-')) return cleanInput;
        return `ISTOIC-${cleanInput}`;
    }
};