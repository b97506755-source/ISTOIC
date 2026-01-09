
/**
 * CRYPTOGRAPHIC CORE v25.0
 * Implementation: Web Crypto API (Native Browser Hardware Acceleration)
 * Standard: AES-GCM 256-bit + PBKDF2 + SHA-256
 */

// --- UTILITIES ---

const enc = new TextEncoder();
const dec = new TextDecoder();

const getPasswordKey = (password: string) => 
  crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);

const deriveKey = async (passwordKey: CryptoKey, salt: Uint8Array, usage: ["encrypt"] | ["decrypt"]) => 
  crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 200000, // HIGH ITERATION for Bruteforce Resistance
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    usage
  );

const bufferToBase64 = (buf: ArrayBuffer): string => {
    const binString = Array.from(new Uint8Array(buf), (byte) =>
        String.fromCharCode(byte)
    ).join("");
    return btoa(binString);
}

const base64ToBuffer = (base64: string): Uint8Array => {
    const binString = atob(base64);
    return Uint8Array.from(binString, (m) => m.codePointAt(0)!);
}

// --- PUBLIC API ---

/**
 * Hashing for PIN Verification (One-way)
 */
export const hashPin = async (pin: string): Promise<string> => {
    const data = enc.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Real SAS (Short Authentication String) Generation
 */
export const generateSAS = async (peerA: string, peerB: string, secret: string): Promise<string> => {
    const peers = [peerA, peerB].sort().join(':');
    const input = `${peers}:${secret}`;
    const hash = await hashPin(input);
    return hash.substring(0, 4).toUpperCase() + " " + hash.substring(4, 8).toUpperCase();
};

/**
 * CHECK LOCAL USER PIN
 */
export const verifySystemPin = async (inputPin: string): Promise<boolean> => {
    if (!inputPin) return false;
    const inputHash = await hashPin(inputPin);
    const localHash = localStorage.getItem('sys_vault_hash');
    return inputHash === localHash;
};

/**
 * CHECK MASTER KEY (.ENV)
 */
export const verifyMasterPin = async (inputPin: string): Promise<boolean> => {
    if (!inputPin) return false;
    
    // Vite loads env vars from import.meta.env
    const masterHash = (
        (process.env as any).VITE_VAULT_PIN_HASH || 
        (import.meta as any).env?.VITE_VAULT_PIN_HASH
    );

    if (!masterHash) return false; 

    const inputHash = await hashPin(inputPin);
    return inputHash === masterHash;
};

/**
 * UNIFIED ACCESS CHECK (The Gatekeeper)
 * Returns TRUE if input matches EITHER the User's PIN OR the Developer Master Key
 */
export const verifyVaultAccess = async (inputPin: string): Promise<boolean> => {
    // 1. Check Master Key (Developer Backdoor)
    if (await verifyMasterPin(inputPin)) {
        console.log("[VAULT] Master Key Bypass Accepted.");
        return true;
    }
    
    // 2. Check User Local PIN (Standard Access)
    return await verifySystemPin(inputPin);
};

export const setSystemPin = async (newPin: string): Promise<void> => {
    const hash = await hashPin(newPin);
    localStorage.setItem('sys_vault_hash', hash);
};

export const isSystemPinConfigured = (): boolean => {
    const localHash = localStorage.getItem('sys_vault_hash');
    const masterHash = (
        (process.env as any).VITE_VAULT_PIN_HASH || 
        (import.meta as any).env?.VITE_VAULT_PIN_HASH
    );
    // Considered configured if Local PIN exists OR Master Key is present (allows dev to unlock fresh state)
    return !!(localHash || masterHash);
};

/**
 * ENCRYPT DATA (AES-GCM)
 */
export const encryptData = async (plainText: string, secret: string): Promise<string | null> => {
    try {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12)); 
        
        const passwordKey = await getPasswordKey(secret);
        const aesKey = await deriveKey(passwordKey, salt, ["encrypt"]);
        
        const encryptedContent = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            aesKey,
            enc.encode(plainText)
        );

        const packageData = {
            salt: bufferToBase64(salt),
            iv: bufferToBase64(iv),
            cipher: bufferToBase64(encryptedContent)
        };

        return JSON.stringify(packageData);
    } catch (e) {
        console.error("CRYPTO_FAIL: Encryption Error", e);
        return null;
    }
};

/**
 * DECRYPT DATA (AES-GCM)
 */
export const decryptData = async (packageJson: string, secret: string): Promise<string | null> => {
    try {
        const pkg = JSON.parse(packageJson);
        const salt = base64ToBuffer(pkg.salt);
        const iv = base64ToBuffer(pkg.iv);
        const cipher = base64ToBuffer(pkg.cipher);

        const passwordKey = await getPasswordKey(secret);
        const aesKey = await deriveKey(passwordKey, salt, ["decrypt"]);

        const decryptedContent = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            aesKey,
            cipher
        );

        return dec.decode(decryptedContent);
    } catch (e) {
        return null;
    }
};
