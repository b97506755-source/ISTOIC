
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { debugService } from './debugService';
import { GLOBAL_VAULT, Provider } from "./hydraVault";
import { SECURITY_MATRIX } from "./securityMatrix";

export const SANITIZED_ERRORS: Record<string, string> = {
  DEFAULT: "An obstacle has arisen. We shall navigate around it.",
  QUOTA: "Resources exhausted. System is rotating keys.",
  BALANCE: "Node balance insufficient. Switching providers.",
  NETWORK: "The signal is faint. We await clarity."
};

export interface ProviderStatus {
    id: string;
    status: 'HEALTHY' | 'COOLDOWN';
    keyCount: number;
    cooldownRemaining: number;
}

// Proxy Class to maintain compatibility with existing app code
class KeyManagerProxy {
  
  public refreshPools() {
    GLOBAL_VAULT.refreshPools();
  }

  public isProviderHealthy(provider: string): boolean {
    return GLOBAL_VAULT.isProviderHealthy(provider as Provider);
  }

  public reportFailure(provider: string, arg2: any, arg3?: any) {
      if (arg3 !== undefined) {
          GLOBAL_VAULT.reportFailure(provider as Provider, arg2, arg3);
      } else {
          debugService.log('WARN', 'LEGACY_KEY_MGR', 'FAIL_REPORT', `Provider ${provider} reported failure without key context.`);
      }
  }

  public reportSuccess(provider: string) {
      GLOBAL_VAULT.reportSuccess(provider as Provider);
  }

  public getKey(provider: string): string | null {
    return GLOBAL_VAULT.getKey(provider as Provider);
  }

  public getAllProviderStatuses(): ProviderStatus[] {
      return GLOBAL_VAULT.getAllProviderStatuses();
  }
}

export const KEY_MANAGER = new KeyManagerProxy();

// --- GEMINI IMAGE GENERATION HELPER ---
async function generateGeminiImage(prompt: string, apiKey: string, modelId: string): Promise<string | null> {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: [{ text: prompt }] },
    });
    
    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    return null;
}

// --- OPENAI DALL-E HELPER (Fallback) ---
async function generateOpenAIImage(prompt: string, apiKey: string): Promise<string | null> {
    // https://api.openai.com/v1/images/generations
    const endpoint = SECURITY_MATRIX.synthesizeEndpoint([104,116,116,112,115,58,47,47,97,112,105,46,111,112,101,110,97,105,46,99,111,109,47,118,49,47,105,109,97,103,101,115,47,103,101,110,101,114,97,116,105,111,110,115]);

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json"
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "OpenAI Image Generation Failed");
    }

    const data = await response.json();
    return data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null;
}

export async function generateImage(prompt: string, modelId: string = 'gemini-2.5-flash-image'): Promise<string | null> {
  const geminiKey = KEY_MANAGER.getKey('GEMINI');
  const openaiKey = KEY_MANAGER.getKey('OPENAI');
  
  let lastError = "";

  // V20 STRATEGY: Prioritize Gemini 2.5 Flash Image / 3 Pro Image
  if (geminiKey && modelId.includes('gemini')) {
      try {
          const result = await generateGeminiImage(prompt, geminiKey, modelId);
          if (result) {
              KEY_MANAGER.reportSuccess('GEMINI');
              return result;
          }
      } catch (e: any) {
          debugService.log('WARN', 'IMG_GEN', 'PRIMARY_FAIL', `Gemini ${modelId} failed: ${e.message}`);
          lastError = e.message;
          GLOBAL_VAULT.reportFailure('GEMINI', geminiKey, e);
      }
  }

  // Fallback
  if (openaiKey) {
      try {
          debugService.log('INFO', 'IMG_GEN', 'FALLBACK_OPENAI', 'Attempting fallback to OpenAI DALL-E 3...');
          const result = await generateOpenAIImage(prompt, openaiKey);
          if (result) {
              KEY_MANAGER.reportSuccess('OPENAI');
              return result;
          }
      } catch (e: any) {
          debugService.log('ERROR', 'IMG_GEN', 'FALLBACK_OPENAI_FAIL', `DALL-E 3 failed: ${e.message}`);
          GLOBAL_VAULT.reportFailure('OPENAI', openaiKey, e);
          lastError = e.message;
      }
  }

  if (lastError.includes('429')) {
      throw new Error("QUOTA_EXCEEDED: Image generation limit reached. Please wait.");
  } else if (!geminiKey && !openaiKey) {
      throw new Error("NO_KEYS: No API keys available for Image Generation.");
  }

  throw new Error(`GENERATION_FAILED: ${lastError.slice(0, 100)}...`);
}

