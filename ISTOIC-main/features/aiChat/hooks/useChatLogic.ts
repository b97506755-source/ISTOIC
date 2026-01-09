import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import useLocalStorage from '../../../hooks/useLocalStorage';
import { type ChatThread, type ChatMessage, type Note } from '../../../types';
import { MODEL_CATALOG } from '../../../services/melsaKernel';
import { useVault } from '../../../contexts/VaultContext';
import { debugService } from '../../../services/debugService';
import { PollinationsService } from '../../../services/pollinationsService';
import { MemoryService } from '../../../services/memoryService';
import { useChatStorage } from '../../../hooks/useChatStorage'; 
import { useAIStream } from './useAIStream';

/**
 * ENHANCED CHAT LOGIC HOOK v2.0
 * Fokus: Stabilitas State, Optimistic UI Update, dan Integrasi Deep Memory.
 */
export const useChatLogic = (notes: Note[], setNotes: (notes: Note[]) => void) => {
    // --- 1. CORE STORAGE & STATE ---
    const storage = useChatStorage();
    const { 
        threads, setThreads, activeThreadId, setActiveThreadId,
        createThread, addMessage, renameThread, isThreadsLoaded, updateMessage 
    } = storage;

    // --- 2. PREFERENCES ---
    const [globalModelId, setGlobalModelId] = useLocalStorage<string>('global_model_preference', 'llama-3.3-70b-versatile');
    const [imageModelId, setImageModelId] = useLocalStorage<string>('image_model_preference', 'hydra');
    const [isAutoSpeak, setIsAutoSpeak] = useLocalStorage<boolean>('is_auto_speak', false);
    
    // --- 3. CONTEXTS ---
    const { isVaultUnlocked, lockVault, unlockVault, isVaultConfigEnabled } = useVault();
    const [input, setInput] = useState('');
    const [isLiveModeActive, setIsLiveModeActive] = useState(false);

    // --- 4. REFS (Untuk memutus ketergantungan render cycle pada proses async) ---
    // Menyimpan ID thread yang baru saja dibuat sebelum state React selesai sinkronisasi
    const pendingThreadId = useRef<string | null>(null);
    const activeThreadIdRef = useRef<string | null>(activeThreadId);
    
    // Sinkronisasi Ref dengan State
    useEffect(() => { 
        activeThreadIdRef.current = activeThreadId; 
    }, [activeThreadId]);

    // Refs untuk Memory Core agar tidak stale saat dipanggil di background
    const notesRef = useRef(notes);
    useEffect(() => { notesRef.current = notes; }, [notes]);

    // --- 5. RESOLUSI ACTIVE THREAD (Sangat Hati-Hati) ---
    const activeThread = useMemo(() => {
        // Prioritas 1: Cari berdasarkan ID aktif di storage
        let thread = threads.find(t => t.id === activeThreadId);
        
        // Prioritas 2: Jika state belum update, cari berdasarkan pending ID (untuk chat baru)
        if (!thread && pendingThreadId.current) {
            thread = threads.find(t => t.id === pendingThreadId.current);
        }
        
        return thread || null;
    }, [threads, activeThreadId]);

    const activeModel = useMemo(() => {
        const id = activeThread?.model_id || globalModelId;
        return MODEL_CATALOG.find(m => m.id === id) || MODEL_CATALOG[0];
    }, [activeThread, globalModelId]);

    const personaMode = activeThread?.persona || 'stoic';
    const vaultEnabled = isVaultConfigEnabled(personaMode);

    // --- 6. AI STREAM ENGINE ---
    const { isLoading, stopGeneration, streamMessage } = useAIStream({
        notes,
        setNotes,
        activeThread,
        storage,
        isVaultUnlocked,
        vaultEnabled,
        isAutoSpeak,
        imageModelId
    });

    // --- 7. MEMORY CORE OPERATIONS ---
    const triggerMemoryConsolidation = useCallback(() => {
        // Jalankan di background (Fire-and-forget) agar UI tidak blocking
        if (activeThread) {
            MemoryService.summarizeAndStore(activeThread, notesRef.current, setNotes);
        }
    }, [activeThread, setNotes]);

    const deleteThreadWrapper = useCallback((id: string) => {
        // Jika thread yang dihapus sedang aktif, memori dikonsolidasikan dulu
        if (activeThreadId === id) {
            triggerMemoryConsolidation();
            setActiveThreadId(null); // Reset active ID
        } else {
            const target = threads.find(t => t.id === id);
            if (target) MemoryService.summarizeAndStore(target, notesRef.current, setNotes);
        }
        storage.deleteThread(id);
    }, [threads, activeThreadId, triggerMemoryConsolidation, setNotes, storage, setActiveThreadId]);

    const handleNewChat = useCallback(async (persona: 'hanisah' | 'stoic' = 'stoic') => {
        triggerMemoryConsolidation(); // Simpan memori chat sebelumnya

        const welcome = persona === 'hanisah' 
            ? "⚡ **HANISAH V20 ONLINE.**\n\n*Hai sayang, sistem udah di-upgrade nih. Mau ngomongin apa?*" 
            : "🧠 **STOIC V20 TITANIUM.**\n\n*Logic Core V20 Initialized.*\nSistem stabil. Mari bedah realitas.";
        
        const newThread = createThread(persona, globalModelId, welcome);
        
        // Set Ref DULUAN agar UI tidak flicker saat transisi
        pendingThreadId.current = newThread.id;
        setActiveThreadId(newThread.id);
        
        return newThread;
    }, [createThread, globalModelId, triggerMemoryConsolidation, setActiveThreadId]);

    // --- 8. SEND MESSAGE LOGIC (CORE FIX) ---
    const handleSendMessage = async (e?: React.FormEvent, attachment?: { data: string, mimeType: string }) => {
        if (e) e.preventDefault();
        
        const userMsgText = input.trim();
        if ((!userMsgText && !attachment) || isLoading) return;
        
        // Simpan input sementara jika terjadi error (opsional, tapi good practice)
        const originalInput = input; 
        setInput(''); // Kosongkan input SEGERA agar terasa responsif

        let currentThreadId = activeThreadId;
        const threadExists = threads.some(t => t.id === currentThreadId);
        const currentPersona = personaMode; 

        // Generate ID pesan User
        const userMsgId = uuidv4();
        const newUserMsg: ChatMessage = {
            id: userMsgId,
            role: 'user',
            text: attachment ? (userMsgText || "Analyze attachment") : userMsgText,
            metadata: { 
                status: 'success', 
                createdAt: new Date().toISOString(), // Penting untuk sorting
                hasAttachment: !!attachment 
            }
        };

        // --- SKENARIO 1: CHAT BARU (NEW CHAT) ---
        if (!currentThreadId || !threadExists) {
             const newId = uuidv4();
             const welcomeMsg = personaMode === 'hanisah' 
                ? "⚡ **HANISAH V20 ONLINE.**\n\n*Hai sayang, sistem udah di-upgrade nih. Mau ngomongin apa?*" 
                : "🧠 **STOIC V20 TITANIUM.**\n\n*Logic Core V20 Initialized.*";

            const newThread: ChatThread = {
                id: newId,
                title: userMsgText.slice(0, 30).toUpperCase() || 'NEW_SESSION',
                persona: personaMode,
                model_id: globalModelId,
                messages: [
                    { id: uuidv4(), role: 'model', text: welcomeMsg, metadata: { status: 'success', model: 'System' } },
                    newUserMsg // Masukkan pesan user LANGSUNG disini (Atomic)
                ],
                updated: new Date().toISOString(),
                isPinned: false
            };

            // UPDATE STATE: Langsung masukkan thread baru ke list
            setThreads(prev => [newThread, ...prev]);
            setActiveThreadId(newId);
            pendingThreadId.current = newId;
            
            // EXECUTE STREAM
            try {
                await streamMessage(userMsgText, activeModel, newId, personaMode, attachment);
            } catch (err) {
                console.error("Stream failed on new chat:", err);
                // Rollback (Opsional): Kembalikan input jika gagal total
                // setInput(originalInput); 
            }
            return;
        }

        // --- SKENARIO 2: CHAT LAMA (EXISTING) ---
        // FIX KRUSIAL: Jangan hanya andalkan 'addMessage' dari storage yang mungkin async/lambat.
        // Kita manipulasi state 'threads' secara manual di memori (Optimistic Update).
        
        setThreads(prevThreads => prevThreads.map(t => {
            if (t.id === currentThreadId) {
                return {
                    ...t,
                    messages: [...t.messages, newUserMsg], // Tambahkan pesan ke array
                    updated: new Date().toISOString()
                };
            }
            return t;
        }));

        // Trigger persistensi ke local storage/DB di background
        addMessage(currentThreadId, newUserMsg); 
        
        // Auto rename jika masih awal percakapan
        const threadRef = threads.find(t => t.id === currentThreadId);
        if (threadRef && threadRef.messages.length <= 2 && userMsgText) {
            renameThread(currentThreadId, userMsgText.slice(0, 30).toUpperCase());
        }
        
        // EXECUTE STREAM
        try {
            await streamMessage(userMsgText, activeModel, currentThreadId, currentPersona, attachment);
        } catch (err) {
            console.error("Stream failed on existing chat:", err);
            // Tambahkan pesan error sistem ke chat
            const errorMsg: ChatMessage = {
                id: uuidv4(),
                role: 'model',
                text: "⚠️ **CONNECTION LOST.**\nMaaf, terjadi kesalahan saat mengirim pesan. Silakan coba lagi.",
                metadata: { status: 'error' }
            };
            addMessage(currentThreadId, errorMsg);
        }
    };

    // --- 9. HYDRA / POLLINATIONS HANDLER ---
    const generateWithHydra = async () => {
        if (!input.trim()) { 
            // Feedback visual kecil bisa ditambahkan di sini (toast)
            return; 
        }
        const promptText = input.trim();
        setInput(''); 
        
        let targetId = activeThreadId;
        const threadExists = threads.some(t => t.id === targetId);

        // Jika user mengetik prompt gambar di halaman kosong -> buat chat baru
        if (!targetId || !threadExists) {
            const newThread = await handleNewChat(personaMode);
            targetId = newThread.id;
        }

        // Stoic Guard
        if (personaMode === 'stoic') {
            const deniedMsg: ChatMessage = { 
                id: uuidv4(), 
                role: 'model', 
                text: "> 🚫 **ACCESS DENIED: VISUAL MODULE**\n\n_\"The Stoic mind focuses on internal reason, not external illusions.\"_\n\nSilakan beralih ke **HANISAH** untuk fitur kreatif.", 
                metadata: { status: 'error', model: 'SYSTEM_GATEKEEPER' } 
            };
            // Tampilkan pesan user dulu
            addMessage(targetId!, { id: uuidv4(), role: 'user', text: `Generate Visual: ${promptText}`, metadata: { status: 'success' } });
            // Lalu tampilkan penolakan
            setTimeout(() => addMessage(targetId!, deniedMsg), 500);
            return;
        }

        const userMsgId = uuidv4();
        const modelMsgId = uuidv4();
        
        // Tampilkan pesan User
        addMessage(targetId!, { id: userMsgId, role: 'user', text: `🎨 Generate: ${promptText}`, metadata: { status: 'success' } });
        
        // Tampilkan Placeholder "Sedang Membuat..." (Optimistic UI)
        addMessage(targetId!, { 
            id: modelMsgId, 
            role: 'model', 
            text: "🔄 **HYDRA ENGINE ACTIVE**\n*Constructing visual matrix...*", 
            metadata: { status: 'loading' } 
        });

        try {
            const targetModel = (imageModelId === 'gemini-2.5-flash-image' || imageModelId === 'gemini-3-pro-image-preview') 
                ? 'hydra-smart-route' 
                : imageModelId;

            const result = await PollinationsService.generateHydraImage(promptText, targetModel);
            
            // Update pesan placeholder dengan hasil gambar
            updateMessage(targetId!, modelMsgId, {
                text: `Here is your creation based on "${promptText}":\n\n![Generated Image](${result.url})\n\n_Engine: ${result.model.toUpperCase()}_`,
                metadata: { status: 'success' }
            });
        } catch (e: any) {
            // Update pesan placeholder dengan error
            updateMessage(targetId!, modelMsgId, {
                text: `⚠️ **GENERATION FAILED**: ${e.message}`,
                metadata: { status: 'error' }
            });
        }
    };

    return {
        // State utama
        threads, 
        setThreads, 
        activeThread, 
        activeThreadId, 
        setActiveThreadId,
        isThreadsLoaded,
        
        // Status & Config
        isVaultSynced: isVaultUnlocked, 
        setIsVaultSynced: (val: boolean) => val ? unlockVault() : lockVault(),
        isVaultConfigEnabled: vaultEnabled, 
        isAutoSpeak, 
        setIsAutoSpeak, 
        isLiveModeActive, 
        setIsLiveModeActive,
        isLoading, 
        
        // Inputs
        input, 
        setInput, 
        
        // Models
        activeModel, 
        setGlobalModelId, 
        imageModelId, 
        setImageModelId,
        personaMode,
        
        // Actions
        handleNewChat, 
        sendMessage: handleSendMessage, 
        stopGeneration,
        generateWithHydra, 
        generateWithPollinations: generateWithHydra, 
        
        // Storage Actions (Wrapped)
        renameThread,
        togglePinThread: storage.togglePinThread,
        deleteThread: deleteThreadWrapper
    };
};
