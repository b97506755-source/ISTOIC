
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import useLocalStorage from '../../../hooks/useLocalStorage';
import { useIDB } from '../../../hooks/useIDB'; 
import { type ChatThread, type ChatMessage, type Note } from '../../../types';
import { MODEL_CATALOG, HANISAH_KERNEL } from '../../../services/melsaKernel';
import { STOIC_KERNEL } from '../../../services/stoicKernel';
import { executeNeuralTool } from '../services/toolHandler';
import { speakWithHanisah } from '../../../services/elevenLabsService';
import { useVault } from '../../../contexts/VaultContext';
import { debugService } from '../../../services/debugService';
import { PollinationsService } from '../../../services/pollinationsService';

export const useChatLogic = (notes: Note[], setNotes: (notes: Note[]) => void) => {
    const [threads, setThreads, isThreadsLoaded] = useIDB<ChatThread[]>('chat_threads', []);
    const [activeThreadId, setActiveThreadId] = useLocalStorage<string | null>('active_thread_id', null);
    const [globalModelId, setGlobalModelId] = useLocalStorage<string>('global_model_preference', 'llama-3.3-70b-versatile');
    const [imageModelId, setImageModelId] = useLocalStorage<string>('image_model_preference', 'hydra');
    
    const { isVaultUnlocked, lockVault, unlockVault, isVaultConfigEnabled } = useVault();
    const [isAutoSpeak, setIsAutoSpeak] = useLocalStorage<boolean>('is_auto_speak', false);
    
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLiveModeActive, setIsLiveModeActive] = useState(false);

    const pendingThreadId = useRef<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const activeThread = useMemo(() => {
        const targetId = activeThreadId || pendingThreadId.current;
        return threads.find(t => t.id === targetId) || null;
    }, [threads, activeThreadId]);

    const activeModel = useMemo(() => {
        const id = activeThread?.model_id || globalModelId;
        return MODEL_CATALOG.find(m => m.id === id) || MODEL_CATALOG[0];
    }, [activeThread, globalModelId]);

    const personaMode = activeThread?.persona || 'stoic';
    const vaultEnabled = isVaultConfigEnabled(personaMode);

    const handleNewChat = useCallback(async (persona: 'hanisah' | 'stoic' = 'stoic') => {
        const welcome = persona === 'hanisah' 
            ? "⚡ **HANISAH V20 ONLINE.**\n\n*Hai sayang, sistem udah di-upgrade nih. Mau ngomongin apa? Atau mau pantun?*" 
            : "🧠 **STOIC V20 TITANIUM.**\n\n*Logic Core V20 Initialized.*\nSistem stabil. Rotasi kunci aktif. Mari bedah realitas dengan logika.";
        
        const newId = uuidv4();
        pendingThreadId.current = newId;

        const newThread: ChatThread = {
            id: newId,
            title: `NEW_SESSION_${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            persona,
            model_id: globalModelId, 
            messages: [{ id: uuidv4(), role: 'model', text: welcome, metadata: { status: 'success', model: 'System' } }],
            updated: new Date().toISOString(),
            isPinned: false
        };
        
        setThreads(prev => [newThread, ...prev]);
        setActiveThreadId(newId);
        return newThread;
    }, [setActiveThreadId, setThreads, globalModelId]);

    const renameThread = useCallback(async (id: string, newTitle: string) => {
        setThreads(prev => prev.map(t => t.id === id ? { ...t, title: newTitle, updated: new Date().toISOString() } : t));
    }, [setThreads]);

    const togglePinThread = useCallback(async (id: string) => {
        setThreads(prev => prev.map(t => t.id === id ? { ...t, isPinned: !t.isPinned } : t));
    }, [setThreads]);

    const stopGeneration = useCallback(() => {
        if (abortControllerRef.current) {
            debugService.log('WARN', 'CHAT', 'ABORT', 'User stopped generation.');
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    }, []);

    const generateWithHydra = async () => {
        if (!input.trim()) { alert("Masukkan deskripsi gambar."); return; }
        const promptText = input.trim();
        setInput(''); 
        
        let targetId = activeThreadId;
        if (!targetId) {
            const newThread = await handleNewChat(personaMode);
            targetId = newThread.id;
        }

        // HARD BLOCK STOIC
        if (personaMode === 'stoic') {
            const modelMsgId = uuidv4();
            setThreads(prev => prev.map(t => t.id === targetId ? {
                ...t,
                messages: [
                    ...t.messages,
                    { id: uuidv4(), role: 'user', text: `Generate Visual: ${promptText}`, metadata: { status: 'success' } },
                    { 
                        id: modelMsgId, 
                        role: 'model', 
                        text: "> 🚫 **ACCESS DENIED: VISUAL MODULE**\n\n_\"The Stoic mind focuses on internal reason, not external illusions.\"_\n\nMy architecture is strictly bound to Logic Processing. I cannot engage the Hydra Visual Engine. Switch to **HANISAH** for creative synthesis.", 
                        metadata: { status: 'error', model: 'SYSTEM_GATEKEEPER', systemStatus: 'PROTOCOL_VIOLATION' } 
                    }
                ],
                updated: new Date().toISOString()
            } : t));
            return;
        }

        const userMsgId = uuidv4();
        const modelMsgId = uuidv4();
        
        setThreads(prev => prev.map(t => t.id === targetId ? { 
            ...t, 
            messages: [
                ...t.messages, 
                { id: userMsgId, role: 'user', text: `🎨 Generate: ${promptText}`, metadata: { status: 'success' } },
                { id: modelMsgId, role: 'model', text: "Initializing Visual Engine...", metadata: { status: 'success' } } 
            ],
            updated: new Date().toISOString()
        } : t));

        try {
            const targetModel = (imageModelId === 'gemini-2.5-flash-image' || imageModelId === 'gemini-3-pro-image-preview') 
                ? 'hydra-smart-route' 
                : imageModelId;

            const result = await PollinationsService.generateHydraImage(promptText, targetModel);
            
            setThreads(prev => prev.map(t => t.id === targetId ? {
                ...t,
                messages: t.messages.map(m => m.id === modelMsgId ? {
                    ...m,
                    text: `Here is your creation based on "${promptText}":\n\n![Generated Image](${result.url})\n\n_Engine: ${result.model.toUpperCase()}_`
                } : m)
            } : t));
        } catch (e) {
            setThreads(prev => prev.map(t => t.id === targetId ? {
                ...t,
                messages: t.messages.map(m => m.id === modelMsgId ? {
                    ...m,
                    text: `⚠️ **GENERATION FAILED**: ${(e as any).message}`
                } : m)
            } : t));
        }
    };

    const sendMessage = async (e?: React.FormEvent, attachment?: { data: string, mimeType: string }) => {
        const userMsg = input.trim();
        if ((!userMsg && !attachment) || isLoading) return;

        let targetThread = activeThread;
        let targetId = activeThreadId;

        // DIAGNOSTIC LOG START
        const transmissionId = uuidv4().slice(0,8);
        console.group(`🧠 NEURAL_LINK_TRANSMISSION: ${transmissionId}`);

        if (!targetId || !targetThread) {
            targetThread = await handleNewChat(personaMode);
            targetId = targetThread.id;
        }

        const userMessageId = uuidv4();
        const modelMessageId = uuidv4();
        const now = new Date().toISOString();

        const newUserMsg: ChatMessage = { 
            id: userMessageId, 
            role: 'user', 
            text: attachment ? (userMsg || "Analyze attachment") : userMsg, 
            metadata: { status: 'success' } 
        };

        const initialModelMsg: ChatMessage = { 
            id: modelMessageId, 
            role: 'model', 
            text: '', 
            metadata: { status: 'success', model: activeModel.name, provider: activeModel.provider } 
        };

        setThreads(prev => prev.map(t => t.id === targetId ? { 
            ...t, 
            messages: [...t.messages, newUserMsg, initialModelMsg],
            updated: now 
        } : t));

        if (targetThread.messages.length <= 1 && userMsg) {
            renameThread(targetId, userMsg.slice(0, 30).toUpperCase());
        }

        setInput('');
        setIsLoading(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;
        const signal = controller.signal;

        try {
            let noteContext = "";
            if (isVaultUnlocked && vaultEnabled) {
                noteContext = `[VAULT_UNLOCKED]\nAvailable Notes: ${notes.slice(0, 50).map(n => `${n.title} [${n.tags?.join(',') || ''}]`).join(' | ')}`;
            }

            const kernel = personaMode === 'hanisah' ? HANISAH_KERNEL : STOIC_KERNEL;
            
            const stream = kernel.streamExecute(
                userMsg || "Proceed with attachment analysis.", 
                activeModel.id, 
                noteContext, 
                attachment,
                { signal } 
            );
            
            let accumulatedText = "";
            let chunkCount = 0;

            for await (const chunk of stream) {
                if (signal.aborted) throw new Error("ABORTED_BY_USER");

                if (chunk.text) {
                    accumulatedText += chunk.text;
                    chunkCount++;
                }

                if (chunk.functionCall) {
                    const toolName = chunk.functionCall.name;
                    if (personaMode === 'stoic' && toolName === 'generate_visual') {
                        accumulatedText += `\n\n> 🚫 **VISUAL REQUEST BLOCKED**: Logic Core cannot process imagery.`;
                        continue;
                    }

                    accumulatedText += `\n\n> ⚙️ **EXECUTING:** ${toolName.replace(/_/g, ' ').toUpperCase()}...\n`;
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

                setThreads(prev => prev.map(t => t.id === targetId ? {
                    ...t,
                    messages: t.messages.map(m => m.id === modelMessageId ? {
                        ...m,
                        text: accumulatedText,
                        metadata: { 
                            ...m.metadata, 
                            ...(chunk.metadata || {}),
                            groundingChunks: chunk.groundingChunks || m.metadata?.groundingChunks 
                        }
                    } : m)
                } : t));
            }

            if (!accumulatedText.trim() && chunkCount === 0) {
                accumulatedText = personaMode === 'hanisah' 
                    ? "_ (tersenyum) _\n\n*Hmm, aku blank bentar. Coba tanya lagi?*" 
                    : "> **NULL OUTPUT DETECTED**\n\nThe logic stream yielded no data. Refine parameters.";
                
                setThreads(prev => prev.map(t => t.id === targetId ? {
                    ...t,
                    messages: t.messages.map(m => m.id === modelMessageId ? { ...m, text: accumulatedText } : m)
                } : t));
            }

            if (isAutoSpeak && accumulatedText) {
                speakWithHanisah(accumulatedText.replace(/[*#_`]/g, ''), personaMode === 'hanisah' ? 'Hanisah' : 'Fenrir');
            }

        } catch (err: any) {
            console.error(`[${transmissionId}] ERROR:`, err);
            let errorText = "";
            let status: 'error' | 'success' = 'success'; // V20: TREAT ERROR AS SUCCESS TEXT

            if (err.message === "ABORTED_BY_USER" || err.name === "AbortError") {
                errorText = `\n\n> 🛑 **INTERRUPTED**`;
            } else {
                // V20 NATURAL ERROR HANDLING - NO BUBBLES
                errorText = personaMode === 'hanisah' 
                    ? `\n\n_ (Menggaruk kepala) _\n*Aduh, maaf banget sayang. Sinyalnya lagi ngajak berantem nih. Kamu bisa ulangin lagi nggak?*` 
                    : `\n\n> **SYSTEM ANOMALY DETECTED**\n\nThe processing stream encountered an external disconnect. This is likely a transient network variable. Please re-state the query.`;
            }

            setThreads(prev => prev.map(t => t.id === targetId ? { 
                ...t, 
                messages: t.messages.map(m => m.id === modelMessageId ? {
                    ...m, 
                    // Safely handle potential Blob type by defaulting to empty string if not string
                    text: (typeof m.text === 'string' ? m.text : '') + errorText,
                    metadata: { ...m.metadata, status: status }
                } : m)
            } : t));
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
            console.groupEnd();
        }
    };

    return {
        threads, setThreads, activeThread, activeThreadId, setActiveThreadId,
        isVaultSynced: isVaultUnlocked, setIsVaultSynced: (val: boolean) => val ? unlockVault() : lockVault(),
        isVaultConfigEnabled: vaultEnabled, isAutoSpeak, setIsAutoSpeak, isLiveModeActive, setIsLiveModeActive,
        input, setInput, isLoading, activeModel, setGlobalModelId, personaMode,
        handleNewChat, renameThread, togglePinThread, sendMessage, stopGeneration,
        generateWithPollinations: generateWithHydra, imageModelId, setImageModelId
    };
};
