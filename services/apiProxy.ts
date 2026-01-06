import { z } from 'zod';
import { debugService } from './debugService';

/**
 * IStoicAI v0.50 ENTERPRISE PROXY
 * 
 * In a production Vercel/Node environment, this file would fetch() 
 * your backend endpoints (e.g., /api/v1/generate).
 * 
 * For this PWA implementation, we simulate the "Zero Trust" boundary 
 * by validating inputs/outputs strictly before passing to the legacy handlers.
 * 
 * ARCHITECTURAL RULE:
 * UI Components MUST NOT import `google-genai` or `openai` directly.
 * They must use `ApiProxy.generate()`.
 */

// 1. Zod Schema Definitions (Runtime Type Safety)
export const AIResponseSchema = z.object({
  text: z.string(),
  modelUsed: z.string(),
  tokenCount: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;

export const NoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  content: z.string(),
  tags: z.array(z.string()),
  created: z.string().datetime(),
  updated: z.string().datetime(),
  is_pinned: z.boolean().default(false),
  is_archived: z.boolean().default(false),
  tasks: z.array(z.object({
    id: z.string(),
    text: z.string(),
    isCompleted: z.boolean(),
    dueDate: z.string().optional()
  })).optional()
});

export type ValidatedNote = z.infer<typeof NoteSchema>;

// 2. The Proxy Service
class ApiProxyService {
  
  /**
   * Securely routes a prompt to the configured backend/handler.
   * Enforces Zod schema validation on return.
   */
  async generateText(
    prompt: string, 
    provider: 'GEMINI' | 'OPENAI' | 'GROQ', 
    modelId: string,
    context?: string
  ): Promise<AIResponse> {
    
    debugService.log('INFO', 'PROXY', 'OUTBOUND', `Routing request to ${provider}/${modelId}`);

    // IN PRODUCTION: const res = await fetch('/api/ai/generate', { ... });
    // HERE: We bridge to the existing Kernel for PWA compatibility, but wrapped in safety.
    
    // Dynamic import to keep this file clean and ready for server-migration
    const { HANISAH_KERNEL } = await import('./melsaKernel');
    
    try {
      const stream = HANISAH_KERNEL.streamExecute(prompt, modelId, context);
      
      let fullText = "";
      for await (const chunk of stream) {
        if (chunk.text) fullText += chunk.text;
      }

      const rawResponse = {
        text: fullText,
        modelUsed: modelId,
        metadata: { timestamp: new Date().toISOString() }
      };

      // STRICT VALIDATION
      return AIResponseSchema.parse(rawResponse);

    } catch (error) {
      debugService.log('ERROR', 'PROXY', 'VALIDATION_FAIL', 'AI Output failed integrity check', error);
      throw new Error("Secure Proxy Error: Upstream response invalid or failed.");
    }
  }

  /**
   * Securely validates Note data structure before persistence.
   */
  validateNote(data: unknown): ValidatedNote {
    const result = NoteSchema.safeParse(data);
    if (!result.success) {
      console.error("Data Integrity Error:", result.error);
      throw new Error("CRITICAL: Note data corruption detected by Zero Trust layer.");
    }
    return result.data;
  }
}

export const ApiProxy = new ApiProxyService();