import React from 'react';
import { X, Archive, FileJson, Bookmark, ArchiveRestore, ShieldAlert, CheckCheck, MinusCircle } from 'lucide-react';
import { type Note } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { cn } from '../../utils/cn';

interface NoteBatchActionsProps {
    isSelectionMode: boolean;
    selectedCount: number;
    totalVisibleCount: number;
    isViewingArchive: boolean;
    selectedNotes: Note[];
    onSelectAll: () => void;
    onDeselectAll: () => void;
    onDeleteSelected: () => void;
    onArchiveSelected: () => void;
    onPinSelected: () => void;
    onCancel: () => void;
}

export const NoteBatchActions: React.FC<NoteBatchActionsProps> = ({
    isSelectionMode,
    selectedCount,
    totalVisibleCount,
    isViewingArchive,
    selectedNotes,
    onSelectAll,
    onDeselectAll,
    onDeleteSelected,
    onArchiveSelected,
    onPinSelected,
    onCancel
}) => {
    const isVisible = isSelectionMode || selectedCount > 0;
    const isAllSelected = selectedCount === totalVisibleCount && totalVisibleCount > 0;

    const handleExport = () => {
        if (selectedNotes.length === 0) return;
        const dataStr = JSON.stringify(selectedNotes, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `istoic_notes_export_${new Date().toISOString().slice(0,10)}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    return (
        <div className={`
            fixed left-1/2 -translate-x-1/2 z-[2000]
            bottom-24 md:bottom-10 w-auto min-w-[320px] max-w-[95vw]
            transition-all duration-300
            ${isVisible ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-10 opacity-0 pointer-events-none'}
        `}>
            <Card
                padding="sm"
                className="flex items-center gap-3 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <Button
                    onClick={(e) => { e.stopPropagation(); isAllSelected ? onDeselectAll() : onSelectAll(); }}
                    type="button"
                    variant={isAllSelected ? 'primary' : 'secondary'}
                    size="sm"
                    className="h-10"
                >
                    {isAllSelected ? <MinusCircle size={16} /> : <CheckCheck size={16} />}
                    {isAllSelected ? 'Clear' : 'Select all'}
                </Button>

                <div className="flex flex-col min-w-[90px]">
                    <span className="caption text-text-muted">Selected</span>
                    <span className="section-title text-text">{selectedCount} / {totalVisibleCount}</span>
                </div>

                <div className="w-px h-8 bg-border" />

                <div className="flex items-center gap-2">
                    <ActionButton icon={<Bookmark size={16} />} label="Pin" onClick={onPinSelected} disabled={selectedCount === 0} />
                    <ActionButton icon={isViewingArchive ? <ArchiveRestore size={16} /> : <Archive size={16} />} label={isViewingArchive ? 'Restore' : 'Archive'} onClick={onArchiveSelected} disabled={selectedCount === 0} />
                    <ActionButton icon={<FileJson size={16} />} label="Export" onClick={handleExport} disabled={selectedCount === 0} />
                    <div className="w-px h-6 bg-border" />
                    <ActionButton icon={<ShieldAlert size={16} />} label="Delete" onClick={onDeleteSelected} variant="danger" disabled={selectedCount === 0} />
                </div>

                <Button
                    onClick={(e) => { e.stopPropagation(); onCancel(); }}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-8 h-8 p-0"
                    aria-label="Close"
                >
                    <X size={14} />
                </Button>
            </Card>
        </div>
    );
};

const ActionButton: React.FC<{ icon: React.ReactNode, label: string, onClick: () => void, variant?: 'normal' | 'danger', disabled?: boolean }> = ({ icon, label, onClick, variant = 'normal', disabled }) => (
    <Button 
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!disabled) onClick(); }}
        disabled={disabled}
        type="button"
        variant={variant === 'danger' ? 'destructive' : 'secondary'}
        size="sm"
        className={cn('w-10 h-10 p-0', variant === 'danger' ? '' : 'text-text-muted')}
        aria-label={label}
        title={label}
    >
        {icon}
    </Button>
);
