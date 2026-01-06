
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { NeuralLinkService } from '../services/neuralLink';
import type { NeuralLinkStatus, MicMode, AmbientMode } from '../services/neuralLink';
import { executeNeuralTool } from '../features/aiChat/services/toolHandler';
import type { Note } from '../types';
import { debugService } from '../services/debugService';
import { HANISAH_BRAIN } from '../services/melsaBrain';

interface LiveSessionContextType {
    isLive: boolean;
    isMinimized: boolean;
    status: NeuralLinkStatus;
    transcript: Array<{ role: 'user' | 'model', text: string }>;
    interimTranscript: { role: 'user' | 'model', text: string } | null;
    activeTool: string | null;
    analyser: AnalyserNode | null;
    micMode: MicMode;
    ambientMode: AmbientMode;
    startSession: (persona: 'hanisah' | 'stoic') => void;
    stopSession: () => void;
    toggleMinimize: () => void;
    setMicMode: (mode: MicMode) => void;
    setAmbientMode: (mode: AmbientMode) => void;
}

const LiveSessionContext = createContext<LiveSessionContextType | undefined>(undefined);

interface LiveSessionProviderProps {
    children: React.ReactNode;
    notes: Note[];
    setNotes: (notes: Note[]) => void;
}

export const LiveSessionProvider: React.FC<LiveSessionProviderProps> = ({ children, notes, setNotes }) => {
    const notesRef = useRef(notes);
    
    useEffect(() => {
        notesRef.current = notes;
    }, [notes]);

    // Session State
    const [isLive, setIsLive] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [status, setStatus] = useState<NeuralLinkStatus>('IDLE');
    const [transcript, setTranscript] = useState<Array<{ role: 'user' | 'model', text: string }>>([]);
    const [interimTranscript, setInterimTranscript] = useState<{ role: 'user' | 'model', text: string } | null>(null);
    const [activeTool, setActiveTool] = useState<string | null>(null);
    
    // Audio Settings
    const [micMode, setMicModeState] = useState<MicMode>('STANDARD');
    const [ambientMode, setAmbientModeState] = useState<AmbientMode>('OFF');

    const neuralLink = useRef<NeuralLinkService>(new NeuralLinkService());

    useEffect(() => {
        return () => {
            neuralLink.current.disconnect(true);
        };
    }, []);

    const startSession = useCallback(async (persona: 'hanisah' | 'stoic') => {
        if (isLive) return;

        setTranscript([]);
        setInterimTranscript(null);
        setIsMinimized(false);
        setIsLive(true);
        setStatus('CONNECTING');

        try {
            const noteContext = notesRef.current.map(n => `- ${n.title} (ID: ${n.id})`).join('\n');
            const systemInstruction = HANISAH_BRAIN.getSystemInstruction(persona, noteContext);
            const storedVoice = localStorage.getItem(`${persona}_voice`);
            const voice = storedVoice ? JSON.parse(storedVoice) : (persona === 'hanisah' ? 'Zephyr' : 'Fenrir');

            await neuralLink.current.connect({
                modelId: 'gemini-2.5-flash-native-audio-preview-09-2025',
                persona,
                systemInstruction,
                voiceName: voice,
                onStatusChange: (newStatus, err) => {
                    setStatus(newStatus);
                    if (newStatus === 'ERROR') {
                        setIsLive(false);
                        debugService.log('ERROR', 'LIVE_CTX', 'CONNECT_FAIL', err || 'Unknown');
                    } else if (newStatus === 'ACTIVE') {
                        // Apply settings once active
                        neuralLink.current.setMicMode(micMode);
                        neuralLink.current.setAmbientMode(ambientMode);
                    }
                },
                onTranscription: (event) => {
                    if (event.isFinal) {
                        setTranscript(prev => [...prev, { role: event.source, text: event.text }]);
                        setInterimTranscript(null);
                    } else {
                        setInterimTranscript({ role: event.source, text: event.text });
                    }
                },
                onToolCall: async (call) => {
                    const toolName = call.name;
                    setActiveTool(toolName);
                    debugService.log('INFO', 'LIVE_CTX', 'TOOL_EXEC', toolName);
                    
                    try {
                        const currentNotes = notesRef.current;
                        const result = await executeNeuralTool(call, currentNotes, (newNotes) => {
                            setNotes(newNotes);
                        });
                        return result;
                    } catch (e: any) {
                        console.error("Tool execution failed", e);
                        return `Error executing ${toolName}: ${e.message}`;
                    } finally {
                        setActiveTool(null);
                    }
                }
            });
        } catch (e) {
            console.error(e);
            setIsLive(false);
            setStatus('ERROR');
        }
    }, [isLive, micMode, ambientMode]); // notes removed from dependency array, using ref

    const stopSession = useCallback(() => {
        neuralLink.current.disconnect();
        setIsLive(false);
        setIsMinimized(false);
        setStatus('IDLE');
        setActiveTool(null);
    }, []);

    const toggleMinimize = useCallback(() => {
        setIsMinimized(prev => !prev);
    }, []);

    const setMicMode = useCallback((mode: MicMode) => {
        setMicModeState(mode);
        if (isLive) neuralLink.current.setMicMode(mode);
    }, [isLive]);

    const setAmbientMode = useCallback((mode: AmbientMode) => {
        setAmbientModeState(mode);
        if (isLive) neuralLink.current.setAmbientMode(mode);
    }, [isLive]);

    return (
        <LiveSessionContext.Provider value={{
            isLive,
            isMinimized,
            status,
            transcript,
            interimTranscript,
            activeTool,
            analyser: neuralLink.current.analyser,
            micMode,
            ambientMode,
            startSession,
            stopSession,
            toggleMinimize,
            setMicMode,
            setAmbientMode
        }}>
            {children}
        </LiveSessionContext.Provider>
    );
};

export const useLiveSession = () => {
    const context = useContext(LiveSessionContext);
    if (!context) {
        throw new Error('useLiveSession must be used within a LiveSessionProvider');
    }
    return context;
};
