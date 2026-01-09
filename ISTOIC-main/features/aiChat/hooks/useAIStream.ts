
import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { STOIC_KERNEL as SK } from '../../../services/stoicKernel';
import { MODEL_CATALOG, HANISAH_KERNEL as HK } from '../../../services/melsaKernel';
import { executeNeuralTool } from '../services/toolHandler';
import { speakWithHanisah } from '../../../services/elevenLabsService';
import { debugService } from '../../../services/debugService';
import { Note, ChatThread } from '../../../types';

interface AIStreamProps {
    notes: Note[];
    setNotes: (notes: Note[]) => void;
    activeThread: ChatThread | null;
    storage: any; // Typed as return of useChatStorage
    isVaultUnlocked: boolean;
    vaultEnabled: boolean;
    isAutoSpeak: boolean;
    imageModelId: string;
}

export const useAIStream = ({
    notes,
    setNotes,
    activeThread,
    storage,
    isVaultUnlocked,
    vaultEnabled,
    isAutoSpeak,
    imageModelId
}: AIStreamProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const stopGeneration = useCallback(() => {
        if (abortControllerRef.current) {
            debugService.log('WARN', 'CHAT', 'ABORT', 'User stopped generation.');
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    }, []);

    const streamMessage = useCallback(async (
        userMsg: string, 
        activeModel: any,
        targetThreadId: string,
        targetPersona: 'hanisah' | 'stoic',
        attachment?: { data: string, mimeType: string }
    ) => {
        setIsLoading(true);
        const modelMessageId = uuidv4();
        const transmissionId = uuidv4().slice(0,8);
        
        console.group(`🧠 NEURAL_LINK_TRANSMISSION: ${transmissionId}`);

        // 1. Create Placeholder for AI Response using STORAGE (Safe Update)
        storage.addMessage(targetThreadId, { 
            id: modelMessageId, 
            role: 'model', 
            text: '', 
            metadata: { status: 'success', model: activeModel.name, provider: activeModel.provider } 
        });

        const controller = new AbortController();
        abortControllerRef.current = controller;
        const signal = controller.signal;

        // Define variables OUTSIDE try block so they are accessible in catch
        let accumulatedText = "";
        let chunkCount = 0;

        try {
            const kernel = targetPersona === 'hanisah' ? HK : SK;
            
            // Pass original 'notes' array
            const stream = kernel.streamExecute(
                userMsg || "Proceed with attachment analysis.", 
                activeModel.id, 
                notes, 
                attachment,
                { signal } 
            );
            
            for await (const chunk of stream) {
                if (signal.aborted) throw new Error("ABORTED_BY_USER");

                if (chunk.text) {
                    accumulatedText += chunk.text;
                    chunkCount++;
                }

                if (chunk.functionCall) {
                    const toolName = chunk.functionCall.name;
                    accumulatedText += `\n\n> ⚙️ **EXECUTING:** ${toolName.replace(/_/g, ' ').toUpperCase()}...\n`;
                    
                    // Update UI with progress via STORAGE
                    storage.updateMessage(targetThreadId, modelMessageId, { text: accumulatedText });

                    try {
                        const toolResult = await executeNeuralTool(chunk.functionCall, notes, setNotes, imageModelId);
                         if (toolResult.includes('![Generated Visual]') || toolResult.trim().startsWith('![')) {
                             accumulatedText += `\n\n${toolResult}\n\n`;
                        } else {
                             accumulatedText += `> ✅ **RESULT:** ${toolResult}\n\n`;
                        }
                    } catch (toolError: any) {
                        accumulatedText += `> ❌ **FAIL:** ${toolError.message}\n\n`;
                    }
                    chunkCount++;
                }

                // Stream Update via STORAGE (Prevents race conditions with user message)
                storage.updateMessage(targetThreadId, modelMessageId, { 
                    text: accumulatedText,
                    metadata: { 
                        // We need to merge metadata carefully
                        ...(chunk.metadata || {}),
                        groundingChunks: chunk.groundingChunks
                    }
                });
            }

            // Fallback for empty response
            if (!accumulatedText.trim() && chunkCount === 0) {
                accumulatedText = targetPersona === 'hanisah' 
                    ? "_ (tersenyum) _\n\n*Hmm, aku blank bentar. Coba tanya lagi?*" 
                    : "> **NULL OUTPUT DETECTED**\n\nThe logic stream yielded no data. Refine parameters.";
                storage.updateMessage(targetThreadId, modelMessageId, { text: accumulatedText });
            }

            // TTS Trigger
            if (isAutoSpeak && accumulatedText) {
                speakWithHanisah(accumulatedText.replace(/[*#_`]/g, ''), targetPersona === 'hanisah' ? 'Hanisah' : 'Fenrir');
            }

        } catch (err: any) {
             console.error(`[${transmissionId}] ERROR:`, err);
             let errorText = "";
             let status: 'error' | 'success' = 'success';
             
             if (err.message === "ABORTED_BY_USER" || err.name === "AbortError") {
                errorText = `\n\n> 🛑 **INTERRUPTED**`;
             } else {
                 status = 'error';
                 errorText = targetPersona === 'hanisah' 
                    ? `\n\n_ (Menggaruk kepala) _\n*Aduh, maaf banget sayang. Sinyalnya lagi ngajak berantem nih.*` 
                    : `\n\n> **SYSTEM ANOMALY DETECTED**\n\nProcessing stream interrupted.`;
             }
             
             // Append error to whatever text we got
             storage.updateMessage(targetThreadId, modelMessageId, { 
                 text: accumulatedText + errorText, 
                 metadata: { status: status } 
             });
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
            console.groupEnd();
        }
    }, [notes, isVaultUnlocked, vaultEnabled, isAutoSpeak, setNotes, storage, imageModelId]);

    return {
        isLoading,
        stopGeneration,
        streamMessage
    };
};
