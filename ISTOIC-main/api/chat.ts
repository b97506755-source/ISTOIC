import { GoogleGenAI } from "@google/genai";

// Konfigurasi Edge Runtime (Wajib untuk Vercel agar streaming cepat & murah)
export const config = {
  runtime: 'edge',
};

// --- HELPER: ROTASI KEY (LOAD BALANCER) ---
// Memilih kunci API secara acak dari daftar koma-separated di .env untuk menghindari rate limit
function getActiveKey(envVar: string | undefined): string | undefined {
  if (!envVar) return undefined;
  // Hapus spasi, split berdasarkan koma, filter yang kosong
  const keys = envVar.split(',').map(k => k.trim()).filter(k => k.length > 0);
  if (keys.length === 0) return undefined;
  // Ambil kunci acak
  return keys[Math.floor(Math.random() * keys.length)];
}

// --- CONFIGURATION & KEYS ---
// Mengambil kunci segar setiap request
const getKeys = () => ({
  GEMINI: getActiveKey(process.env.GEMINI_API_KEY),
  OPENAI: getActiveKey(process.env.OPENAI_API_KEY),
  GROQ: getActiveKey(process.env.GROQ_API_KEY),
  DEEPSEEK: getActiveKey(process.env.DEEPSEEK_API_KEY),
  MISTRAL: getActiveKey(process.env.MISTRAL_API_KEY),
  OPENROUTER: getActiveKey(process.env.OPENROUTER_API_KEY),
});

// --- MAIN HANDLER (POST) ---
export async function POST(request: Request) {
  try {
    const { message, modelId, provider, context } = await request.json();
    const KEYS = getKeys(); 

    if (!message) return new Response("Message required", { status: 400 });

    // Fallback logic jika provider/model tidak dikirim
    const activeProvider = (provider || 'GEMINI').toUpperCase();
    const activeModel = modelId || getFallbackModel(activeProvider);

    // Gabungkan Context (System Prompt) agar AI ingat instruksi
    const finalPrompt = context ? `${context}\n\nUser: ${message}` : message;

    // --- INTELLIGENT ROUTING ---
    switch (activeProvider) {
      case 'GEMINI':
        return await streamGemini(finalPrompt, activeModel, KEYS.GEMINI);
      
      case 'OPENAI':
        return await streamOpenAICompatible(
          'https://api.openai.com/v1/chat/completions',
          KEYS.OPENAI,
          activeModel,
          finalPrompt
        );

      case 'GROQ':
        return await streamOpenAICompatible(
          'https://api.groq.com/openai/v1/chat/completions',
          KEYS.GROQ,
          activeModel,
          finalPrompt
        );

      case 'DEEPSEEK':
        return await streamOpenAICompatible(
          'https://api.deepseek.com/chat/completions',
          KEYS.DEEPSEEK,
          activeModel,
          finalPrompt
        );
      
      case 'MISTRAL':
        return await streamOpenAICompatible(
          'https://api.mistral.ai/v1/chat/completions',
          KEYS.MISTRAL,
          activeModel,
          finalPrompt
        );

      case 'OPENROUTER':
        return await streamOpenAICompatible(
          'https://openrouter.ai/api/v1/chat/completions',
          KEYS.OPENROUTER,
          activeModel,
          finalPrompt,
          // OpenRouter butuh header tambahan
          { 
            "HTTP-Referer": "https://istoic.app", 
            "X-Title": "IStoic AI" 
          }
        );

      default:
        return new Response(`Provider ${activeProvider} not supported`, { status: 400 });
    }

  } catch (error: any) {
    console.error("[API ERROR]:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown Server Error" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// --- HELPER 1: GEMINI STREAMING (Latest SDK @google/genai) ---
async function streamGemini(prompt: string, modelId: string, apiKey: string | undefined) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing. Check server env.");
  
  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  try {
    const result = await ai.models.generateContentStream({
        model: modelId,
        contents: [{ role: 'user', parts: [{ text: prompt }] }] 
    });

    const stream = new ReadableStream({
        async start(controller) {
        const encoder = new TextEncoder();
        try {
            for await (const chunk of result) {
                const text = chunk.text;
                if (text) controller.enqueue(encoder.encode(text));
            }
            controller.close();
        } catch (e) {
            console.error("Gemini Stream Error:", e);
            controller.error(e);
        }
        },
    });

    return new Response(stream, { 
        headers: { "Content-Type": "text/plain; charset=utf-8" } 
    });

  } catch(e: any) {
      throw new Error(`Gemini Error: ${e.message}`);
  }
}

// --- HELPER 2: OPENAI-COMPATIBLE STREAMING ---
async function streamOpenAICompatible(
  endpoint: string, 
  apiKey: string | undefined, 
  model: string, 
  prompt: string,
  extraHeaders: Record<string, string> = {}
) {
  if (!apiKey) throw new Error(`API Key for ${model} is missing.`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }],
      stream: true,
      temperature: 0.7,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Provider API Error (${response.status}): ${errText}`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      if (!reader) { controller.close(); return; }

      try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === 'data: [DONE]') continue;
              
              if (trimmed.startsWith('data: ')) {
                try {
                  const json = JSON.parse(trimmed.replace('data: ', ''));
                  const content = json.choices?.[0]?.delta?.content || "";
                  if (content) controller.enqueue(encoder.encode(content));
                } catch (e) { }
              }
            }
          }
          controller.close();
      } catch (e) {
          controller.error(e);
      }
    },
  });

  return new Response(stream, { 
      headers: { "Content-Type": "text/plain; charset=utf-8" } 
  });
}

// --- UTILS: FALLBACK MODELS ---
function getFallbackModel(provider: string): string {
  switch (provider) {
    case 'GEMINI': return 'gemini-1.5-flash'; 
    case 'OPENAI': return 'gpt-4o-mini';
    case 'GROQ': return 'llama-3.3-70b-versatile';
    case 'DEEPSEEK': return 'deepseek-chat';
    case 'MISTRAL': return 'mistral-medium';
    default: return 'gpt-3.5-turbo';
  }
}
