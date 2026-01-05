
import { ModelMetadata } from "../types";

export const FREE_TIER_MODELS: ModelMetadata[] = [
    // --- 1. GOOGLE (Free via AI Studio / Gemini App) ---
    {
        id: 'gemini-1.5-flash-latest',
        name: 'Gemini 1.5 Flash',
        category: 'GEMINI_2_5', // Grouping with efficient models
        provider: 'GEMINI',
        description: 'Free Tier: Ringan, cepat, 1M context window. Hemat biaya.',
        specs: { context: '1M', contextLimit: 1000000, speed: 'INSTANT', intelligence: 9.0 }
    },
    {
        id: 'gemini-1.5-pro-latest',
        name: 'Gemini 1.5 Pro',
        category: 'GEMINI_3', // Grouping with flagship models
        provider: 'GEMINI',
        description: 'Free Tier: Model flagship Google. Reasoning kuat.',
        specs: { context: '2M', contextLimit: 2000000, speed: 'FAST', intelligence: 9.7 }
    },

    // --- 2. OPENAI (Free/Trial via API) ---
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        category: 'OPEN_ROUTER_ELITE', // General compatibility category
        provider: 'OPENAI',
        description: 'Free/Cheap: Model kecil, cepat, dan efisien.',
        specs: { context: '128K', contextLimit: 128000, speed: 'INSTANT', intelligence: 8.5 }
    },
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        category: 'OPEN_ROUTER_ELITE',
        provider: 'OPENAI',
        description: 'Free Tier (Limited): Model flagship omni.',
        specs: { context: '128K', contextLimit: 128000, speed: 'FAST', intelligence: 9.8 }
    },

    // --- 3. GROQ (Free Inference Layer) ---
    {
        id: 'llama3-8b-8192',
        name: 'Llama 3 8B (Groq)',
        category: 'GROQ_VELOCITY',
        provider: 'GROQ',
        description: 'Free on Groq: Kecepatan ekstrem (LPU).',
        specs: { context: '8K', contextLimit: 8192, speed: 'INSTANT', intelligence: 8.0 }
    },
    {
        id: 'llama3-70b-8192',
        name: 'Llama 3 70B (Groq)',
        category: 'GROQ_VELOCITY',
        provider: 'GROQ',
        description: 'Free on Groq: Model open-source powerful.',
        specs: { context: '8K', contextLimit: 8192, speed: 'INSTANT', intelligence: 9.2 }
    },
    {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B (Groq)',
        category: 'GROQ_VELOCITY',
        provider: 'GROQ',
        description: 'Free on Groq: Mixture of Experts (MoE).',
        specs: { context: '32K', contextLimit: 32768, speed: 'FAST', intelligence: 9.0 }
    },
    {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B (Groq)',
        category: 'GROQ_VELOCITY',
        provider: 'GROQ',
        description: 'Free on Groq: Model efisien dari Google.',
        specs: { context: '8K', contextLimit: 8192, speed: 'INSTANT', intelligence: 8.8 }
    },

    // --- 4. DEEPSEEK (Cheap/Free Grant) ---
    {
        id: 'deepseek-chat',
        name: 'DeepSeek V3',
        category: 'DEEPSEEK_OFFICIAL',
        provider: 'DEEPSEEK',
        description: 'Efisien & Powerful. Rival model berbayar.',
        specs: { context: '64K', contextLimit: 64000, speed: 'FAST', intelligence: 9.5 }
    },
    {
        id: 'deepseek-reasoner',
        name: 'DeepSeek R1',
        category: 'DEEPSEEK_OFFICIAL',
        provider: 'DEEPSEEK',
        description: 'Reasoning Model (CoT). Kuat di logika/matematika.',
        specs: { context: '64K', contextLimit: 64000, speed: 'THINKING', intelligence: 9.9 }
    }
];
