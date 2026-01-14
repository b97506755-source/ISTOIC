import React, { memo, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Markdown from 'react-markdown';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Flame, Brain, Copy, Check, AlertTriangle, CheckCheck, Clock, ChevronDown } from 'lucide-react';
import type { ChatMessage } from '../../../types';
import { AIProviderInfo } from './AIProviderInfo';
import { generateImage } from '../../../services/geminiService';

type RetryContext = {
  prompt: string;
  attachment?: { data: string; mimeType: string };
  persona?: 'hanisah' | 'stoic';
  modelId?: string;
  threadId?: string;
};

const TypingIndicator = ({ personaMode }: { personaMode: 'hanisah' | 'stoic' }) => (
  <div className="flex justify-start mb-4 px-1 animate-fade-in w-full">
    <div className="flex flex-col gap-2 mr-3 shrink-0 mt-1">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow border border-[color:var(--border)] bg-[var(--surface)] text-[var(--accent)]">
        {personaMode === 'hanisah' ? <Flame size={16} /> : <Brain size={16} />}
      </div>
    </div>
    <div className="bg-[var(--surface)] border border-[color:var(--border)] rounded-[20px] px-4 py-3 flex items-center gap-1.5 shadow-sm h-[46px]">
      <div className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce"></div>
    </div>
  </div>
);

