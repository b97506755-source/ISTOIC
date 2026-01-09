
import { NextResponse } from 'next/server';

// --- CONFIGURATION ---
// Gunakan Edge Runtime untuk kecepatan maksimal (Cold start ~0ms)
export const config = {
  runtime: 'edge',
};

// --- TYPES ---
interface RacerMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface StreamPayload {
  text: string;
  provider?: string;
  keyId?: string; // ID mask untuk debug key mana yang dipakai
}

// --- UTILS: SMART KEY ROTATOR ---
/**
 * Mengambil satu key secara acak dari daftar key yang dipisah koma.
 * Contoh Env: "sk-123, sk-456, sk-789" -> Output: "sk-456" (Random)
 */
function getRandomKey(envVarName: string): string | null {
  const rawValue = process.env[envVarName];
  if (!rawValue) return null;

  // Split koma, hapus spasi, hapus entry kosong
  const keys = rawValue.split(',').map(k => k.trim()).filter(k => k.length > 0);
  
  if (keys.length === 0) return null;

  // Pilih acak
  const randomIndex = Math.floor(Math.random() * keys.length);
  return keys[randomIndex];
}

// --- HELPER: Promise.any Polyfill for Older Edge Runtimes ---
function raceToSuccess<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let rejectionCount = 0;
    if (promises.length === 0) reject(new Error("No racers"));
    
    for (const p of promises) {
      p.then(resolve, () => {
        rejectionCount++;
        if (rejectionCount === promises.length) {
            reject(new Error("All racers failed"));
        }
      });
    }
  });
}

