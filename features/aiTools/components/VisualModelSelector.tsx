
import React, { useState, useRef, useEffect } from 'react';
import { 
    ChevronDown, Check, Sparkles, Zap, Cpu, Box, Globe, 
    Layers, Info, ShieldCheck, Gauge, Brain
} from 'lucide-react';
import { HYDRA_MODELS } from '../../../services/pollinationsService';

export interface ModelSpec {
    id: string;
    name: string;
    description?: string;
    tags?: string[];
    specs?: {
        speed: 'INSTANT' | 'FAST' | 'SLOW';
        quality: 'STD' | 'HD' | 'ULTRA';
    };
}

export interface ProviderGroup {
    id: string;
    name: string;
    models: ModelSpec[];
}

interface VisualModelSelectorProps {
    label: string;
    selectedProviderId: string;
    selectedModelId: string;
    providers: ProviderGroup[];
    onSelect: (providerId: string, modelId: string) => void;
    disabled?: boolean;
}

const getProviderIcon = (id: string, className?: string) => {
    switch(id.toUpperCase()) {
        case 'GEMINI': return <Sparkles size={18} className={className || "text-blue-500"} />;
        case 'OPENAI': return <Cpu size={18} className={className || "text-green-500"} />;
        case 'GROQ': return <Zap size={18} className={className || "text-orange-500"} />;
        case 'HYDRA': return <Layers size={18} className={className || "text-pink-500"} />;
        default: return <Box size={18} className={className || "text-neutral-500"} />;
    }
};

const SpeedIndicator = ({ speed }: { speed?: string }) => {
    const color = speed === 'INSTANT' ? 'bg-yellow-400' : speed === 'FAST' ? 'bg-emerald-400' : 'bg-blue-400';
    return (
        <div className="flex items-center gap-1.5">
            <Gauge size={10} className="text-neutral-500" />
            <div className="flex gap-0.5">
                <div className={`w-1 h-2 rounded-sm ${color}`}></div>
                <div className={`w-1 h-2 rounded-sm ${speed !== 'SLOW' ? color : 'bg-neutral-700'}`}></div>
                <div className={`w-1 h-2 rounded-sm ${speed === 'INSTANT' ? color : 'bg-neutral-700'}`}></div>
            </div>
        </div>
    );
};

