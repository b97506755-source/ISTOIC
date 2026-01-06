
import { GLOBAL_VAULT, type Provider } from './hydraVault';
import { debugService } from './debugService';
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export interface StreamChunk {
  text?: string;
  functionCall?: any;
  groundingChunks?: any[];
  metadata?: any;
}

/**
 * OMNI RACE KERNEL
 * Executes requests against multiple providers simultaneously.
 * The first provider to emit a text chunk WINS.
 * Losers are aborted immediately.
 */
export class OmniRaceKernel {
  private readonly TIMEOUT_MS = 45_000; // 45s Hard Limit

  // Model Mapping for Race
  private readonly RACE_CONFIG: Record<string, { provider: Provider, model: string }> = {
    'GOOGLE': { provider: 'GEMINI', model: 'gemini-2.0-flash-exp' },
    'GROQ_70B': { provider: 'GROQ', model: 'llama-3.3-70b-versatile' },
    'GROQ_8B': { provider: 'GROQ', model: 'llama-3.1-8b-instant' },
    'OPENAI_MINI': { provider: 'OPENAI', model: 'gpt-4o-mini' },
    'DEEPSEEK': { provider: 'DEEPSEEK', model: 'deepseek-chat' }
  };

  /**
   * Triggers the "Winner-Takes-All" STREAMING execution.
   */
  public async *raceStream(
    prompt: string, 
    systemInstruction?: string,
    context?: string
  ): AsyncGenerator<StreamChunk> {
    
    debugService.log('INFO', 'OMNI_RACE', 'START', 'Initializing parallel execution protocol...');

    const controller = new AbortController();
    const signal = controller.signal;
    const fullPrompt = context ? `${systemInstruction}\n\n[CONTEXT]\n${context}\n\n[USER]\n${prompt}` : prompt;

    // We use a Promise to bridge the gap between "First Response" and "Generator Yielding"
    // This promise resolves with the ASYNC ITERATOR of the winner.
    const racePromise = new Promise<AsyncGenerator<StreamChunk>>((resolve, reject) => {
        let winnerDeclared = false;
        let failureCount = 0;
        const racerCount = Object.keys(this.RACE_CONFIG).length;

        Object.entries(this.RACE_CONFIG).forEach(([name, config]) => {
            this.executeProviderStream(name, config.provider, config.model, fullPrompt, signal, systemInstruction)
                .then(iterator => {
                    if (!winnerDeclared) {
                        winnerDeclared = true;
                        debugService.log('INFO', 'OMNI_RACE', 'WINNER', `🏆 ${name} won the race.`);
                        resolve(iterator);
                        // We do NOT abort here yet, we abort after we confirm the stream is readable
                    }
                })
                .catch(err => {
                    failureCount++;
                    debugService.log('WARN', 'OMNI_RACE', 'FAIL', `${name} dropped out: ${err.message}`);
                    if (failureCount >= racerCount && !winnerDeclared) {
                        reject(new Error("ALL_ENGINES_FAILED"));
                    }
                });
        });

        // Hard Timeout
        setTimeout(() => {
            if (!winnerDeclared) {
                reject(new Error("OMNI_RACE_TIMEOUT"));
                controller.abort();
            }
        }, this.TIMEOUT_MS);
    });

    try {
        const winnerIterator = await racePromise;
        
        // Yield from the winner
        for await (const chunk of winnerIterator) {
            yield chunk;
        }
        
        // Once stream finishes (or if we break), abort others to be safe
        controller.abort();

    } catch (error: any) {
        debugService.log('ERROR', 'OMNI_RACE', 'CRITICAL', error.message);
        yield { text: `\n\n> ⚠️ **Omni-Race Failed**: All cognitive nodes rejected the request.` };
    }
  }

  /**
   * Individual execution wrapper.
   * Resolves immediately when the FIRST CHUNK is received (TTFT).
   * Returns an iterator that continues yielding the rest.
   */
  private async executeProviderStream(
    racerName: string,
    provider: Provider,
    modelId: string,
    prompt: string,
    signal: AbortSignal,
    systemInstruction?: string
  ): Promise<AsyncGenerator<StreamChunk>> {
    
    const key = GLOBAL_VAULT.getKey(provider);
    if (!key) throw new Error("NO_KEY");

    // 1. GEMINI IMPLEMENTATION
    if (provider === 'GEMINI') {
        const ai = new GoogleGenAI({ apiKey: key });
        // Correctly handle streaming response for Gemini
        const streamResult = await ai.models.generateContentStream({
            model: modelId,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { systemInstruction }
        }).catch(e => {
            GLOBAL_VAULT.reportFailure(provider, key, e);
            throw e;
        });

        // Return a generator that wraps the Gemini stream
        async function* geminiGenerator() {
            try {
                // Correctly iterate directly over streamResult as an async iterator
                for await (const chunk of streamResult) {
                    if (signal.aborted) break;
                    // Access text property directly (do not call as a function)
                    const text = chunk.text;
                    if (text) yield { text };
                }
            } catch (e) {
                GLOBAL_VAULT.reportFailure(provider, key, e);
            }
        }
        return geminiGenerator();
    }

    // 2. OPENAI COMPATIBLE IMPLEMENTATION (Groq, DeepSeek, OpenAI)
    const baseURLMap: Record<string, string> = {
        'GROQ': 'https://api.groq.com/openai/v1',
        'OPENAI': 'https://api.openai.com/v1',
        'DEEPSEEK': 'https://api.deepseek.com',
        'MISTRAL': 'https://api.mistral.ai/v1'
    };

    const client = new OpenAI({
        baseURL: baseURLMap[provider],
        apiKey: key,
        dangerouslyAllowBrowser: true
    });

    const stream = await client.chat.completions.create({
        model: modelId,
        messages: [
            { role: "system", content: systemInstruction || "You are a helpful assistant." },
            { role: "user", content: prompt }
        ],
        stream: true,
    }, { signal }).catch(e => {
        GLOBAL_VAULT.reportFailure(provider, key, e);
        throw e;
    });

    // Return a generator wrapping the OpenAI stream
    async function* openaiGenerator() {
        try {
            for await (const chunk of stream) {
                if (signal.aborted) break;
                const text = chunk.choices[0]?.delta?.content || '';
                if (text) yield { text };
            }
        } catch (e) {
            GLOBAL_VAULT.reportFailure(provider, key, e);
        }
    }

    return openaiGenerator();
  }
}

export const OMNI_KERNEL = new OmniRaceKernel();
