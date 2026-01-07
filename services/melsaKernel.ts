
import { GoogleGenAI } from "@google/genai";
import { debugService } from "./debugService";
import { HANISAH_BRAIN } from "./melsaBrain";
import { noteTools, visualTools, searchTools, universalTools } from "./geminiService";
import { GLOBAL_VAULT, Provider } from "./hydraVault"; 
import { mechanicTools } from "../features/mechanic/mechanicTools";
import { streamOpenAICompatible } from "./providerEngine";
import { MASTER_MODEL_CATALOG, MODEL_IDS } from "./modelRegistry";
import { Note } from "../types";

export const MODEL_CATALOG = MASTER_MODEL_CATALOG;

export interface StreamChunk {
  text?: string;
  functionCall?: any;
  groundingChunks?: any[];
  metadata?: any;
}

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export class HanisahKernel {
  private history: any[] = [];

  private getActiveTools(provider: string, isThinking: boolean, currentMsg: string = ''): any[] {
      if (provider === 'GEMINI') {
          const configStr = localStorage.getItem('hanisah_tools_config');
          const config = configStr ? JSON.parse(configStr) : { search: true, vault: true, visual: true };
          const tools: any[] = [];
          const lowerMsg = currentMsg.toLowerCase();
          
          if (config.vault && noteTools && ['catat', 'simpan', 'ingat', 'note', 'task', 'list'].some(k => lowerMsg.includes(k))) tools.push(noteTools);
          if (config.visual && visualTools && ['gambar', 'foto', 'visual', 'imagine'].some(k => lowerMsg.includes(k))) tools.push(visualTools);
          if (config.search && searchTools && ['cari', 'berita', 'update', 'harga', 'cuaca'].some(k => lowerMsg.includes(k))) tools.push(searchTools); 
          if (mechanicTools) tools.push(mechanicTools);
          return tools;
      } 
      return universalTools.functionDeclarations ? [universalTools] : [];
  }

  private buildContext(history: any[], currentMsg: string, systemPrompt: string, limit: number): any[] {
      const maxInputTokens = Math.max(4000, limit - 4000);
      let usedTokens = estimateTokens(systemPrompt) + estimateTokens(currentMsg);
      const messagesToSend: any[] = [];
      for (let i = history.length - 1; i >= 0; i--) {
          const entry = history[i];
          const content = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.parts);
          const tokens = estimateTokens(content);
          if (usedTokens + tokens < maxInputTokens) {
              messagesToSend.unshift(entry);
              usedTokens += tokens;
          } else break;
      }
      return messagesToSend;
  }

  // Fix: Accept Note[] | string for contextNotes to allow pre-built context strings
  async *streamExecute(msg: string, initialModelId: string, contextNotes: Note[] | string = [], imageData?: { data: string, mimeType: string }, configOverride?: any): AsyncGenerator<StreamChunk> {
    const systemPrompt = configOverride?.systemInstruction || await HANISAH_BRAIN.getSystemInstruction('hanisah', msg, contextNotes);
    const signal = configOverride?.signal; 
    let currentModelId = initialModelId === 'auto-best' ? MODEL_IDS.GEMINI_FLASH : initialModelId;

    const plan = [...new Set([currentModelId, MODEL_IDS.GEMINI_FLASH, MODEL_IDS.GEMINI_PRO, MODEL_IDS.LLAMA_70B])];
    
    let attempts = 0;
    let hasYielded = false;

    for (let i = 0; i < plan.length; i++) {
        if (signal?.aborted) break;
        const modelId = plan[i];
        const model = MASTER_MODEL_CATALOG.find(m => m.id === modelId) || MASTER_MODEL_CATALOG[0];
        const key = GLOBAL_VAULT.getKey(model.provider as Provider);

        if (!key) {
            // Skip logging every missing key to reduce noise, but track attempt
            continue;
        }

        attempts++;

        try {
            const isThinking = model.specs.speed === 'THINKING';
            const activeTools = configOverride?.tools || this.getActiveTools(model.provider, isThinking, msg);
            const contextLimit = model.specs.contextLimit || 128000;
            const optimizedHistory = this.buildContext(this.history, msg, systemPrompt, contextLimit);

            if (model.provider === 'GEMINI') {
                const ai = new GoogleGenAI({ apiKey: key });
                const contents = [
                    ...optimizedHistory.map(h => ({ role: h.role, parts: h.parts })), 
                    { role: 'user', parts: imageData ? [{ inlineData: imageData }, { text: msg }] : [{ text: msg }] }
                ];
                const stream = await ai.models.generateContentStream({ model: model.id, contents, config: { systemInstruction: systemPrompt, temperature: 0.7, tools: activeTools } });
                let fullText = "";
                for await (const chunk of stream) {
                    if (signal?.aborted) break;
                    if (chunk.text) { 
                        fullText += chunk.text; 
                        yield { text: chunk.text }; 
                        hasYielded = true;
                    }
                    if (chunk.functionCalls?.length) {
                        yield { functionCall: chunk.functionCalls[0] };
                        hasYielded = true;
                    }
                    if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) yield { groundingChunks: chunk.candidates[0].groundingMetadata.groundingChunks };
                }
                if (hasYielded) {
                    this.updateHistory(msg, fullText);
                    return; // Success, exit loop
                }
            } else {
                const standardHistory = optimizedHistory.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0]?.text || '' }));
                const stream = streamOpenAICompatible(model.provider as any, model.id, [...standardHistory, { role: 'user', content: msg }], systemPrompt, activeTools, signal);
                let fullText = "";
                for await (const chunk of stream) {
                    if (signal?.aborted) break;
                    if (chunk.text) { 
                        fullText += chunk.text; 
                        yield { text: chunk.text }; 
                        hasYielded = true;
                    }
                    if (chunk.functionCall) {
                        yield { functionCall: chunk.functionCall };
                        hasYielded = true;
                    }
                }
                if (hasYielded) {
                    this.updateHistory(msg, fullText);
                    return; // Success, exit loop
                }
            }
        } catch (err: any) {
            GLOBAL_VAULT.reportFailure(model.provider as Provider, key, err);
            if (i < plan.length - 1) yield { metadata: { systemStatus: `Rerouting to ${plan[i+1]}...`, isRerouting: true } };
            // Don't yield error text yet, try next model
        }
    }

    // FALLBACK IF ALL FAILED
    if (!hasYielded) {
        if (attempts === 0) {
             yield { text: `\n\n> ⚠️ **SYSTEM HALT: NO API KEYS DETECTED**\n\nSistem tidak menemukan kunci API yang valid di \`.env\`. Harap konfirmasi konfigurasi server atau tambahkan kunci API.` };
        } else {
             yield { text: `\n\n> ⚠️ **CONNECTION FAILURE**\n\nSemua provider AI (${attempts}) gagal merespons. Periksa koneksi internet atau kuota API Anda.` };
        }
    }
  }

  private updateHistory(user: string, assistant: string) {
    this.history.push({ role: 'user', parts: [{ text: user }] }, { role: 'model', parts: [{ text: assistant }] });
    if (this.history.length > 50) this.history = this.history.slice(-50);
  }

  // Fix: Accept Note[] | string for contextNotes
  async execute(msg: string, modelId: string, contextNotes?: Note[] | string): Promise<StreamChunk> {
    const it = this.streamExecute(msg, modelId, contextNotes || []);
    let fullText = "";
    let finalChunk: StreamChunk = {};
    for await (const chunk of it) {
        if (chunk.text) fullText += chunk.text;
        if (chunk.functionCall) finalChunk.functionCall = chunk.functionCall;
    }
    finalChunk.text = fullText;
    return finalChunk;
  }
}

export const HANISAH_KERNEL = new HanisahKernel();
