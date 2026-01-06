
import { ModelMetadata } from "../types";

export const FREE_TIER_MODELS: ModelMetadata[] = [
    // --- GOOGLE (Free Tier via AI Studio) ---
    {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        category: 'GEMINI_2_5',
        provider: 'GEMINI',
        description: 'Fast, cost-effective, 1M context window.',
        specs: { context: '1M', contextLimit: 1000000, speed: 'INSTANT', intelligence: 9.0 }
    },
    {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        category: 'GEMINI_2_5',
        provider: 'GEMINI',
        description: 'Balanced reasoning with massive context.',
        specs: { context: '2M', contextLimit: 2000000, speed: 'FAST', intelligence: 9.5 }
    },

    // --- OPENAI (Free/Cheap Tier) ---
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        category: 'OPEN_ROUTER_ELITE',
        provider: 'OPENAI',
        description: 'Efficient, low-cost small model.',
        specs: { context: '128K', contextLimit: 128000, speed: 'INSTANT', intelligence: 8.8 }
    },
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        category: 'OPEN_ROUTER_ELITE',
        provider: 'OPENAI',
        description: 'Flagship omni-model.',
        specs: { context: '128K', contextLimit: 128000, speed: 'FAST', intelligence: 9.8 }
    },

    // --- GROQ (LPU Inference) ---
    {
        id: 'llama3-8b-8192',
        name: 'Llama 3 8B',
        category: 'GROQ_VELOCITY',
        provider: 'GROQ',
        description: 'Extremely fast Llama 3 via Groq LPU.',
        specs: { context: '8K', contextLimit: 8192, speed: 'INSTANT', intelligence: 8.5 }
    },
    {
        id: 'llama3-70b-8192',
        name: 'Llama 3 70B',
        category: 'GROQ_VELOCITY',
        provider: 'GROQ',
        description: 'High intelligence open model on LPU.',
        specs: { context: '8K', contextLimit: 8192, speed: 'FAST', intelligence: 9.2 }
    },
    {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        category: 'GROQ_VELOCITY',
        provider: 'GROQ',
        description: 'Mixture of Experts model.',
        specs: { context: '32K', contextLimit: 32768, speed: 'FAST', intelligence: 9.0 }
    },
    {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B',
        category: 'GROQ_VELOCITY',
        provider: 'GROQ',
        description: 'Google open weights model.',
        specs: { context: '8K', contextLimit: 8192, speed: 'INSTANT', intelligence: 8.7 }
    },

    // --- DEEPSEEK ---
    {
        id: 'deepseek-chat',
        name: 'DeepSeek V3',
        category: 'DEEPSEEK_OFFICIAL',
        provider: 'DEEPSEEK',
        description: 'Efficient coding and chat model.',
        specs: { context: '64K', contextLimit: 64000, speed: 'FAST', intelligence: 9.6 }
    },
    {
        id: 'deepseek-reasoner',
        name: 'DeepSeek R1',
        category: 'DEEPSEEK_OFFICIAL',
        provider: 'DEEPSEEK',
        description: 'Advanced reasoning and logic (CoT).',
        specs: { context: '64K', contextLimit: 64000, speed: 'THINKING', intelligence: 9.9 }
    }
];
