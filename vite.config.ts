
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load local .env
    const env = loadEnv(mode, '.', '');
    
    // Explicit list for Hydra Multi-Link Engine & Security
    const keyPatterns = [
        'GEMINI', 'GROQ', 'DEEPSEEK', 'OPENAI', 
        'XAI', 'MISTRAL', 'OPENROUTER', 'ELEVENLABS', 
        'API_KEY', 'VAULT_PIN_HASH', 'GOOGLE',
        'HF_TOKEN', 'METERED'
    ];

    const processEnv: Record<string, string> = {};
    
    // Check local env file AND system environment (Vercel)
    const allSources = { ...process.env, ...env };

    Object.keys(allSources).forEach(key => {
        if (key.startsWith('VITE_') || keyPatterns.some(p => key.includes(p))) {
            processEnv[key] = allSources[key] as string;
        }
    });

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Injects gathered vars into global browser context
        'process.env': JSON.stringify(processEnv)
      },
      resolve: {
        alias: {
          '@': path.resolve('.'),
        }
      },
      build: {
        outDir: 'dist',
        sourcemap: false,
        minify: 'esbuild'
      }
    };
});