export async function generateVideo(prompt: string, config: any): Promise<string | null> {
    const key = KEY_MANAGER.getKey('GEMINI');
    if (!key) return null;
    const ai = new GoogleGenAI({ apiKey: key });
    try {
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            config: {
                numberOfVideos: 1,
                resolution: config.resolution || '720p',
                aspectRatio: config.aspectRatio || '16:9'
            }
        });
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) return null;
        const response = await fetch(`${downloadLink}&key=${key}`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (e) {
        GLOBAL_VAULT.reportFailure('GEMINI', key, e);
    }
    return null;
}

export async function editImage(base64: string, mimeType: string, prompt: string): Promise<string | null> {
    const key = KEY_MANAGER.getKey('GEMINI');
    if (!key) return null;
    const ai = new GoogleGenAI({ apiKey: key });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // Flash Image supports editing
            contents: {
                parts: [
                    { inlineData: { data: base64, mimeType } },
                    { text: prompt },
                ],
            },
        });
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:image/png;base64,${part.inlineData.data}`;
                }
            }
        }
    } catch (e) {
        GLOBAL_VAULT.reportFailure('GEMINI', key, e);
    }
    return null;
}

export function encodeAudio(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeAudio(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- V20 TOOL DEFINITIONS ---

const manageNoteTool: FunctionDeclaration = {
  name: 'manage_note',
  description: 'V20 STRICT PROTOCOL: Creates/Updates/Searches note database. ONLY TRIGGER when user explicitly requests: "Catat", "Simpan", "Save", "Tulis", "Archive". DO NOT USE for general chat, "Halo", "Apa kabar".',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING, description: 'CREATE, UPDATE, APPEND, or DELETE' },
      id: { type: Type.STRING, description: 'Note ID' },
      title: { type: Type.STRING, description: 'Title' },
      content: { type: Type.STRING, description: 'Content' },
      appendContent: { type: Type.STRING, description: 'Append Text' },
      tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Tags' }
    },
    required: ['action']
  }
};

const searchNotesTool: FunctionDeclaration = {
    name: 'search_notes',
    description: 'Retrieve information from the V20 Secure Vault. Use when user asks "Check notes", "What did I say about", "Cari catatan".',
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: { type: Type.STRING, description: 'Search keywords.' }
        },
        required: ['query']
    }
};

const readNoteTool: FunctionDeclaration = {
    name: 'read_note',
    description: 'Read full content of a specific note by ID.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING, description: 'Note ID' }
        },
        required: ['id']
    }
};

// --- VISUAL GENERATION TOOL ---
const generateVisualTool: FunctionDeclaration = {
    name: 'generate_visual',
    description: 'Generate high-fidelity images using Hydra/Imagen V20. MANDATORY for requests like "Draw", "Imagine", "Gambarin", "Visual".',
    parameters: {
        type: Type.OBJECT,
        properties: {
            prompt: { 
                type: Type.STRING, 
                description: 'Detailed visual prompt in English.' 
            }
        },
        required: ['prompt']
    }
};

export const noteTools = { functionDeclarations: [manageNoteTool, searchNotesTool, readNoteTool] };
export const visualTools = { functionDeclarations: [generateVisualTool] }; 
export const searchTools = { googleSearch: {} }; 

// Universal tools for Non-Gemini providers
export const universalTools = {
    functionDeclarations: [manageNoteTool, searchNotesTool, readNoteTool, generateVisualTool]
};
