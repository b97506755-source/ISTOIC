
// ... (imports remain)
import React, { useEffect, useRef } from 'react';
import { editImage } from '../../../services/geminiService';
import { analyzeMultiModalMedia } from '../../../services/providerEngine';
import { Camera, Layout, Trash2, X, Aperture, Image as ImageIcon, AlertCircle, ScanEye, Mic, Copy, Volume2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { ToolGroup } from './ToolGroup';
import { useAIProvider } from '../../../hooks/useAIProvider';
import { VisualModelSelector, type ProviderGroup } from './VisualModelSelector';
import { UI_REGISTRY, FN_REGISTRY } from '../../../constants/registry';
import { debugService } from '../../../services/debugService';
import { speakWithHanisah } from '../../../services/elevenLabsService';
import { useGenerativeSession } from '../../../contexts/GenerativeSessionContext';
import { optimizeImageForAI } from '../../../utils/imageOptimizer'; // IMPORT OPTIMIZER

interface NeuralVisionProps {
    isOpen: boolean;
    onToggle: () => void;
    icon: React.ReactNode;
}

export const NeuralVision: React.FC<NeuralVisionProps> = ({ isOpen, onToggle, icon }) => {
    // CONNECT TO GLOBAL SESSION CONTEXT
    const {
        visionPrompt: prompt, setVisionPrompt: setPrompt,
        visionResult: analysisResult, setVisionResult: setAnalysisResult,
        visionInputImage: inputBase64, setVisionInputImage: setInputBase64,
        visionInputType: inputType, setVisionInputType: setInputType,
        visionLoading: loading, setVisionLoading: setLoading,
        visionEditResult: editResult, setVisionEditResult: setEditResult,
        visionProvider: selectedProvider, setVisionProvider: setSelectedProvider,
        visionModel: selectedModel, setVisionModel: setSelectedModel,
        statusMsg, setStatusMsg // Reuse status msg logic from context or local? Context doesn't have vision specific msg yet, reuse generic or local
    } = useGenerativeSession();

    // Local status message state to avoid conflict with Gen Studio
    const [localStatusMsg, setLocalStatusMsg] = React.useState<string | null>(null);

    const { isHealthy, status: providerStatus } = useAIProvider(selectedProvider);

    // Camera State (Ephemeral)
    const [isCameraActive, setIsCameraActive] = React.useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!loading) return;
        const messages = loading === 'ANALYZE' ? [
            "SCANNING NEURAL MAPS...", "DECODING VISUAL DATA...", "IDENTIFYING ENTITIES...", "CONTEXTUAL MAPPING...", "GENERATING INSIGHTS..."
        ] : [
            "MORPHING VISUAL KERNEL...", "RECONSTRUCTING DATA...", "APPLYING TRANSFORMS...", "PIXEL REGENERATION...", "INTEGRITY CHECK..."
        ];

        let msgIdx = 0;
        setLocalStatusMsg(messages[0]);
        const interval = setInterval(() => {
            msgIdx = (msgIdx + 1) % messages.length;
            setLocalStatusMsg(messages[msgIdx]);
        }, 3000);
        return () => clearInterval(interval);
    }, [loading]);

    // ... (Camera and other logics remain)
    
    // Attach stream to video element when camera is active
    useEffect(() => {
        if (isCameraActive && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [isCameraActive]);

    const providers: ProviderGroup[] = [
        { 
            id: 'GEMINI', 
            name: 'Google Gemini', 
            models: [
                { 
                    id: 'gemini-3-flash-preview', 
                    name: 'Gemini 3 Flash',
                    description: 'Fast multimodal analysis. Ideal for general recognition.',
                    tags: ['FREE', 'FAST'],
                    specs: { speed: 'INSTANT', quality: 'STD' }
                },
                { 
                    id: 'gemini-3-pro-preview', 
                    name: 'Gemini 3 Pro',
                    description: 'Complex reasoning over visual inputs.',
                    tags: ['PRO', 'REASONING'],
                    specs: { speed: 'FAST', quality: 'ULTRA' }
                }
            ]
        },
        { 
            id: 'GROQ', 
            name: 'Groq (Llama)', 
            models: [
                { 
                    id: 'llama-3.2-90b-vision-preview', 
                    name: 'Llama 3.2 90B Vision',
                    description: 'Meta\'s flagship vision model accelerated by Groq LPU.',
                    tags: ['FAST', 'OPEN'],
                    specs: { speed: 'INSTANT', quality: 'HD' }
                }
            ]
        }
    ];

    const startCamera = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        debugService.logAction(UI_REGISTRY.TOOLS_VIS_BTN_CAMERA, FN_REGISTRY.TOOL_CAMERA_CAPTURE, 'START');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            streamRef.current = stream;
            setIsCameraActive(true);
        } catch (err) {
            console.error("Camera Access Error:", err);
            alert("Could not access camera. Please check permissions.");
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setIsCameraActive(false);
    };

    const captureFrame = () => {
        if (!videoRef.current) return;
        debugService.logAction(UI_REGISTRY.TOOLS_VIS_BTN_CAMERA, FN_REGISTRY.TOOL_CAMERA_CAPTURE, 'CAPTURE');
        
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            
            // Optimization: Export directly as compressed JPEG
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            const base64 = dataUrl.split(',')[1];
            
            setInputBase64(base64);
            setInputType('image/jpeg');
            
            stopCamera();
            processAnalysis(base64, 'image/jpeg');
        }
    };

    const processAnalysis = async (base64: string, mimeType: string) => {
        debugService.logAction(UI_REGISTRY.TOOLS_VIS_BTN_UPLOAD, FN_REGISTRY.TOOL_ANALYZE_IMAGE, selectedModel);
        
        if (!isHealthy) {
            setAnalysisResult(`ERROR: Provider ${selectedProvider} is currently ${providerStatus}.`);
            return;
        }
        setLoading('ANALYZE');
        setEditResult(null);
        setAnalysisResult(null);
        
        try {
            const result = await analyzeMultiModalMedia(
                selectedProvider,
                selectedModel,
                base64,
                mimeType,
                prompt || "Analyze this visual data in detail. Identify objects, text, and context."
            );
            setAnalysisResult(result);
        } catch (err: any) { 
            setAnalysisResult(`Visual analysis failed: ${err.message}`); 
        } finally { 
            setLoading(null); 
        }
    };

    const handleMediaUpload = async (file: File, task: 'ANALYZE' | 'EDIT') => {
        if (!file) return;
        
        const uiId = task === 'ANALYZE' ? UI_REGISTRY.TOOLS_VIS_BTN_UPLOAD : UI_REGISTRY.TOOLS_VIS_BTN_EDIT;
        const fnId = task === 'ANALYZE' ? FN_REGISTRY.TOOL_ANALYZE_IMAGE : FN_REGISTRY.TOOL_GENERATE_IMAGE;
        debugService.logAction(uiId, fnId, 'FILE_SELECTED');

        if (!isHealthy) {
            setAnalysisResult(`ERROR: Provider ${selectedProvider} is ${providerStatus}.`);
            return;
        }

        try {
            // STEP 1: CLIENT-SIDE OPTIMIZATION
            // Compresses image to prevent 413 Payload Too Large
            const { base64, mimeType } = await optimizeImageForAI(file);
            
            // SAVE TO CONTEXT (Optimized version)
            setInputBase64(base64);
            setInputType(mimeType);
            
            setLoading(task);
            setEditResult(null);
            setAnalysisResult(null);

            if (task === 'ANALYZE') {
                await processAnalysis(base64, mimeType);
            } else {
                if (selectedProvider !== 'GEMINI') {
                        setEditResult(null);
                        setAnalysisResult("Image Editing (In-painting) is currently optimized for Gemini Native only.");
                        setLoading(null);
                        return;
                }
                const result = await editImage(base64, mimeType, prompt || "Enhance this image.");
                setEditResult(result);
                setLoading(null);
            }
        } catch (err: any) { 
            setAnalysisResult(`Processing failed: ${err.message}`); 
            setLoading(null);
        }
    };

    const handleSpeak = () => {
        if (analysisResult) {
            speakWithHanisah(analysisResult.replace(/[*#_`]/g, ''));
        }
    };

    const handleCopy = () => {
        if (analysisResult) {
            navigator.clipboard.writeText(analysisResult);
        }
    };

    const handleToggle = () => {
        debugService.logAction(UI_REGISTRY.TOOLS_BTN_TAB_VIS, FN_REGISTRY.NAVIGATE_TO_FEATURE, isOpen ? 'CLOSE' : 'OPEN');
        onToggle();
    };

    const handleClear = () => {
        setInputBase64(null);
        setInputType(null);
        setAnalysisResult(null);
        setEditResult(null);
    };

    return (
        <ToolGroup 
            title="IMAGE ANALYSIS" 
            icon={icon} 
            subtitle="MULTIMODAL ANALYSIS" 
            isOpen={isOpen} 
            onToggle={handleToggle} 
            isLoading={!!loading} 
            loadingText={localStatusMsg || ''}
        >
             <div className="space-y-8 animate-fade-in p-4 md:p-6 relative">
                {/* Internal Close Button */}
                <button 
                    onClick={(e) => { e.stopPropagation(); handleToggle(); }}
                    className="absolute top-2 right-2 md:top-4 md:right-4 p-2 rounded-full hover:bg-white/5 text-neutral-400 hover:text-white transition-colors z-20"
                    title="Minimize Vision"
                >
                    <X size={20} />
                </button>

                {/* SETTINGS HEADER */}
                <div className="flex flex-col sm:flex-row gap-4 mb-4 bg-[#0f0f11] border border-white/5 p-5 rounded-[24px] shadow-sm">
                    <div className="flex-1 space-y-2">
                        <VisualModelSelector 
                            label="Vision Engine"
                            selectedProviderId={selectedProvider}
                            selectedModelId={selectedModel}
                            providers={providers}
                            onSelect={(p, m) => { setSelectedProvider(p); setSelectedModel(m); }}
                            disabled={!!loading}
                        />
                        {!isHealthy && <span className="text-red-500 flex items-center gap-1 text-[9px] font-bold pl-2 pt-2 uppercase tracking-wide"><AlertCircle size={10} /> {providerStatus}</span>}
                    </div>
                </div>

                {/* SPLIT VIEW LAYOUT */}
                <div className="flex flex-col lg:flex-row gap-8 lg:h-[600px]">
                    
                    {/* LEFT: INPUT ZONE */}
                    <div className="lg:w-5/12 flex flex-col gap-6 h-full">
                        {isCameraActive ? (
                            <div className="flex-1 relative rounded-[32px] overflow-hidden bg-black border border-accent/50 shadow-[0_0_40px_var(--accent-glow)] flex flex-col animate-fade-in ring-2 ring-accent/20 group">
                                <video 
                                    ref={videoRef} 
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover flex-1"
                                />
                                {/* Scanning Overlay */}
                                <div className="absolute inset-0 pointer-events-none opacity-50 bg-[linear-gradient(transparent_0%,rgba(0,255,255,0.1)_50%,transparent_100%)] bg-[length:100%_4px]"></div>
                                <div className="absolute inset-0 pointer-events-none border-[40px] border-black/20"></div>
                                <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-red-500/50 blur-[2px] animate-[scan_2s_linear_infinite] pointer-events-none"></div>

                                <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-8 z-20">
                                    <button onClick={stopCamera} className="p-4 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 border border-white/20 transition-all hover:scale-110"><X size={24}/></button>
                                    <button onClick={captureFrame} className="w-20 h-20 rounded-full bg-white border-[6px] border-black/10 hover:scale-110 active:scale-95 transition-all shadow-2xl"></button>
                                </div>
                                <div className="absolute top-4 left-4 px-3 py-1 bg-red-500/20 text-red-500 rounded-full backdrop-blur flex items-center gap-2 border border-red-500/30 animate-pulse">
                                    <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_red]"></div>
                                    <span className="text-[9px] font-black uppercase tracking-widest">LIVE_FEED</span>
                                </div>
                            </div>
                        ) : (
                            // Render Stored Image from Context if available
                            inputBase64 ? (
                                <div className="flex-1 relative rounded-[32px] overflow-hidden bg-black/40 border border-white/10 group">
                                    <img src={`data:${inputType || 'image/png'};base64,${inputBase64}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Input" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                        <button onClick={handleClear} className="p-3 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20}/></button>
                                    </div>
                                    <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur rounded-full text-[9px] font-black uppercase text-white border border-white/10">ACTIVE_INPUT</div>
                                </div>
                            ) : (
                                <div 
                                    onClick={() => fileInputRef.current?.click()} 
                                    className="flex-1 border-2 border-dashed border-white/10 rounded-[32px] flex flex-col items-center justify-center text-center group hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer relative overflow-hidden bg-[#0a0a0b]"
                                >
                                    <div className="w-24 h-24 rounded-[32px] bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg border border-white/5">
                                        <ImageIcon size={40} className="text-neutral-400 group-hover:text-accent transition-colors" strokeWidth={1.5} />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tech-mono text-neutral-400 group-hover:text-white transition-colors tracking-[0.3em] mb-8">DRAG_DROP_VISUAL_DATA</p>
                                    
                                    <div className="flex gap-3 relative z-10" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-white/10 hover:bg-white text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border border-white/5">UPLOAD</button>
                                        <button onClick={startCamera} className="px-6 py-3 bg-white/10 hover:bg-accent text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm border border-white/5"><Camera size={14}/> CAM</button>
                                    </div>
                                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0], 'ANALYZE')} accept="image/*,video/*" />
                                </div>
                            )
                        )}

                        <div className="relative shrink-0">
                            <textarea 
                                value={prompt} 
                                onChange={(e) => setPrompt(e.target.value)} 
                                placeholder="INSTRUCTION_SET..." 
                                className="w-full bg-[#0a0a0b] p-6 rounded-[24px] border border-white/10 focus:border-accent/30 focus:shadow-lg focus:outline-none text-white font-mono text-xs h-32 resize-none placeholder:text-neutral-400 transition-all shadow-inner" 
                            />
                            <button onClick={() => editInputRef.current?.click()} className="absolute bottom-4 right-4 p-2.5 bg-white/5 hover:bg-white/10 text-neutral-500 hover:text-white rounded-xl transition-all" title="Edit Mode">
                                <Layout size={16} />
                                <input type="file" ref={editInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0], 'EDIT')} accept="image/*" />
                            </button>
                        </div>
                    </div>

                    {/* RIGHT: OUTPUT ZONE */}
                    <div className="flex-1 bg-[#0a0a0b] rounded-[32px] border border-white/5 overflow-hidden relative flex flex-col shadow-lg">
                        <div className="h-16 bg-white/[0.02] border-b border-white/5 flex items-center px-8 justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <ScanEye size={20} className="text-accent" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">ANALYSIS_LOG</span>
                            </div>
                            <div className="flex gap-2">
                                {(analysisResult) && (
                                    <>
                                        <button onClick={handleSpeak} className="text-neutral-400 hover:text-accent transition-colors p-2 rounded-lg hover:bg-white/5"><Volume2 size={18}/></button>
                                        <button onClick={handleCopy} className="text-neutral-400 hover:text-accent transition-colors p-2 rounded-lg hover:bg-white/5"><Copy size={18}/></button>
                                        <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
                                    </>
                                )}
                                {(analysisResult || editResult) && (
                                    <button onClick={handleClear} className="text-neutral-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-white/5"><Trash2 size={18}/></button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 p-8 overflow-y-auto custom-scroll relative">
                            {loading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6">
                                    <div className="w-20 h-20 rounded-full border-4 border-accent/20 border-t-accent animate-spin shadow-[0_0_40px_var(--accent-glow)]"></div>
                                    <p className="text-[10px] tech-mono font-black text-accent animate-pulse uppercase tracking-[0.3em]">{localStatusMsg}</p>
                                </div>
                            ) : editResult ? (
                                <img src={editResult} alt="Result" className="w-full h-full object-contain rounded-2xl border border-white/5" />
                            ) : analysisResult ? (
                                <div className="prose dark:prose-invert prose-sm max-w-none text-neutral-300 font-medium text-[13px] leading-loose animate-slide-up">
                                    <Markdown>{analysisResult}</Markdown>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full opacity-30 gap-6">
                                    <Aperture size={64} className="text-white" strokeWidth={1} />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">AWAITING_VISUAL_INPUT</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
             </div>
             <style>{`
                @keyframes scan {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
             `}</style>
        </ToolGroup>
    );
};
