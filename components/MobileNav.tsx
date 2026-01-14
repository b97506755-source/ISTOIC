
import React, { memo } from 'react';
import { type FeatureID, FEATURES } from '../constants';
import { Settings } from 'lucide-react';
import { useNavigationIntelligence } from '../hooks/useNavigationIntelligence';

interface MobileNavProps {
  activeFeature: FeatureID;
  setActiveFeature: (feature: FeatureID) => void;
  chatLogic?: any;
}

export const MobileNav: React.FC<MobileNavProps> = memo(({ activeFeature, setActiveFeature }) => {
  const { shouldShowNav, isInputFocused } = useNavigationIntelligence();

  // FIX: Ensure visibility logic handles focus correctly on mobile
  const isVisible = shouldShowNav && !isInputFocused;

  return (
    <div 
      className={`
        md:hidden fixed left-1/2 -translate-x-1/2 
        transition-all cubic-bezier(0.2, 0.8, 0.2, 1) 
        will-change-transform w-auto max-w-[calc(100vw-32px)]
        z-[1000] ${isVisible ? 'pointer-events-auto' : 'pointer-events-none'}
        /* SAFE AREA FIX: Calculate bottom position including notch area + margin */
        ${isVisible 
          ? 'bottom-[calc(1.2rem+env(safe-area-inset-bottom))] opacity-100 translate-y-0 scale-100 duration-500 delay-100' 
          : 'bottom-0 opacity-0 translate-y-10 scale-90 duration-300' 
        }
      `}
      role="navigation"
      aria-label="Navigasi Utama"
    >
      <nav className="
        flex items-center gap-1 p-2
        bg-skin-card/90 backdrop-blur-2xl 
        border border-skin-border/80 
        rounded-[24px] 
        shadow-[0_12px_40px_-14px_rgba(0,0,0,0.2)]
        ring-1 ring-black/5 dark:ring-white/5
      ">
        
        {FEATURES.map((f) => {
          const isActive = activeFeature === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFeature(f.id as FeatureID)}
              aria-label={`Buka ${f.name}`}
              aria-current={isActive ? 'page' : undefined}
              className={`
                relative w-12 h-12 flex flex-col items-center justify-center rounded-[18px] 
                transition-all duration-300 group
                pointer-events-auto
                ${isActive 
                  ? 'bg-accent/10 text-accent shadow-[0_10px_24px_-16px_var(--accent-glow)]' 
                  : 'text-text-muted hover:text-text hover:bg-surface border border-transparent'}
              `}
            >
              <div className={`transition-transform duration-300 ${isActive ? '-translate-y-1 scale-110' : 'group-active:scale-95'}`}>
                {React.cloneElement(f.icon as React.ReactElement<any>, { size: 20, strokeWidth: isActive ? 2.5 : 2 })}
              </div>
            </button>
          );
        })}

        <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10 mx-1"></div>

        <div className="flex items-center gap-1">
            <button 
                onClick={() => setActiveFeature('settings')} 
                aria-label="Buka Pengaturan"
                className={`
                    w-12 h-12 flex items-center justify-center rounded-[18px] transition-all pointer-events-auto
                    ${activeFeature === 'settings' 
                        ? 'bg-accent text-text-invert shadow-lg scale-105' 
                        : 'text-text-muted hover:text-text hover:bg-surface'}
                `}
            >
                <Settings size={20} className={activeFeature === 'settings' ? 'animate-spin-slow' : ''} />
            </button>
        </div>

      </nav>
    </div>
  );
});