// --- MAIN HANDLER ---
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { prompt, system, context } = await req.json();
    
    if (!prompt) {
      return new Response('Missing prompt', { status: 400 });
    }

    // Contextual Prompt Construction
    const systemPrompt = system || "You are a helpful, secure AI assistant.";
    const fullSystemContent = context 
      ? `${systemPrompt}\n\n[CURRENT CONTEXT]:\n${context}` 
      : systemPrompt;

    const messages: RacerMessage[] = [
      { role: 'system', content: fullSystemContent },
      { role: 'user', content: prompt }
    ];

    // --- PREPARE RACERS (Load Balanced Engines) ---
    const controllers: AbortController[] = [];
    const racers: Promise<{ stream: ReadableStream, provider: string, keyMask: string }>[] = [];
    
    // 1. GROQ (Llama 3.3) - Speed King
    const groqKey = getRandomKey('GROQ_API_KEY');
    if (groqKey) {
      const c = new AbortController();
      controllers.push(c);
      racers.push(
        fetchOpenAICompatible(
          'GROQ', 
          'https://api.groq.com/openai/v1/chat/completions', 
          groqKey, 
          'llama-3.3-70b-versatile', 
          messages, 
          c.signal
        )
      );
    }

    // 2. GOOGLE GEMINI - Smart & Contextual
    const geminiKey = getRandomKey('GEMINI_API_KEY');
    if (geminiKey) {
      const c = new AbortController();
      controllers.push(c);
      racers.push(
        fetchGemini(
          'GEMINI',
          geminiKey,
          'gemini-2.0-flash-exp', // Model 2.0 Flash (Experimental)
          messages,
          c.signal
        )
      );
    }

    // 3. OPENAI - Reliable Fallback
    const openaiKey = getRandomKey('OPENAI_API_KEY');
    if (openaiKey) {
      const c = new AbortController();
      controllers.push(c);
      racers.push(
        fetchOpenAICompatible(
          'OPENAI', 
          'https://api.openai.com/v1/chat/completions', 
          openaiKey, 
          'gpt-4o-mini', 
          messages, 
          c.signal
        )
      );
    }

    // 4. DEEPSEEK - Coding Expert
    const deepseekKey = getRandomKey('DEEPSEEK_API_KEY');
    if (deepseekKey) {
      const c = new AbortController();
      controllers.push(c);
      racers.push(
        fetchOpenAICompatible(
          'DEEPSEEK', 
          'https://api.deepseek.com/chat/completions', 
          deepseekKey, 
          'deepseek-chat', 
          messages, 
          c.signal
        )
      );
    }

    // CHECK: Any Drivers?
    if (racers.length === 0) {
      return new Response(
        JSON.stringify({ text: "⚠️ SERVER ERROR: No valid API Keys found in Environment." }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- THE RACE (Winner Takes All) ---
    // Promise.any takes the first SUCCESSFUL response
    const winner = await raceToSuccess(racers);

    // KILL LOSERS: Biarkan GC atau timeout menangani yang kalah, 
    // tapi kita bisa abort manual jika controller dipetakan.
    // Di Edge runtime, membiarkan promise menggantung sebentar tidak masalah fatal.

    // --- STREAM RESPONSE ---
    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        const reader = winner.stream.getReader();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Decode raw text chunk dari helper
            const chunkText = new TextDecoder().decode(value);
            
            if (chunkText) {
                // Bungkus jadi JSON event agar client OmniRaceKernel bisa baca
                const payload: StreamPayload = { 
                    text: chunkText, 
                    provider: winner.provider,
                    keyId: winner.keyMask // Optional: kirim 4 digit terakhir key yg menang
                };
                controller.enqueue(encoder.encode(JSON.stringify(payload)));
            }
          }
        } catch (err) {
          console.error("Stream Transmission Error:", err);
          controller.enqueue(encoder.encode(JSON.stringify({ text: "\n[Connection Interrupted]", error: true })));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Winner-Provider': winner.provider,
        'X-Key-Mask': winner.keyMask
      }
    });

  } catch (error) {
    console.error("OMNI-RACE FATAL:", error);
    return new Response(
      JSON.stringify({ text: "⚠️ All AI Nodes Failed (Rate Limit or Timeout)." }), 
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// --- HELPER 1: OpenAI Compatible Fetcher ---
async function fetchOpenAICompatible(
  providerName: string,
  url: string,
  key: string,
  model: string,
  messages: RacerMessage[],
  signal: AbortSignal
): Promise<{ stream: ReadableStream, provider: string, keyMask: string }> {
  
  // Masking Key ID (ambil 4 karakter terakhir untuk debug)
  const keyMask = key.slice(-4);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1500, 
    }),
    signal: signal
  });

  if (!res.ok) throw new Error(`${providerName} (${keyMask}) Error: ${res.status}`);
  if (!res.body) throw new Error(`${providerName} No Body`);

  // Transform Stream: SSE -> Raw Text
  const rawStream = res.body;
  const transformedStream = new ReadableStream({
    async start(controller) {
      const reader = rawStream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (trimmed.startsWith('data: ')) {
              try {
                const json = JSON.parse(trimmed.replace('data: ', ''));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(new TextEncoder().encode(content));
                }
              } catch (e) { /* ignore chunk error */ }
            }
          }
        }
      } catch (e) {
        controller.error(e);
      } finally {
        controller.close();
      }
    }
  });

  return { stream: transformedStream, provider: providerName, keyMask };
}

// --- HELPER 2: Google Gemini Fetcher ---
async function fetchGemini(
  providerName: string,
  key: string,
  model: string,
  messages: RacerMessage[],
  signal: AbortSignal
): Promise<{ stream: ReadableStream, provider: string, keyMask: string }> {
  
  const keyMask = key.slice(-4);
  
  // Format messages
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${key}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
    signal: signal
  });

  if (!res.ok) throw new Error(`${providerName} (${keyMask}) Error: ${res.status}`);
  if (!res.body) throw new Error(`${providerName} No Body`);

  const rawStream = res.body;
  const transformedStream = new ReadableStream({
    async start(controller) {
      const reader = rawStream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          // Regex robust untuk ambil teks Gemini
          const matches = buffer.matchAll(/"text":\s*"((?:[^"\\]|\\.)*)"/g);
          for (const match of matches) {
             let text = match[1];
             text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"');
             if (text) {
                 controller.enqueue(new TextEncoder().encode(text));
             }
          }
          if (buffer.length > 15000) buffer = ''; 
        }
      } catch (e) {
        controller.error(e);
      } finally {
        controller.close();
      }
    }
  });

  return { stream: transformedStream, provider: providerName, keyMask };
}
