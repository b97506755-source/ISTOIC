
import { GoogleGenAI } from "@google/genai";
import { HANISAH_BRAIN } from "./melsaBrain";
import { streamOpenAICompatible } from "./providerEngine";
import { GLOBAL_VAULT, Provider } from "./hydraVault";
import { MASTER_MODEL_CATALOG, MODEL_IDS } from "./modelRegistry";
import { Note } from "../types";
import { StreamChunk } from "./melsaKernel";

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

class StoicLogicKernel {
  private history: any[] = [];

  private buildContext(history: any[], currentMsg: string, systemPrompt: string, limit: number): any[] {
      const maxInputTokens = Math.max(2000, limit - 2000);
      let usedTokens = estimateTokens(systemPrompt) + estimateTokens(currentMsg);
      const messagesToSend: any[] = [];
      for (let i = history.length - 1; i >= 0; i--) {
          const entry = history[i];
          const content = Array.isArray(entry.parts) ? entry.parts[0].text : entry.content;
          const tokens = estimateTokens(content || '');
          if (usedTokens + tokens < maxInputTokens) {
              messagesToSend.unshift(entry);
              usedTokens += tokens;
          } else break;
      }
      return messagesToSend;
  }

  // Fix: Accept Note[] | string for contextNotes to support pre-processed context strings
  async *streamExecute(msg: string, modelId: string, contextNotes: Note[] | string = [], attachment?: any, configOverride?: any): AsyncGenerator<StreamChunk> {
    const systemPrompt = await HANISAH_BRAIN.getSystemInstruction('stoic', msg, contextNotes);
    const signal = configOverride?.signal; 
    let effectiveId = modelId === 'auto-best' ? MODEL_IDS.GEMINI_FLASH : modelId;

    const plan = [...new Set([effectiveId, MODEL_IDS.GEMINI_FLASH, MODEL_IDS.LLAMA_70B])];

    let attempts = 0;
    let hasYielded = false;

    for (let i = 0; i < plan.length; i++) {
        if (signal?.aborted) break;
        const currentId = plan[i];
        const model = MASTER_MODEL_CATALOG.find(m => m.id === currentId) || MASTER_MODEL_CATALOG[0];
        const key = GLOBAL_VAULT.getKey(model.provider as Provider);

        if (!key) continue;

        attempts++;

        try {
          if (model.provider === 'GEMINI') {
            const ai = new GoogleGenAI({ apiKey: key });
            const contents = [...this.buildContext(this.history, msg, systemPrompt, 32000), { role: 'user', parts: [{ text: msg }] }];
            const stream = await ai.models.generateContentStream({ model: model.id, contents, config: { systemInstruction: systemPrompt, temperature: 0.1 } });
            let fullText = "";
            for await (const chunk of stream) {
              if (signal?.aborted) break;
              if (chunk.text) { 
                  fullText += chunk.text; 
                  yield { text: chunk.text }; 
                  hasYielded = true;
              }
            }
            if (hasYielded) {
                this.updateHistory(msg, fullText);
                return;
            }
          } else {
            const stream = streamOpenAICompatible(model.provider as any, model.id, [{ role: 'user', content: msg }], systemPrompt, [], signal);
            let fullText = "";
            for await (const chunk of stream) {
                if (signal?.aborted) break;
                if (chunk.text) { 
                    fullText += chunk.text; 
                    yield { text: chunk.text }; 
                    hasYielded = true;
                }
            }
            if (hasYielded) {
                this.updateHistory(msg, fullText);
                return;
            }
          }
        } catch (err: any) {
            GLOBAL_VAULT.reportFailure(model.provider as Provider, key, err);
            if (i < plan.length - 1) yield { metadata: { systemStatus: "Logic path obstructed. Rerouting...", isRerouting: true } };
        }
    }

    // FALLBACK
    if (!hasYielded) {
         if (attempts === 0) {
             yield { text: `> **LOGIC CORE OFFLINE**: No cryptographic keys detected in vault (.env).` };
        } else {
             yield { text: `> **SYSTEM MALFUNCTION**: Critical failure in reasoning engine. All nodes unresponsive.` };
        }
    }
  }

  private updateHistory(user: string, assistant: string) {
    this.history.push({ role: 'user', parts: [{ text: user }] }, { role: 'model', parts: [{ text: assistant }] });
    if (this.history.length > 40) this.history = this.history.slice(-40);
  }

  // Fix: Accept Note[] | string for contextNotes
  async execute(msg: string, modelId: string, contextNotes?: Note[] | string): Promise<any> {
    const it = this.streamExecute(msg, modelId, contextNotes || []);
    let fullText = "";
    for await (const chunk of it) if (chunk.text) fullText += chunk.text;
    return { text: fullText };
  }
}

export const STOIC_KERNEL = new StoicLogicKernel();
