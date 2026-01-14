
import React, { useState, memo, useCallback } from 'react';
import { ImagePlus, Aperture, Activity } from 'lucide-react';
import { GenerativeStudio } from './components/GenerativeStudio';
import { NeuralVision } from './components/NeuralVision';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

const AIToolsView: React.FC = memo(() => {
    const [activeSection, setActiveSection] = useState<'GENERATIVE' | 'ANALYTIC' | null>('GENERATIVE');

    const toggleSection = useCallback((section: 'GENERATIVE' | 'ANALYTIC') => {
        setActiveSection(prev => prev === section ? null : section);
    }, []);

    return (
        <div className="h-full w-full overflow-y-auto custom-scroll flex flex-col px-4 pb-32 pt-[calc(env(safe-area-inset-top)+1.5rem)] md:px-8 md:pt-12 md:pb-40 lg:px-12 animate-fade-in bg-bg relative z-10 overscroll-none">
            <div className="max-w-6xl mx-auto w-full space-y-10 relative z-10">
                <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 animate-slide-up pb-4">
                    <div className="space-y-2">
                        <p className="caption text-text-muted">AI Tools</p>
                        <h1 className="page-title text-text">Create and analyze</h1>
                        <p className="body-sm text-text-muted">Generate images, video, and inspect visuals in one place.</p>
                    </div>

                    <Card padding="sm" className="flex items-center gap-3">
                        <Badge variant="success">Ready</Badge>
                        <div className="flex items-center gap-2 text-text-muted">
                            <Activity size={14} />
                            <span className="caption">Engines online</span>
                        </div>
                    </Card>
                </header>

                <div className="space-y-6 transform-gpu pb-20">
                    <GenerativeStudio 
                        isOpen={activeSection === 'GENERATIVE'} 
                        onToggle={() => toggleSection('GENERATIVE')}
                        icon={<ImagePlus />}
                    />

                    <NeuralVision 
                        isOpen={activeSection === 'ANALYTIC'} 
                        onToggle={() => toggleSection('ANALYTIC')}
                        icon={<Aperture />}
                    />
                </div>
                
                <div className="flex justify-center pt-8 pb-4 opacity-60">
                    <span className="caption text-text-muted">Optimized for fast generation.</span>
                </div>
            </div>
        </div>
    );
});

export default AIToolsView;