export const VisualModelSelector: React.FC<VisualModelSelectorProps> = ({
    label,
    selectedProviderId,
    selectedModelId,
    providers = [],
    onSelect,
    disabled
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Build Default Providers if not passed
    const defaultProviders: ProviderGroup[] = [
        {
            id: 'HYDRA',
            name: 'Hydra Image Engine',
            models: [
                { id: 'hydra-smart-route', name: 'Hydra Auto', description: 'Smart routing. Best for generic requests.', tags: ['SMART', 'AUTO'], specs: { speed: 'FAST', quality: 'ULTRA' } },
                { id: 'flux', name: 'Flux Standard', description: 'Balanced detail and prompt adherence.', tags: ['FREE', 'TEXT'], specs: { speed: 'FAST', quality: 'HD' } },
                { id: 'flux-realism', name: 'Flux Realism', description: 'Photorealistic output.', tags: ['FREE', 'REAL'], specs: { speed: 'FAST', quality: 'ULTRA' } },
                { id: 'flux-anime', name: 'Flux Anime', description: 'Anime/Manga style.', tags: ['FREE', '2D'], specs: { speed: 'FAST', quality: 'HD' } },
                { id: 'flux-3d', name: 'Flux 3D', description: '3D Render style.', tags: ['FREE', '3D'], specs: { speed: 'FAST', quality: 'HD' } },
                { id: 'midjourney', name: 'Midjourney Style', description: 'Artistic composition.', tags: ['FREE', 'ART'], specs: { speed: 'SLOW', quality: 'ULTRA' } },
                { id: 'turbo', name: 'SDXL Turbo', description: 'Fastest generation.', tags: ['FREE', 'SPEED'], specs: { speed: 'INSTANT', quality: 'STD' } }
            ]
        },
        { 
            id: 'GEMINI', 
            name: 'Google Gemini', 
            models: [
                { id: 'gemini-2.5-flash-image', name: 'Imagen 3 Fast', description: 'Native Google generation.', tags: ['FREE', 'FAST'], specs: { speed: 'INSTANT', quality: 'STD' } },
                { id: 'gemini-3-pro-image-preview', name: 'Imagen 3 Pro', description: 'High coherence (Paid).', tags: ['PRO', 'ULTRA'], specs: { speed: 'FAST', quality: 'ULTRA' } }
            ]
        }
    ];

    const activeProviders = providers.length > 0 ? providers : defaultProviders;

    const selectedProvider = activeProviders.find(p => p.id === selectedProviderId) || activeProviders[0];
    const selectedModel = selectedProvider?.models.find(m => m.id === selectedModelId) || selectedProvider?.models[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="space-y-2 relative" ref={containerRef}>
            <label className="text-[9px] tech-mono font-black uppercase tracking-[0.3em] text-neutral-500 pl-1 flex items-center gap-2">
                <Layers size={10} /> {label}
            </label>
            
            <button 
                onClick={(e) => { e.stopPropagation(); !disabled && setIsOpen(!isOpen); }}
                className={`w-full bg-[#0a0a0b] hover:bg-black/40 border transition-all p-3 rounded-2xl flex items-center justify-between group ${
                    isOpen 
                    ? 'border-accent/50 shadow-[0_0_20px_rgba(var(--accent-rgb),0.1)]' 
                    : 'border-white/10 hover:border-white/20'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-white/10 transition-colors">
                        {getProviderIcon(selectedProviderId)}
                    </div>
                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{selectedProvider?.name}</span>
                            <div className="w-1 h-1 rounded-full bg-neutral-600"></div>
                            {selectedModel?.specs && <SpeedIndicator speed={selectedModel.specs.speed} />}
                        </div>
                        <div className="text-sm font-black text-white uppercase tracking-tight truncate max-w-[180px] md:max-w-xs">
                            {selectedModel?.name}
                        </div>
                    </div>
                </div>
                <div className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center transition-transform duration-300 ${isOpen ? 'rotate-180 bg-accent/10 text-accent' : 'text-neutral-500'}`}>
                    <ChevronDown size={16} />
                </div>
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a0b]/95 backdrop-blur-xl border border-white/10 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-2 z-[100] animate-slide-down origin-top overflow-hidden ring-1 ring-white/10">
                    <div className="max-h-[300px] overflow-y-auto custom-scroll p-1 space-y-4">
                        {activeProviders.map(provider => (
                            <div key={provider.id} className="space-y-2">
                                <div className="px-3 py-1 flex items-center gap-2 text-[9px] font-black text-neutral-500 uppercase tracking-widest bg-white/5 rounded-lg w-fit">
                                    {getProviderIcon(provider.id, "w-3 h-3")} {provider.name}
                                </div>
                                <div className="grid grid-cols-1 gap-1">
                                    {provider.models.map(model => {
                                        const isSelected = selectedProviderId === provider.id && selectedModelId === model.id;
                                        return (
                                            <button
                                                key={model.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelect(provider.id, model.id);
                                                    setIsOpen(false);
                                                }}
                                                className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left group ${
                                                    isSelected
                                                    ? 'bg-accent/10 border-accent/30 shadow-[inset_0_0_20px_rgba(var(--accent-rgb),0.05)]'
                                                    : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'
                                                }`}
                                            >
                                                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                                    isSelected ? 'border-accent bg-accent text-black' : 'border-neutral-700 bg-transparent group-hover:border-neutral-500'
                                                }`}>
                                                    {isSelected && <Check size={10} strokeWidth={4} />}
                                                </div>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <span className={`text-[11px] font-bold uppercase tracking-tight ${isSelected ? 'text-white' : 'text-neutral-300 group-hover:text-white'}`}>
                                                            {model.name}
                                                        </span>
                                                        {model.tags && (
                                                            <div className="flex gap-1">
                                                                {model.tags.map(tag => (
                                                                    <span key={tag} className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-neutral-400 border border-white/5">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {model.description && (
                                                        <p className="text-[9px] text-neutral-500 line-clamp-1 group-hover:text-neutral-400 transition-colors">
                                                            {model.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
