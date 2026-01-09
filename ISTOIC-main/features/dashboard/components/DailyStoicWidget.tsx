
import React, { useState, useEffect } from 'react';
import { RefreshCw, Quote, Sun, Moon, Calendar, Zap } from 'lucide-react';
import { HANISAH_KERNEL } from '../../../services/melsaKernel';
import useLocalStorage from '../../../hooks/useLocalStorage';

export const DailyStoicWidget: React.FC = () => {
    const [briefing, setBriefing] = useLocalStorage<any>('stoic_daily_briefing', null);
    const [isLoading, setIsLoading] = useState(false);
    const [timeOfDay, setTimeOfDay] = useState('');

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setTimeOfDay('MORNING');
        else if (hour < 18) setTimeOfDay('AFTERNOON');
        else setTimeOfDay('EVENING');

        // Check if briefing is stale (older than today)
        const today = new Date().toDateString();
        if (!briefing || briefing.date !== today) {
            generateBriefing(today, hour);
        }
    }, []);

    const generateBriefing = async (dateKey: string, hour: number) => {
        setIsLoading(true);
        try {
            const context = hour < 12 ? "Focus on preparing the mind for the day's challenges." 
                : hour < 18 ? "Focus on endurance and maintaining rationality." 
                : "Focus on reflection and calming the mind.";

            const prompt = `
            Generate a short, powerful Daily Stoic Briefing.
            Context: ${context}
            Language: Indonesian (Casual but philosophical).
            
            IMPORTANT: Return ONLY raw JSON. Do not include markdown formatting like \`\`\`json.
            Structure:
            {
                "quote": "A stoic quote (Marcus Aurelius/Seneca/Epictetus)",
                "advice": "1 short paragraph applying this to modern work/code life.",
                "focus": "ONE_WORD_THEME"
            }
            `;

            const result = await HANISAH_KERNEL.execute(prompt, 'gemini-3-flash-preview');
            
            // Robust JSON Extraction
            let cleanText = result.text || '';
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanText = jsonMatch[0];
            } else {
                cleanText = cleanText.replace(/```json|```/g, '').trim();
            }

            try {
                const data = JSON.parse(cleanText);
                if (data.quote) {
                    setBriefing({ ...data, date: dateKey });
                }
            } catch (parseError) {
                console.warn("Failed to parse stoic briefing JSON. Retrying with fallback.", cleanText);
            }
        } catch (e) {
            console.error("Failed to generate stoic briefing", e);
        } finally {
            setIsLoading(false);
        }
    };

    if (!briefing && !isLoading) return null;

    return (
        <div className="relative overflow-hidden rounded-[32px] bg-white dark:bg-[#0f0f11] border border-black/5 dark:border-white/5 shadow-lg group md:col-span-6 lg:col-span-8 animate-slide-up ring-1 ring-black/5 dark:ring-white/5">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 opacity-50"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>

            <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row gap-8 items-start md:items-center h-full">
                
                {/* Left: Icon & Time */}
                <div className="flex flex-col gap-4 min-w-[140px]">
                    <div className="w-16 h-16 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center border border-black/5 dark:border-white/5 shadow-inner">
                        {isLoading ? (
                            <RefreshCw className="animate-spin text-neutral-400" size={32} />
                        ) : timeOfDay === 'EVENING' ? (
                            <Moon className="text-indigo-400" size={32} />
                        ) : (
                            <Sun className="text-amber-500" size={32} />
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                            <Calendar size={12} /> {new Date().toLocaleDateString('id-ID', { weekday: 'long' })}
                        </div>
                        <h3 className="text-2xl font-black italic uppercase tracking-tighter text-black dark:text-white mt-1">
                            {timeOfDay}_BRIEF
                        </h3>
                    </div>
                </div>

                {/* Right: Content */}
                <div className="flex-1 space-y-4">
                    {isLoading ? (
                        <div className="space-y-3 animate-pulse">
                            <div className="h-4 bg-black/5 dark:bg-white/5 rounded w-3/4"></div>
                            <div className="h-4 bg-black/5 dark:bg-white/5 rounded w-1/2"></div>
                        </div>
                    ) : briefing ? (
                        <>
                            <div className="relative">
                                <Quote size={24} className="absolute -top-3 -left-4 text-neutral-200 dark:text-neutral-800 transform -scale-x-100" />
                                <p className="text-lg md:text-xl font-serif italic text-black dark:text-neutral-200 leading-relaxed">
                                    "{briefing.quote}"
                                </p>
                            </div>
                            
                            <div className="h-[1px] bg-black/5 dark:bg-white/5 w-full"></div>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                <span className="px-3 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-[9px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                                    <Zap size={10} className="text-accent" /> FOCUS: {briefing.focus}
                                </span>
                                <p className="text-xs font-medium text-neutral-500 leading-relaxed max-w-lg">
                                    {briefing.advice}
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="text-neutral-500 text-sm">Offline. Cannot generate briefing.</div>
                    )}
                </div>

                {/* Regenerate Action */}
                <button 
                    onClick={() => generateBriefing(new Date().toDateString(), new Date().getHours())}
                    className="absolute top-6 right-6 p-2 text-neutral-300 hover:text-black dark:hover:text-white transition-colors opacity-0 group-hover:opacity-100 bg-white/5 rounded-full"
                    title="Regenerate"
                >
                    <RefreshCw size={16} />
                </button>
            </div>
        </div>
    );
};
