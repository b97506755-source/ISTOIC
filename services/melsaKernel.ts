
import { GoogleGenAI } from "@google/genai";
import { debugService } from "./debugService";
import { HANISAH_BRAIN } from "./melsaBrain";
import { noteTools, visualTools, searchTools, universalTools } from "./geminiService";
import { GLOBAL_VAULT, Provider } from "./hydraVault"; 
import { mechanicTools } from "../features/mechanic/mechanicTools";
import { streamOpenAICompatible } from "./providerEngine";
import { type ModelMetadata } from "../types";
import { FREE_TIER_MODELS } from "./freeModels";

export const MODEL_CATALOG: ModelMetadata[] = [
  { 
    id: 'gemini-3-flash-preview', 
    name: 'Gemini 3 Flash', 
    category: 'GEMINI_3', 
    provider: 'GEMINI', 
    description: 'Titanium V25 Standard: Ultra-fast reasoning with 1M context.', 
    specs: { context: '1M', contextLimit: 1000000, speed: 'INSTANT', intelligence: 9.5 } 
  },
  { 
    id: 'gemini-3-pro-preview', 
    name: 'Gemini 3 Pro', 
    category: 'GEMINI_3', 
    provider: 'GEMINI', 
    description: 'Titanium V25 Deep: Complex reasoning and STEM solver.', 
    specs: { context: '2M', contextLimit: 2000000, speed: 'THINKING', intelligence: 10.0 } 
  },
  {
    id: 'auto-best',
    name: 'Hydra Omni V25',
    category: 'GEMINI_2_5', 
    provider: 'GEMINI', 
    description: 'Parallel Execution Engine. Fastest node wins.',
    specs: { context: 'AUTO', contextLimit: 128000, speed: 'INSTANT', intelligence: 9.9 } 
  },
  { 
    id: 'llama-3.3-70b-versatile', 
    name: 'Llama 3.3 70B', 
    category: 'GROQ_VELOCITY', 
    provider: 'GROQ', 
    description: 'Open Source standard running on LPU hardware.', 
    specs: { context: '128K', contextLimit: 128000, speed: 'INSTANT', intelligence: 9.3 } 
  },
  ...FREE_TIER_MODELS
];

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
          
          // V25 Logic: Keyword detection to save tokens. Only attach tools if relevant.
          const lowerMsg = currentMsg.toLowerCase();
          
          // Note/Vault Intent
          const noteKeywords = ['catat', 'simpan', 'ingat', 'tulis', 'save', 'note', 'task', 'tugas', 'hapus', 'cari', 'search', 'list'];
          if (config.vault && noteTools && noteKeywords.some(k => lowerMsg.includes(k))) {
              tools.push(noteTools);
          }
          
          // Visual Intent
          const visualKeywords = ['gambar', 'foto', 'image', 'picture', 'lukis', 'generate', 'visual', 'imagine', 'buatkan'];
          if (config.visual && visualTools && visualKeywords.some(k => lowerMsg.includes(k))) {
              tools.push(visualTools);
          }
          
          // Search Intent
          const searchKeywords = ['cari', 'siapa', 'apa', 'dimana', 'kapan', 'berita', 'news', 'update', 'harga', 'cuaca'];
          if (config.search && searchKeywords.some(k => lowerMsg.includes(k))) {
              tools.push(searchTools); 
          }
          
          // Always include mechanic for self-healing
          if (mechanicTools) tools.push(mechanicTools);
          
          return tools;
      } 
      return universalTools.functionDeclarations ? [universalTools] : [];
  }

  private buildContext(history: any[], currentMsg: string, systemPrompt: string, limit: number): any[] {
      const SAFETY_BUFFER = 4000; 
      const maxInputTokens = Math.max(4000, limit - SAFETY_BUFFER);
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

  private updateHistory(user: string, assistant: string) {
    this.history.push({ role: 'user', parts: [{ text: user }] }, { role: 'model', parts: [{ text: assistant }] });
    if (this.history.length > 50) this.history = this.history.slice(-50);
  }

  async *streamExecute(msg: string, initialModelId: string, context?: string, imageData?: { data: string, mimeType: string }, configOverride?: any): AsyncGenerator<StreamChunk> {
    const systemPrompt = configOverride?.systemInstruction || HANISAH_BRAIN.getSystemInstruction('hanisah', context);
    const signal = configOverride?.signal; 
    let currentModelId = initialModelId === 'auto-best' ? 'gemini-3-flash-preview' : initialModelId;

    // V25 ROBUST FAILOVER CHAIN
    // If one fails, try the next immediately.
    const plan = [
        currentModelId, 
        'gemini-3-flash-preview', 
        'gemini-3-pro-preview', 
        'llama-3.3-70b-versatile',
        'gemini-2.0-flash-exp' // Legacy fallback
    ];
    const uniquePlan = [...new Set(plan)];

    for (let i = 0; i < uniquePlan.length; i++) {
        if (signal?.aborted) break;
        const modelId = uniquePlan[i];
        const model = MODEL_CATALOG.find(m => m.id === modelId) || MODEL_CATALOG[0];
        
        // V25: HydraVault Rotation Logic is handled inside getKey. 
        // We just ask for a key. If it fails inside generateContent, we loop.
        const key = GLOBAL_VAULT.getKey(model.provider as Provider);

        if (!key) {
            debugService.log('WARN', 'KERNEL', 'NO_KEY', `No key for ${model.provider}, skipping...`);
            continue;
        }

        try {
            debugService.log('INFO', 'KERNEL', 'EXECUTE', `Attempting ${modelId} (Plan ${i+1}/${uniquePlan.length})`);
            
            const isThinking = model.specs.speed === 'THINKING';
            const activeTools = configOverride?.tools || this.getActiveTools(model.provider, isThinking, msg);
            const contextLimit = model.specs.contextLimit || 128000;
            const optimizedHistory = this.buildContext(this.history, msg, systemPrompt, contextLimit);

            if (model.provider === 'GEMINI') {
                const ai = new GoogleGenAI({ apiKey: key });
                const config: any = { 
                    systemInstruction: systemPrompt, 
                    temperature: 0.7 
                };
                
                // V25 Deep Search / Thinking Logic
                if (isThinking) {
                    // Activate Thinking config for Pro models
                    // Note: Check API docs if thinkingConfig is available for the specific model
                    // For V25, we assume 2.0/3.0 Pro supports it.
                    // config.thinkingConfig = { includeThoughts: true }; 
                }

                if (activeTools.length > 0) config.tools = activeTools;

                const contents = [
                    ...optimizedHistory.map(h => ({ role: h.role, parts: h.parts })), 
                    { role: 'user', parts: imageData ? [{ inlineData: imageData }, { text: msg }] : [{ text: msg }] }
                ];

                const stream = await ai.models.generateContentStream({ model: model.id, contents, config });
                let fullText = "";
                let hasStarted = false;

                for await (const chunk of stream) {
                    if (signal?.aborted) break;
                    if (chunk.text) { 
                        fullText += chunk.text; 
                        yield { text: chunk.text }; 
                        hasStarted = true;
                    }
                    if (chunk.functionCalls?.length) { 
                        yield { functionCall: chunk.functionCalls[0] }; 
                        hasStarted = true;
                    }
                    if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
                        yield { groundingChunks: chunk.candidates[0].groundingMetadata.groundingChunks };
                    }
                }
                
                if (!hasStarted) throw new Error("Empty Response");
                this.updateHistory(msg, fullText);
                return; // Success! Exit the failover loop.

            } else {
                // Non-Gemini Providers (Groq, etc.)
                const standardHistory = optimizedHistory.map(h => ({
                    role: h.role === 'model' ? 'assistant' : 'user',
                    content: h.parts[0]?.text || ''
                }));
                const stream = streamOpenAICompatible(model.provider as any, model.id, [...standardHistory, { role: 'user', content: msg }], systemPrompt, activeTools, signal);
                let fullText = "";
                let hasStarted = false;
                for await (const chunk of stream) {
                    if (signal?.aborted) break;
                    if (chunk.text) { fullText += chunk.text; yield { text: chunk.text }; hasStarted = true; }
                    if (chunk.functionCall) { yield { functionCall: chunk.functionCall }; hasStarted = true; }
                }
                if (!hasStarted) throw new Error("Empty Response");
                this.updateHistory(msg, fullText);
                return; // Success!
            }
        } catch (err: any) {
            const errStr = err.message.toLowerCase();
            const isQuota = errStr.includes('429') || errStr.includes('limit') || errStr.includes('exhausted') || errStr.includes('quota');
            
            // Log failure to Vault to trigger cooldown
            GLOBAL_VAULT.reportFailure(model.provider as Provider, key, err);
            
            debugService.log('WARN', 'KERNEL', 'FAILOVER', `${modelId} failed: ${err.message}. Switching...`);

            if (i < uniquePlan.length - 1) {
                // If not the last model, yield a metadata update (not text) so UI knows we are rerouting
                yield { metadata: { systemStatus: `Rerouting logic to ${uniquePlan[i+1]}...`, isRerouting: true } };
                
                // Slight delay to prevent rapid-fire loops
                await new Promise(resolve => setTimeout(resolve, 800));
                continue; 
            } else {
                // V25 NATURAL ERROR RESPONSE (No more ugly bubbles)
                // If ALL models fail, we return a natural text response from the "System Persona"
                const naturalError = msg.toLowerCase().includes('gambar') 
                    ? "Waduh, imajinasiku lagi buntu nih (Server Overload). Coba minta lagi bentar lagi ya?"
                    : "Aduh, kepalaku pusing (Network Error). Tunggu sebentar ya sayang, aku istirahat 5 detik dulu...";
                
                yield { text: naturalError };
                this.updateHistory(msg, naturalError);
                return;
            }
        }
    }
  }

  async execute(msg: string, modelId: string, context?: string): Promise<StreamChunk> {
    const it = this.streamExecute(msg, modelId, context);
    let fullText = "";
    let finalChunk: StreamChunk = {};
    for await (const chunk of it) {
        if (chunk.text) fullText += chunk.text;
        if (chunk.functionCall) finalChunk.functionCall = chunk.functionCall;
        if (chunk.metadata) finalChunk.metadata = chunk.metadata;
    }
    finalChunk.text = fullText;
    return finalChunk;
  }
}

export const HANISAH_KERNEL = new HanisahKernel();