const ImageGenerationCard = ({ prompt }: { prompt: string }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    setStatus('loading');
    try {
      const result = await generateImage(prompt);
      if (result) {
        setImageUrl(result);
        setStatus('done');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="mt-3 p-3 rounded-xl border border-[color:var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-semibold text-[var(--text-muted)]">Generate Image</span>
        <button
          onClick={handleGenerate}
          disabled={status === 'loading'}
          className="text-[12px] px-3 py-1 rounded-lg border border-[color:var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-50"
        >
          {status === 'loading' ? 'Working...' : status === 'done' ? 'Regenerate' : 'Start'}
        </button>
      </div>
      <p className="text-[13px] text-[var(--text)] opacity-80 mb-2">"{prompt}"</p>
      {imageUrl && <img src={imageUrl} alt={prompt} className="w-full rounded-lg border border-[color:var(--border)] shadow-sm" />}
      {status === 'error' && <p className="text-[12px] text-[var(--danger)] mt-2">Image generation failed. Try again.</p>}
    </div>
  );
};

const MessageBubble = memo(
  ({
    msg,
    personaMode,
    isStreaming,
    onRetry
  }: {
    msg: ChatMessage;
    personaMode: 'hanisah' | 'stoic';
    isStreaming: boolean;
    onRetry?: (messageId: string, retryContext: RetryContext) => void;
  }) => {
    const [copied, setCopied] = useState(false);
    const [showThought, setShowThought] = useState(false);

    const isModel = msg.role === 'model' || (msg.role as string) === 'assistant';
    const isError = msg.metadata?.status === 'error';
    const retryContext = msg.metadata?.retryContext as RetryContext | undefined;

    const textContent: string = useMemo(() => {
      if (typeof msg.text === 'string') return msg.text;
      return '';
    }, [msg.text]);

    const { thought, content, imagePrompt } = useMemo(() => {
      let text = textContent;
      let thoughtContent: string | null = null;
      if (text.includes('<think>')) {
        const hasClosing = text.includes('</think>');
        if (hasClosing) {
          const parts = text.split('</think>');
          thoughtContent = parts[0].replace('<think>', '').trim();
          text = parts[1]?.trim() || '';
        } else {
          thoughtContent = text.replace('<think>', '').trim();
          text = '';
        }
      }

      let imagePrompt: string | null = null;
      const imgMatch = text.match(/!!IMG:(.*?)!!/);
      if (imgMatch) {
        imagePrompt = imgMatch[1]?.trim() || null;
        text = text.replace(imgMatch[0], '').trim();
      }

      return { thought: thoughtContent, content: text, imagePrompt };
    }, [textContent]);

    const timestamp = useMemo(() => {
      if (msg.metadata?.createdAt) {
        return new Date(msg.metadata.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, [msg.metadata?.createdAt]);

    const handleCopy = () => {
      if (content) {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    };

    if (isModel && !content && !isStreaming && !thought && !isError) return null;

    const bubbleClasses = isModel
      ? 'bg-[var(--surface)] text-[var(--text)] border border-[color:var(--border)]'
      : 'bg-[var(--accent)] text-[var(--text-invert)] border border-[color:var(--accent)]/40';

    return (
      <div className={`flex w-full mb-5 ${isModel ? 'justify-start' : 'justify-end'} px-1`}>
        {isModel && (
          <div className="flex flex-col gap-2 mr-3 shrink-0 mt-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow border border-[color:var(--border)] bg-[var(--surface)] text-[var(--accent)]">
              {isError ? <AlertTriangle size={16} /> : personaMode === 'hanisah' ? <Flame size={16} /> : <Brain size={16} />}
            </div>
          </div>
        )}

        <div className={`flex flex-col max-w-[88%] sm:max-w-[80%] lg:max-w-[75%] min-w-0 ${isModel ? 'items-start' : 'items-end'}`}>
          <div className={`flex items-start gap-2 ${isModel ? 'flex-row' : 'flex-row-reverse'}`}>
            <div className={`relative px-4 py-3 rounded-2xl shadow-sm text-base leading-relaxed ${bubbleClasses}`}>
              {thought && (
                <button
                  className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-muted)] mb-2"
                  onClick={() => setShowThought((prev) => !prev)}
                  aria-expanded={showThought}
                >
                  <ChevronDown size={14} className={`transition-transform ${showThought ? 'rotate-180' : ''}`} />
                  Reasoning
                </button>
              )}
              {thought && showThought && (
                <div className="mb-3 p-3 rounded-xl bg-[var(--surface)] border border-[color:var(--border)] text-sm text-[var(--text-muted)] whitespace-pre-wrap">
                  {thought}
                </div>
              )}

              {content && (
                <div className="prose dark:prose-invert prose-sm max-w-none break-words text-[var(--text)]">
                  <Markdown
                    components={{
                      a: ({ children, href }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--accent)] underline decoration-[var(--accent)]"
                        >
                          {children}
                        </a>
                      ),
                      code({ inline, className, children, ...props }: any) {
                        if (inline) {
                          return (
                            <code className="px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text)] text-[12px]" {...props}>
                              {children}
                            </code>
                          );
                        }
                        const lang = /language-(\w+)/.exec(className || '');
                        return (
                          <pre className="bg-[var(--surface-2)] border border-[color:var(--border)] rounded-xl p-3 overflow-x-auto text-[12px]">
                            <code className={lang ? `language-${lang[1]}` : ''}>{children}</code>
                          </pre>
                        );
                      }
                    }}
                  >
                    {content}
                  </Markdown>
                  {isStreaming && isModel && <span className="inline-block w-2 h-4 bg-[var(--accent)] align-middle ml-1 animate-pulse"></span>}
                </div>
              )}

              {imagePrompt && <ImageGenerationCard prompt={imagePrompt} />}

              {isError && retryContext && onRetry && (
                <div className="mt-3">
                  <button
                    onClick={() => onRetry(msg.id, retryContext)}
                    className="px-3 py-1.5 rounded-lg border border-[color:var(--accent)] text-[var(--accent)] text-[12px] font-semibold hover:bg-[var(--accent)]/10 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            {isModel && content && (
              <button
                onClick={handleCopy}
                className="p-2 rounded-full hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-all shrink-0 self-start"
                title="Copy text"
              >
                {copied ? <Check size={14} className="text-[var(--success)]" /> : <Copy size={14} />}
              </button>
            )}
          </div>

          <div className={`flex items-center gap-3 mt-1.5 px-2 select-none ${isModel ? 'justify-start' : 'justify-end'}`}>
            {isModel && (
              <AIProviderInfo
                metadata={msg.metadata}
                isHydra={!!(msg.metadata?.model === 'auto-best' || msg.metadata?.model?.toString().toUpperCase().includes('HYDRA'))}
                className="mt-0"
              />
            )}

            <div className="flex items-center gap-1.5 opacity-80 text-[12px] text-[var(--text-muted)]">
              <span>{timestamp}</span>
              {!isModel && (
                <>
                  {(msg.metadata?.status === 'success' || !msg.metadata?.status) && <CheckCheck size={12} />}
                  {msg.metadata?.status === 'loading' && <Clock size={12} className="animate-pulse" />}
                  {msg.metadata?.status === 'error' && <AlertTriangle size={12} className="text-[var(--danger)]" />}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    const getVal = (m: ChatMessage): string => {
      const textVal = m.text;
      if (typeof textVal === 'string') return textVal;
      return '';
    };
    const prevText = getVal(prev.msg);
    const nextText = getVal(next.msg);

    const prevMeta = JSON.stringify(prev.msg.metadata);
    const nextMeta = JSON.stringify(next.msg.metadata);

    return prevText === nextText && prev.isStreaming === next.isStreaming && prevMeta === nextMeta;
  }
);

const itemKey = (index: number, item: any) => item.id || index;

interface ChatWindowProps {
  messages: ChatMessage[];
  personaMode: 'hanisah' | 'stoic';
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onRetry?: (messageId: string, retryContext: RetryContext) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = memo(
  ({ messages, personaMode, isLoading, messagesEndRef, onRetry }) => {
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);

    const allItems = useMemo(() => {
      if (isLoading) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'user') {
          return [...messages, { id: 'loading-indicator', role: 'model', text: '', isLoader: true } as any];
        }
      }
      return messages;
    }, [messages, isLoading]);

    const contextValue = useMemo(
      () => ({
        personaMode,
        isLoading,
        onRetry
      }),
      [personaMode, isLoading, onRetry]
    );

    const Footer = useMemo(() => {
      return () => <div className="h-4" ref={messagesEndRef} />;
    }, [messagesEndRef]);

    const handleAtBottomChange = useCallback((atBottom: boolean) => {
      setIsAtBottom(atBottom);
    }, []);

    return (
      <div className="h-full w-full min-h-0 flex-1 flex flex-col relative bg-[var(--bg)]" style={{ overscrollBehavior: 'contain' }}>
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: '100%', width: '100%' }}
          data={allItems}
          context={contextValue}
          followOutput={isAtBottom ? 'smooth' : false}
          atBottomStateChange={handleAtBottomChange}
          alignToBottom
          atBottomThreshold={80}
          components={{
            Footer: Footer
          }}
          increaseViewportBy={{ top: 200, bottom: 400 }}
          computeItemKey={itemKey}
          itemContent={(index, msg, ctx) => {
            if ((msg as any).isLoader) {
              return (
                <div className="pb-2">
                  <TypingIndicator personaMode={ctx.personaMode} />
                </div>
              );
            }
            const isLast = index === allItems.length - 1;

            return (
              <div className="py-2 px-2 md:px-4 w-full">
                <MessageBubble
                  key={msg.id || index}
                  msg={msg}
                  personaMode={ctx.personaMode}
                  isStreaming={ctx.isLoading && isLast}
                  onRetry={ctx.onRetry}
                />
              </div>
            );
          }}
        />
      </div>
    );
  }
);








