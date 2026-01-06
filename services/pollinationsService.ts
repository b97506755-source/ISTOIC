
/**
 * THE HYDRA IMAGE ENGINE (BROWSER ADAPTATION)
 * Ported from Node.js to Browser-Compatible TypeScript.
 * Features: Multi-Model, Smart Routing, Auto-Fallback, ENV Security.
 */

import { debugService } from "./debugService";
import { KEY_MANAGER } from "./geminiService";

export const HYDRA_MODELS = {
    // --- Jalur PREMIUM (Hugging Face API - Butuh Token) ---
    absoluteReality: "DigiTech/AbsoluteReality_v1.8.1",         
    playground: "playgroundai/playground-v2.5-1024px-aesthetic",
    sdxlBase: "stabilityai/stable-diffusion-xl-base-1.0",       

    // --- Jalur GRATIS/UNLIMITED (Pollinations - Tanpa Token) ---
    flux: "flux",             // Standard Flux (Balanced)
    fluxRealism: "flux-realism", // Flux Realism (Photorealistic)
    fluxAnime: "flux-anime",     // Flux Anime (2D/Waifu)
    flux3d: "flux-3d",           // Flux 3D (CGI/Render)
    anyDark: "any-dark",         // Dark/Moody Style
    midjourney: "midjourney",    // MJ Style emulation
    turbo: "turbo"               // Speed King
};

// -----------------------------------------------------------------
//  MODULE 1: THE SMART ROUTER (OTAK PEMILIH MODEL)
// -----------------------------------------------------------------
function analyzePrompt(prompt: string) {
    const p = prompt.toLowerCase();

    // 1. ANIME / ILLUSTRATION
    if (p.includes("anime") || p.includes("manga") || p.includes("waifu") || p.includes("2d") || p.includes("illustration") || p.includes("sketch")) {
        return { type: 'ANIME', model: HYDRA_MODELS.fluxAnime, provider: 'Pollinations AI' };
    }

    // 2. PHOTOREALISM / PORTRAIT
    if (p.includes("photo") || p.includes("real") || p.includes("4k") || p.includes("8k") || p.includes("portrait") || p.includes("realistic")) {
        return { type: 'REALISM', model: HYDRA_MODELS.fluxRealism, provider: 'Pollinations AI' };
    }

    // 3. 3D / RENDER
    if (p.includes("3d") || p.includes("render") || p.includes("blender") || p.includes("unreal") || p.includes("cgi") || p.includes("pixar")) {
        return { type: '3D', model: HYDRA_MODELS.flux3d, provider: 'Pollinations AI' };
    }

    // 4. DARK / MOODY
    if (p.includes("dark") || p.includes("horror") || p.includes("night") || p.includes("gothic") || p.includes("vampire")) {
        return { type: 'DARK', model: HYDRA_MODELS.anyDark, provider: 'Pollinations AI' };
    }

    // Default: Flux Standard
    return { type: 'GENERAL', model: HYDRA_MODELS.flux, provider: 'Pollinations AI' };
}

// -----------------------------------------------------------------
//  MODULE 2: PROVIDER EXECUTORS
// -----------------------------------------------------------------

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Eksekutor A: Hugging Face
async function runHuggingFace(modelId: string, prompt: string): Promise<{ url: string, model: string, provider: string }> {
    debugService.log('INFO', 'HYDRA', 'HF_REQ', `Contacting Model: ${modelId}...`);
    
    const token = KEY_MANAGER.getKey('HUGGINGFACE');
    if (!token) throw new Error("HF_TOKEN missing in Vault (Hugging Face)");

    try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
            headers: { 
                Authorization: `Bearer ${token}`, 
                "Content-Type": "application/json" 
            },
            method: "POST",
            body: JSON.stringify({ inputs: prompt }),
        });

        if (!response.ok) {
            throw new Error(`HF API Error: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64String = `data:image/jpeg;base64,${arrayBufferToBase64(arrayBuffer)}`;
        
        KEY_MANAGER.reportSuccess('HUGGINGFACE');
        return { url: base64String, model: modelId, provider: 'HuggingFace Inference' };
    } catch (e: any) {
        KEY_MANAGER.reportFailure('HUGGINGFACE', token, e);
        throw e;
    }
}

// Eksekutor B: Pollinations
async function runPollinations(modelName: string, prompt: string, enhance: boolean = true): Promise<{ url: string, model: string, provider: string }> {
    debugService.log('INFO', 'HYDRA', 'POLL_REQ', `Contacting Model: ${modelName}...`);
    
    const seed = Math.floor(Math.random() * 10000000);
    const encodedPrompt = encodeURIComponent(prompt);
    
    // Construct URL with extra params for stability
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=${modelName}&seed=${seed}&nologo=true&enhance=${enhance}&safe=false`;

    // Return object containing metadata
    return { url, model: modelName, provider: 'Pollinations (Flux)' };
}

// -----------------------------------------------------------------
//  MODULE 3: MAIN EXPORT
// -----------------------------------------------------------------

export const PollinationsService = {
    generateHydraImage: async (prompt: string, specificModel?: string): Promise<{ url: string, model: string, provider: string }> => {
        console.log(`📝 HYDRA REQUEST: "${prompt}" [Model: ${specificModel || 'AUTO'}]`);

        // 0. Manual Override
        if (specificModel && specificModel !== 'hydra-smart-route') {
            debugService.log('INFO', 'HYDRA', 'MANUAL', `Override: ${specificModel}`);
            
            // Check HF Models
            if (specificModel === HYDRA_MODELS.absoluteReality || specificModel === HYDRA_MODELS.playground || specificModel === HYDRA_MODELS.sdxlBase) {
                return await runHuggingFace(specificModel, prompt);
            } 
            return await runPollinations(specificModel, prompt);
        }

        // 1. Smart Strategy
        const strategy = analyzePrompt(prompt);
        debugService.log('INFO', 'HYDRA', 'ROUTER', `Strategy: ${strategy.type} -> ${strategy.model}`);

        try {
            // Priority Check: If we had HF tokens and wanted realism, we might prefer HF.
            // But for reliability, we default to the router's choice (usually Pollinations Flux variants).
            return await runPollinations(strategy.model, prompt);
        } catch (error: any) {
            console.warn(`⚠️ PRIMARY FAILED: ${error.message}`);
            debugService.log('WARN', 'HYDRA', 'FALLBACK', `Switching to Flux Fallback.`);
            return await runPollinations(HYDRA_MODELS.flux, prompt);
        }
    }
};
