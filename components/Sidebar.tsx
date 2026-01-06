
// ... (imports remain same)
import React, { useState, useEffect, memo } from 'react';
import { type FeatureID, FEATURES } from '../constants';
import useLocalStorage from '../hooks/useLocalStorage';
import { Settings, Flame, Cpu, Activity, AlertTriangle, PanelLeft, PanelLeftClose, ChevronRight, Phone } from 'lucide-react';
import { useNavigationIntelligence } from '../hooks/useNavigationIntelligence';
import { getText, getLang } from '../services/i18n';
import { debugService } from '../services/debugService';
import { UI_REGISTRY, FN_REGISTRY, UI_ID } from '../constants/registry';
import { useFeatures } from '../contexts/FeatureContext';

interface SidebarProps {
  activeFeature: FeatureID;
  setActiveFeature: (feature: FeatureID) => void;
  chatLogic: any;
  onOpenTeleponan?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = memo(({ activeFeature, setActiveFeature, onOpenTeleponan }) => {
  const [personaMode] = useLocalStorage<'hanisah' | 'stoic'>('ai_persona_mode', 'hanisah');
  
  // Persistent Expansion State
  const [isExpanded, setIsExpanded] = useLocalStorage<boolean>('sidebar_expanded', false);
  
  const { isForcedStealth } = useNavigationIntelligence();
  const { features } = useFeatures();
  
  const [healthScore, setHealthScore] = useState(100);
  const [healthColor, setHealthColor] = useState('bg-emerald-500');
  
  // UI Matrix State for disabling buttons
  const [uiMatrix, setUiMatrix] = useState<Record<string, any>>(debugService.getUIMatrix());

  useEffect(() => {
      // If Auto Diagnostics is disabled, do not poll system health.
      // Immediate cleanup when flag changes.
      if (!features.AUTO_DIAGNOSTICS) {
          // Reset visual state when off
          setHealthScore(0);
          setHealthColor('bg-neutral-600');
          return;
      }

      const checkHealth = () => {
          const stats = debugService.getSystemHealth();
          let score = 100;
          if (stats.avgLatency > 500) score -= 10;
          if (stats.avgLatency > 1500) score -= 20;
          score -= (stats.errorCount * 5);
          if (stats.memoryMb && stats.memoryMb > 500) score -= 10;
          score = Math.max(0, Math.min(100, score));
          
          setHealthScore(score);
          if (score >= 80) setHealthColor('bg-emerald-500 shadow-[0_0_10px_#10b981]');
          else if (score >= 50) setHealthColor('bg-amber-500 shadow-[0_0_10px_#f59e0b]');
          else setHealthColor('bg-red-500 shadow-[0_0_10px_#ef4444]');
      };

      // Run once immediately
      checkHealth();

      const interval = setInterval(checkHealth, 2000);
      const unsubscribe = debugService.subscribeUI((state) => setUiMatrix(state)); // Listen to matrix updates
      
      return () => { 
          clearInterval(interval);
          unsubscribe(); 
      };
  }, [features.AUTO_DIAGNOSTICS]);
  
  const getLabel = (id: string) => {
      const keyMap: Record<string, string> = {
          dashboard: 'dashboard',
          notes: 'notes',
          chat: 'chat',
          tools: 'tools',
          system: 'system',
          settings: 'settings',
          raw: 'raw'
      };
      const transKey = keyMap[id];
      // Simple capitalization fallback if translation missing or for RAW
      if (id === 'raw') return "RAW_MODE";
      return transKey ? getText('sidebar', transKey) : id.toUpperCase();
  };

  const handleNavLogo = () => {
      if (debugService.logAction(UI_REGISTRY.SIDEBAR_BTN_LOGO, FN_REGISTRY.NAVIGATE_TO_FEATURE, 'DASHBOARD')) {
          setActiveFeature('dashboard');
      }
  };

  const handleNavSystem = () => {
      if (debugService.logAction(UI_REGISTRY.SIDEBAR_BTN_SYSTEM, FN_REGISTRY.NAVIGATE_TO_FEATURE, 'SYSTEM')) {
          setActiveFeature('system');
      }
  };

  const handleNavSettings = () => {
      if (debugService.logAction(UI_REGISTRY.SIDEBAR_BTN_SETTINGS, FN_REGISTRY.NAVIGATE_TO_FEATURE, 'SETTINGS')) {
          setActiveFeature('settings');
      }
  };

  const handleToggleSidebar = () => {
      if (debugService.logAction(UI_REGISTRY.SIDEBAR_BTN_TOGGLE, FN_REGISTRY.UI_TOGGLE_SIDEBAR, isExpanded ? 'COLLAPSE' : 'EXPAND')) {
          setIsExpanded(prev => !prev);
      }
  };

  return (
    <>
      {/* Dynamic Spacer for Content Pushing */}
      <div 
        className={`hidden md:block h-full flex-none shrink-0 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isExpanded ? 'w-[280px]' : 'w-[88px]'}`} 
      />

      <aside 
        className={`
          hidden md:flex flex-col fixed top-0 left-0 bottom-0 
          z-[1200] 
          /* UPDATED: Semantic Token Usage */
          bg-skin-card/80 backdrop-blur-2xl 
          border-r border-skin-border
          transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
          ${isExpanded ? 'w-[280px] shadow-[20px_0_40px_-10px_rgba(0,0,0,0.3)]' : 'w-[88px]'}
          ${isForcedStealth ? 'opacity-0 pointer-events-none -translate-x-full' : 'opacity-100 translate-x-0'}
        `}
        role="navigation"
        aria-label="Main Navigation"
      >
        <div className="flex flex-col h-full w-full overflow-hidden py-6 pt-safe pb-safe relative">
          
          {/* Ambient Glow Top */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />

          {/* LOGO & TOGGLE */}
          <div className={`px-6 mb-10 transition-all duration-500 flex flex-col relative z-10 ${isExpanded ? 'items-start' : 'items-center'}`}>
              <div className="flex items-center justify-between w-full">
                  <button 
                    onClick={handleNavLogo}
                    aria-label="Go to Dashboard"
                    className="relative group outline-none"
                  >
                    <div className={`
                      shrink-0 w-10 h-10 rounded-[14px] flex items-center justify-center 
                      /* UPDATED: Semantic Tokens for Logo */
                      bg-gradient-to-br from-skin-card to-skin-surface
                      border border-skin-border
                      shadow-sm group-hover:shadow-[0_0_20px_var(--accent-glow)] group-hover:border-accent/50
                      transition-all duration-500 
                      relative overflow-hidden group-hover:scale-105
                    `}>
                      <div className={`text-skin-text transition-colors duration-300 group-hover:text-accent`}>
                          {personaMode === 'hanisah' ? <Flame size={20} strokeWidth={2.5} /> : <Cpu size={20} strokeWidth={2.5} />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                      <button 
                        onClick={handleToggleSidebar}
                        className="p-2 rounded-lg text-skin-muted hover:text-skin-text hover:bg-skin-surface transition-all"
                        aria-label="Collapse Sidebar"
                      >
                          <PanelLeftClose size={18} />
                      </button>
                  )}
              </div>

              {/* Text Label */}
              <div className={`mt-5 overflow-hidden whitespace-nowrap transition-all duration-500 flex flex-col ${isExpanded ? 'opacity-100 max-h-[100px] translate-x-0' : 'opacity-0 max-h-0 -translate-x-4 pointer-events-none'}`}>
                  <h1 className="text-lg font-black tracking-tighter text-skin-text leading-none uppercase flex items-center gap-1">
                    ISTOIC <span className="text-accent">ASSISTANT</span> <span className="px-1.5 py-0.5 rounded bg-accent/10 text-[8px] text-accent tracking-widest border border-accent/20">V15.0</span>
                  </h1>
                  <p className="text-[9px] font-medium text-skin-muted mt-1 pl-0.5">Personal AI OS</p>
              </div>

              {!isExpanded && (
                  <button 
                    onClick={handleToggleSidebar}
                    className="mt-8 p-2 rounded-lg text-skin-muted hover:text-accent hover:bg-accent/10 transition-all"
                    aria-label="Expand Sidebar"
                  >
                      <PanelLeft size={20} strokeWidth={1.5} />
                  </button>
              )}
          </div>

          {/* NAVIGATION LINKS */}
          <nav className="flex-1 flex flex-col gap-2 px-3 w-full relative z-10" aria-label="Feature Links">
            {FEATURES.map((feature) => {
              const isActive = activeFeature === feature.id;
              const label = getLabel(feature.id);
              const uiId = (UI_REGISTRY as any)[`SIDEBAR_BTN_${feature.id.toUpperCase()}`] || UI_REGISTRY.SIDEBAR_BTN_DASHBOARD;
              const isDisabled = uiMatrix[uiId]?.status === 'DISABLED';
              
              const handleClick = () => {
                  if (!isDisabled) {
                      if (debugService.logAction(uiId, FN_REGISTRY.NAVIGATE_TO_FEATURE, feature.id)) {
                          setActiveFeature(feature.id);
                      }
                  }
              };

              return (
                <button
                  key={feature.id}
                  onClick={handleClick}
                  aria-label={label}
                  disabled={isDisabled}
                  aria-current={isActive ? 'page' : undefined}
                  className={`
                    relative flex items-center rounded-[16px] transition-all duration-300 group overflow-hidden border
                    ${isExpanded ? 'w-full px-4 py-3 gap-4' : 'w-12 h-12 justify-center mx-auto'}
                    ${isDisabled 
                        ? 'opacity-40 cursor-not-allowed bg-red-500/5 grayscale border-transparent' 
                        : isActive 
                            ? 'bg-gradient-to-r from-accent/10 to-transparent border-accent/20 text-accent shadow-[0_0_15px_-5px_var(--accent-glow)]' 
                            : 'bg-transparent border-transparent text-skin-muted hover:text-skin-text hover:bg-skin-surface'
                    }
                  `}
                  title={!isExpanded ? label : undefined}
                >
                  {/* Active Indicator Line */}
                  {isActive && !isDisabled && (
                    <div className={`absolute bg-accent shadow-[0_0_8px_var(--accent-color)] ${isExpanded ? 'left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full' : 'left-1 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full'}`} />
                  )}

                  <div className={`transition-transform duration-300 relative z-10 ${isActive && !isDisabled ? 'scale-100' : 'group-hover:scale-110'}`}>
                    {isDisabled 
                        ? <AlertTriangle size={18} className="text-red-500" /> 
                        : React.cloneElement(feature.icon as React.ReactElement<any>, { size: 20, strokeWidth: isActive ? 2.5 : 2 })
                    }
                  </div>

                  <div className={`overflow-hidden whitespace-nowrap transition-all duration-300 flex-1 flex justify-between items-center ${isExpanded ? 'opacity-100 max-w-full pl-2' : 'opacity-0 max-w-0'}`}>
                    <span className={`text-[10px] font-bold tracking-[0.15em] uppercase ${isDisabled ? 'text-red-500 line-through decoration-red-500/50' : ''}`}>
                        {label}
                    </span>
                    {isActive && <ChevronRight size={12} className="text-accent opacity-50" />}
                  </div>
                </button>
              );
            })}

            {/* SECURE CALL BUTTON */}
            {onOpenTeleponan && (
                <button
                  onClick={onOpenTeleponan}
                  className={`
                    relative flex items-center rounded-[16px] transition-all duration-300 group overflow-hidden border border-green-500/10 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/30 mt-2
                    ${isExpanded ? 'w-full px-4 py-3 gap-4' : 'w-12 h-12 justify-center mx-auto'}
                  `}
                  title={!isExpanded ? "SECURE CALL" : undefined}
                >
                  <div className={`transition-transform duration-300 relative z-10 group-hover:scale-110`}>
                    <Phone size={20} className="text-green-500" strokeWidth={2} />
                  </div>
                  <div className={`overflow-hidden whitespace-nowrap transition-all duration-300 flex-1 flex justify-between items-center ${isExpanded ? 'opacity-100 max-w-full pl-2' : 'opacity-0 max-w-0'}`}>
                    <span className={`text-[10px] font-bold tracking-[0.15em] uppercase text-green-500`}>
                        TELEPONAN
                    </span>
                  </div>
                </button>
            )}
          </nav>

          {/* SYSTEM FOOTER */}
          <div className="mt-auto px-4 flex flex-col gap-4 relative z-10">
             {/* System Status */}
             <button 
                onClick={handleNavSystem}
                className={`
                    rounded-[20px] border transition-all w-full text-left group relative overflow-hidden
                    ${isExpanded 
                        ? 'p-3 bg-skin-surface border-skin-border hover:border-accent/30' 
                        : 'p-0 border-transparent bg-transparent justify-center flex'
                    }
                `}
                title={!isExpanded ? `Integrity: ${healthScore}%` : undefined}
             >
                {isExpanded ? (
                    <>
                        <div className="flex justify-between items-center text-[9px] font-black text-skin-muted uppercase tracking-widest mb-2 group-hover:text-skin-text transition-colors relative z-10">
                            <span className="flex items-center gap-2">
                                {features.AUTO_DIAGNOSTICS ? <Activity size={12} className={healthScore < 80 ? 'animate-pulse text-amber-500' : 'text-emerald-500'}/> : <AlertTriangle size={12} />} 
                                SYSTEM_HEALTH
                            </span>
                            <span className={`font-mono ${healthScore < 80 ? 'text-red-500' : 'text-emerald-500'}`}>{healthScore}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-skin-main rounded-full overflow-hidden relative z-10">
                            <div className={`h-full ${features.AUTO_DIAGNOSTICS ? healthColor : 'bg-neutral-600'} w-full transition-all duration-1000 ease-out`} style={{ width: `${healthScore}%` }}></div>
                        </div>
                    </>
                ) : (
                    <div className={`w-2.5 h-2.5 rounded-full ${features.AUTO_DIAGNOSTICS ? healthColor : 'bg-neutral-600'} transition-all duration-500 mb-4`}></div>
                )}
             </button>

             <div className={`h-[1px] bg-gradient-to-r from-transparent via-skin-border to-transparent mx-4 transition-all ${isExpanded ? 'opacity-100' : 'opacity-0'}`} />

             <button 
                onClick={handleNavSettings}
                className={`
                  flex items-center rounded-[16px] transition-all duration-300 group
                  ${isExpanded ? 'w-full px-4 py-3 gap-3 bg-transparent hover:bg-skin-surface text-skin-muted hover:text-skin-text' : 'w-12 h-12 justify-center mx-auto hover:bg-skin-surface text-skin-muted'}
                  ${activeFeature === 'settings' ? 'text-accent' : ''}
                `}
                title={!isExpanded ? getLabel('settings') : undefined}
             >
                <Settings size={20} className={activeFeature === 'settings' ? 'animate-spin-slow text-accent' : 'group-hover:rotate-45 transition-transform'} strokeWidth={1.5} />
                <div className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'}`}>
                    <span className="text-[10px] font-bold tracking-[0.15em] uppercase">{getLabel('settings')}</span>
                </div>
             </button>
          </div>

        </div>
      </aside>
    </>
  );
});
