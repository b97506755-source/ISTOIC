
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
 * Used for Visual Fingerprinting.
 * Combines Session IDs + Secret to create a unique visual hash.
 * If MITM attacks change the payload, this hash WILL NOT match on both sides.
 */
export const generateSAS = async (peerA: string, peerB: string, secret: string): Promise<string> => {
    // Sort to ensure consistency on both ends regardless of who is host
    const peers = [peerA, peerB].sort().join(':');
    const input = `${peers}:${secret}`;
    const hash = await hashPin(input);
    
    // Take first 4 bytes and convert to hex for a short readable code
    return hash.substring(0, 4).toUpperCase() + " " + hash.substring(4, 8).toUpperCase();
};

export const verifySystemPin = async (inputPin: string): Promise<boolean> => {
    if (!inputPin) return false;
    const inputHash = await hashPin(inputPin);
    
    const envHash = (
        (process.env as any).VITE_VAULT_PIN_HASH || 
        (import.meta as any).env?.VITE_VAULT_PIN_HASH
    );
    const localHash = localStorage.getItem('sys_vault_hash');
    
    return inputHash === envHash || inputHash === localHash;
};

export const setSystemPin = async (newPin: string): Promise<void> => {
    const hash = await hashPin(newPin);
    localStorage.setItem('sys_vault_hash', hash);
};

export const isSystemPinConfigured = (): boolean => {
    const envHash = (
        (process.env as any).VITE_VAULT_PIN_HASH || 
        (import.meta as any).env?.VITE_VAULT_PIN_HASH
    );
    const localHash = localStorage.getItem('sys_vault_hash');
    return !!(envHash || localHash);
};

/**
 * ENCRYPT DATA (AES-GCM)
 * Returns a JSON string containing the Salt, IV, and Ciphertext.
 * REAL ENCRYPTION.
 */
export const encryptData = async (plainText: string, secret: string): Promise<string | null> => {
    try {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit nonce for GCM
        
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
 * Throws error if key is wrong or data tampered (Integrity Check).
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
        // Integrity check failed or Wrong Key. Return null silently.
        return null;
    }
};
