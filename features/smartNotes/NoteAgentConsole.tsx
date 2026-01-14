import React, { useState, useEffect } from 'react';
import { X, Sparkles, ListTodo, Lightbulb, Library, Check, Loader2, ChevronLeft, Database } from 'lucide-react';
import { type Note } from '../../types';
import { NOTE_AGENTS, type AgentType } from '../../services/noteAgentService';
import { VectorDB } from '../../services/vectorDb';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { cn } from '../../utils/cn';

interface NoteAgentConsoleProps {
    isOpen: boolean;
    onClose: () => void;
    notes: Note[];
    onApplyUpdates: (updates: Partial<Note>[]) => void;
    onAddTasks: (tasks: any[]) => void;
}

export const NoteAgentConsole: React.FC<NoteAgentConsoleProps> = ({ isOpen, onClose, notes, onApplyUpdates, onAddTasks }) => {
    const [mobileView, setMobileView] = useState<'MENU' | 'RESULT'>('MENU');
    const [result, setResult] = useState<any>(null);
    const [activeAgent, setActiveAgent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setMobileView('MENU');
            setResult(null);
            setActiveAgent(null);
            setProgress(0);
        }
    }, [isOpen]);

    const runAgent = async (type: AgentType) => {
        setIsLoading(true);
        setActiveAgent(type);
        setMobileView('RESULT');
        setResult(null);
        
        try {
            if (type === 'ORGANIZER') {
                const res = await NOTE_AGENTS.runOrganizer(notes, 'hanisah'); 
                setResult(res);
            } else if (type === 'INSIGHT') {
                const res = await NOTE_AGENTS.runInsight(notes);
                setResult(res);
            } else if (type === 'TASKS') {
                const res = await NOTE_AGENTS.runActionExtractor(notes);
                setResult(res);
            }
        } catch (e) {
            console.error(e);
            setResult({ error: 'Agent execution failed.' });
        } finally {
            setIsLoading(false);
        }
    };

    const runIndexing = async () => {
        setIsLoading(true);
        setActiveAgent('INDEXING');
        setMobileView('RESULT');
        setProgress(0);

        try {
            const count = await VectorDB.indexNotes(notes, (current, total) => {
                setProgress(Math.round((current / total) * 100));
            });
            setResult(`Indexed ${count} notes for semantic search.`);
        } catch (e: any) {
            setResult({ error: `Indexing failed: ${e.message}` });
        } finally {
            setIsLoading(false);
        }
    };

    const handleApply = () => {
        if (!result) return;
        if (activeAgent === 'ORGANIZER') {
            onApplyUpdates(result);
            onClose();
        } else if (activeAgent === 'TASKS') {
            onAddTasks(result);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onClose={onClose} title="Note agents" size="full">
            <div className="flex flex-col md:flex-row h-full min-h-[70vh]">
                <aside className={cn(
                    'w-full md:w-[320px] border-r border-border bg-surface-2/50 flex flex-col',
                    mobileView === 'MENU' ? 'flex' : 'hidden md:flex'
                )}>
                    <div className="p-4 border-b border-border">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="section-title text-text">Agents</div>
                                <p className="caption text-text-muted">Automations for organizing notes.</p>
                            </div>
                            <Button onClick={onClose} variant="ghost" size="sm" className="md:hidden w-8 h-8 p-0" aria-label="Close">
                                <X size={16} />
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-3 pb-safe">
                        <AgentCard 
                            label="Organizer" 
                            desc="Rename, tag, and archive notes automatically." 
                            icon={<Library size={18}/>} 
                            onClick={() => runAgent('ORGANIZER')}
                            isActive={activeAgent === 'ORGANIZER'}
                        />
                        <AgentCard 
                            label="Insights" 
                            desc="Surface themes and recurring topics." 
                            icon={<Lightbulb size={18}/>} 
                            onClick={() => runAgent('INSIGHT')}
                            isActive={activeAgent === 'INSIGHT'}
                        />
                        <AgentCard 
                            label="Tasks" 
                            desc="Extract action items from notes." 
                            icon={<ListTodo size={18}/>} 
                            onClick={() => runAgent('TASKS')}
                            isActive={activeAgent === 'TASKS'}
                        />
                        
                        <div className="h-px bg-border" />
                        
                        <AgentCard 
                            label="Semantic indexing" 
                            desc="Prepare notes for semantic search." 
                            icon={<Database size={18}/>} 
                            onClick={runIndexing}
                            isActive={activeAgent === 'INDEXING'}
                        />
                    </div>
                </aside>

                <section className={cn(
                    'flex-1 flex flex-col bg-surface',
                    mobileView === 'RESULT' ? 'flex' : 'hidden md:flex'
                )}>
                    <div className="md:hidden border-b border-border flex items-center justify-between px-4 py-3 pt-safe">
                        <Button onClick={() => setMobileView('MENU')} variant="secondary" size="sm">
                            <ChevronLeft size={16} /> Back
                        </Button>
                        <Button onClick={onClose} variant="ghost" size="sm" className="w-8 h-8 p-0" aria-label="Close">
                            <X size={16} />
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                            <div className="relative">
                                <Loader2 size={32} className="animate-spin text-accent" />
                            </div>
                            <div>
                                <h4 className="section-title text-text">
                                    {activeAgent === 'INDEXING' ? 'Indexing notes' : 'Running agent'}
                                </h4>
                                <p className="caption text-text-muted">
                                    {activeAgent === 'INDEXING' ? `Progress: ${progress}%` : `Processing ${notes.length} notes`}
                                </p>
                            </div>
                        </div>
                    ) : result ? (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-border bg-surface-2/40">
                                <h3 className="section-title text-text">{activeAgent}</h3>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scroll p-4 md:p-6 pb-32 md:pb-6 space-y-4">
                                {activeAgent === 'INDEXING' && typeof result === 'string' && (
                                    <Card padding="lg" className="flex flex-col items-center text-center gap-3">
                                        <div className="w-12 h-12 rounded-[var(--radius-md)] bg-success/10 text-success flex items-center justify-center">
                                            <Check size={24} />
                                        </div>
                                        <div className="section-title text-text">Indexing complete</div>
                                        <p className="body text-text-muted">{result}</p>
                                    </Card>
                                )}

                                {activeAgent === 'ORGANIZER' && Array.isArray(result) && (
                                    <div className="space-y-3">
                                        <p className="caption text-text-muted">{result.length} updates proposed.</p>
                                        {result.map((update: any, i: number) => (
                                            <Card key={i} padding="md" className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="accent">Update</Badge>
                                                    <p className="caption text-text-muted">ID {update.id.slice(0, 6)}</p>
                                                </div>
                                                <p className="body text-text">{update.title}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {update.tags?.map((t: string) => (
                                                        <Badge key={t} variant="neutral">{t}</Badge>
                                                    ))}
                                                    {update.is_archived && <Badge variant="warning">Archived</Badge>}
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}

                                {activeAgent === 'INSIGHT' && typeof result === 'string' && (
                                    <Card padding="lg">
                                        <pre className="whitespace-pre-wrap body text-text">{result}</pre>
                                    </Card>
                                )}

                                {activeAgent === 'TASKS' && Array.isArray(result) && (
                                    <div className="space-y-2">
                                        {result.map((task: any, i: number) => (
                                            <Card key={i} padding="sm" className="flex items-center gap-3">
                                                <div className="w-4 h-4 rounded border border-border" />
                                                <span className="body text-text">{task.text}</span>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {activeAgent !== 'INSIGHT' && activeAgent !== 'INDEXING' && (
                                <div className="border-t border-border bg-surface-2/60 p-4 pb-safe">
                                    <Button onClick={handleApply} variant="primary" size="lg" className="w-full">
                                        Apply changes
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-text-muted">
                            <Sparkles size={32} />
                            <p className="body">Select an agent to begin.</p>
                        </div>
                    )}
                </section>
            </div>
        </Dialog>
    );
};

const AgentCard: React.FC<{ 
    label: string; desc: string; icon: React.ReactNode; onClick: () => void; isActive: boolean 
}> = ({ label, desc, icon, onClick, isActive }) => (
    <Card
        as="button"
        onClick={onClick}
        interactive
        padding="md"
        className={cn('w-full text-left', isActive ? 'border-accent bg-accent/10' : '')}
    >
        <div className="flex items-start gap-3">
            <div className={cn(
                'w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center border',
                isActive ? 'bg-accent/15 text-accent border-accent/30' : 'bg-surface-2 text-text-muted border-border'
            )}>
                {icon}
            </div>
            <div className="space-y-1">
                <div className="section-title text-text">{label}</div>
                <p className="caption text-text-muted">{desc}</p>
            </div>
        </div>
    </Card>
);
