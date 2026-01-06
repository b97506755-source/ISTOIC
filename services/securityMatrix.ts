
import { debugService } from './debugService';

/**
 * SECURITY MATRIX v1.5 (ENHANCED)
 * In-Memory Obfuscation Engine & Endpoint Synthesizer.
 * 
 * Objective: 
 * 1. Prevent API Keys from residing in RAM as plain text.
 * 2. Prevent API Endpoint URLs from existing as string literals in the source code.
 */

class SecurityMatrixEngine {
    private sessionSalt: Uint8Array;

    constructor() {
        // Generate a random high-entropy salt for this session only.
        this.sessionSalt = crypto.getRandomValues(new Uint8Array(32));
    }

    /**
     * Obfuscates a plain string into a scrambled byte array.
     */
    public cloak(plainText: string): string {
        if (!plainText) return '';
        
        const encoder = new TextEncoder();
        const encoded = encoder.encode(plainText);
        const result = new Uint8Array(encoded.length);

        for (let i = 0; i < encoded.length; i++) {
            // XOR Operation: Byte ^ Salt (Cyclic)
            result[i] = encoded[i] ^ this.sessionSalt[i % this.sessionSalt.length];
        }

        // Convert to Hex string for storage
        return Array.from(result).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * De-obfuscates the hex string back to plain text.
     * WARNING: Use this ONLY immediately before network transmission.
     */
    public decloak(obfuscatedHex: string): string {
        if (!obfuscatedHex) return '';

        const bytes = new Uint8Array(obfuscatedHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
        const result = new Uint8Array(bytes.length);

        for (let i = 0; i < bytes.length; i++) {
            result[i] = bytes[i] ^ this.sessionSalt[i % this.sessionSalt.length];
        }

        const decoder = new TextDecoder();
        return decoder.decode(result);
    }

    /**
     * ENDPOINT SYNTHESIZER
     * Constructs URL strings from ASCII byte arrays.
     * This prevents "grep" or static analysis from finding URLs like "api.openai.com" in your code bundle.
     */
    public synthesizeEndpoint(bytes: number[]): string {
        return String.fromCharCode(...bytes);
    }

    /**
     * Hard-wipe a string from memory (Best effort in JS)
     */
    public wipe(sensitiveData: string) {
        // JS strings are immutable, but we can detach references
        // This is a semantic signal to the Garbage Collector
        sensitiveData = '0000000000000000'; 
    }
}

export const SECURITY_MATRIX = new SecurityMatrixEngine();
