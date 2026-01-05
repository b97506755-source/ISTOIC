
import { GoogleGenAI } from "@google/genai";
import { noteTools, searchTools, universalTools, KEY_MANAGER } from "./geminiService";
import { debugService } from "./debugService";
import { MODEL_CATALOG, type StreamChunk } from "./melsaKernel";
import { HANISAH_BRAIN } from "./melsaBrain";
import { streamOpenAICompatible } from "./providerEngine";
import { GLOBAL_VAULT, Provider } from "./hydraVault";

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

class StoicLogicKernel {
  private history: any[] = [];

  private buildContext(history: any[], currentMsg: string, systemPrompt: string, limit: number): any[] {
      const SAFETY_BUFFER = 2000;
      const maxInputTokens = Math.max(2000, limit - SAFETY_BUFFER);
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

  async *streamExecute(msg: string, modelId: string, context?: string, attachment?: any, configOverride?: any): AsyncGenerator<StreamChunk> {
    const systemPrompt = HANISAH_BRAIN.getSystemInstruction('stoic', context);
    const signal = configOverride?.signal; 
    let effectiveId = modelId === 'auto-best' ? 'gemini-3-flash-preview' : modelId;

    // V20 FAILOVER PLAN
    const plan = [effectiveId, 'gemini-3-flash-preview', 'llama-3.3-70b-versatile', 'gemini-3-pro-preview'];
    const uniquePlan = [...new Set(plan)];

    for (let i = 0; i < uniquePlan.length; i++) {
        if (signal?.aborted) break;
        const currentId = uniquePlan[i];
        const model = MODEL_CATALOG.find(m => m.id === currentId) || MODEL_CATALOG[0];
        
        // V20 Round Robin Key
        const key = GLOBAL_VAULT.getKey(model.provider as Provider);

        if (!key) continue;

        try {
          if (model.provider === 'GEMINI') {
            const ai = new GoogleGenAI({ apiKey: key });
            const contents = [...this.buildContext(this.history, msg, systemPrompt, 32000), { role: 'user', parts: [{ text: msg }] }];
            
            // Stoic V20: Low temperature for maximum logic
            const stream = await ai.models.generateContentStream({ model: model.id, contents, config: { systemInstruction: systemPrompt, temperature: 0.1 } });
            
            let fullText = "";
            let hasStarted = false;
            for await (const chunk of stream) {
              if (signal?.aborted) break;
              if (chunk.text) { fullText += chunk.text; yield { text: chunk.text }; hasStarted = true; }
            }
            if (!hasStarted) throw new Error("Empty");
            this.updateHistory(msg, fullText);
            return;
          } else {
            const stream = streamOpenAICompatible(model.provider as any, model.id, [{ role: 'user', content: msg }], systemPrompt, [], signal);
            let fullText = "";
            let hasStarted = false;
            for await (const chunk of stream) {
                if (signal?.aborted) break;
                if (chunk.text) { fullText += chunk.text; yield { text: chunk.text }; hasStarted = true; }
            }
            if (!hasStarted) throw new Error("Empty");
            this.updateHistory(msg, fullText);
            return;
          }
        } catch (err: any) {
            GLOBAL_VAULT.reportFailure(model.provider as Provider, key, err);
            
            if (i < uniquePlan.length - 1) {
                yield { metadata: { systemStatus: `Logic path obstructed. Rerouting to node ${uniquePlan[i+1]}...`, isRerouting: true } };
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            
            // Natural Error for Stoic
            const stoicError = "The external variables (Network/API) are currently outside my control. I am pausing execution to maintain system integrity. Please retry.";
            yield { text: stoicError };
            this.updateHistory(msg, stoicError);
            return;
        }
    }
  }

  async execute(msg: string, modelId: string, context?: string): Promise<any> {
    const it = this.streamExecute(msg, modelId, context);
    let fullText = "";
    for await (const chunk of it) { if (chunk.text) fullText += chunk.text; }
    return { text: fullText };
  }

  private updateHistory(user: string, assistant: string) {
    this.history.push({ role: 'user', parts: [{ text: user }] }, { role: 'model', parts: [{ text: assistant }] });
    if (this.history.length > 40) this.history = this.history.slice(-40);
  }

  reset() { this.history = []; }
}

export const STOIC_KERNEL = new StoicLogicKernel();
