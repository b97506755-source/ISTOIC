
import { debugService } from './debugService';
import { SECURITY_MATRIX } from './securityMatrix';

export type Provider = 'GEMINI' | 'GROQ' | 'OPENAI' | 'DEEPSEEK' | 'MISTRAL' | 'OPENROUTER' | 'ELEVENLABS' | 'HUGGINGFACE';
type KeyStatus = 'ACTIVE' | 'COOLDOWN';

interface KeyRecord {
  cloakedKey: string;
  provider: Provider;
  status: KeyStatus;
  fails: number;
  cooldownUntil: number;
  id: string; // Unique ID for tracking
}

export interface ProviderStatus {
    id: string;
    status: 'HEALTHY' | 'COOLDOWN';
    keyCount: number;
    cooldownRemaining: number;
}

export class HydraVault {
  private vault: Record<string, KeyRecord[]> = {};
  // V20 ROUND ROBIN COUNTERS
  private counters: Record<string, number> = {};

  constructor() {
      this.refreshPools();
  }

  public refreshPools() {
    const rawEnv = { 
        ...((typeof process !== 'undefined' && process.env) || {}),
        ...((import.meta as any).env || {})
    };

    const providers: Provider[] = ['GEMINI', 'GROQ', 'OPENAI', 'DEEPSEEK', 'MISTRAL', 'OPENROUTER', 'ELEVENLABS', 'HUGGINGFACE'];

    providers.forEach(provider => {
        const keys = new Set<string>(); 
        
        const addKey = (val: string | undefined) => {
            if (!val || typeof val !== 'string' || val.includes("GANTI_DENGAN")) return;
            val.split(/[\n,;]+/).forEach(part => {
                const clean = part.replace(/['"\s]/g, '').trim();
                if (clean.length > 8) keys.add(clean);
            });
        };

        // Aggressive Scan
        addKey(rawEnv[`VITE_${provider}_API_KEY`]);
        addKey(rawEnv[`${provider}_API_KEY`]);
        addKey(rawEnv[provider]);

        if (provider === 'GEMINI') {
            addKey(rawEnv['GOOGLE_API_KEY']);
            addKey(rawEnv['VITE_GOOGLE_API_KEY']);
            addKey(rawEnv['API_KEY']); 
        }
        if (provider === 'HUGGINGFACE') addKey(rawEnv['HF_TOKEN']);

        this.vault[provider] = Array.from(keys).map((k, index) => ({
            cloakedKey: SECURITY_MATRIX.cloak(k), 
            provider,
            status: 'ACTIVE',
            fails: 0,
            cooldownUntil: 0,
            id: `${provider}_${index}`
        }));
        
        // Initialize counter for Round Robin if not exists
        if (this.counters[provider] === undefined) {
            this.counters[provider] = 0;
        }
    });
    
    const totalKeys = Object.values(this.vault).flat().length;
    debugService.log('KERNEL', 'HYDRA_V20', 'INIT', `Titanium Vault Locked. ${totalKeys} keys engaged in Round-Robin.`);
  }

  /**
   * V20 ROUND ROBIN STRATEGY
   * Ensures perfect rotation. Key 1 -> Key 2 -> Key 3 -> Key 1
   */
  public getKey(provider: Provider): string | null {
    const pool = this.vault[provider];
    if (!pool || pool.length === 0) return null;

    const now = Date.now();
    
    // 1. Auto-Heal Cooldowns
    pool.forEach(k => {
        if (k.status === 'COOLDOWN' && k.cooldownUntil <= now) {
            k.status = 'ACTIVE';
            k.fails = 0;
            debugService.log('INFO', 'HYDRA_HEAL', 'RECOVER', `Key ${k.id} recovered from cooldown.`);
        }
    });

    const activeKeys = pool.filter((k) => k.status === 'ACTIVE');
    
    if (activeKeys.length === 0) {
        debugService.log('WARN', 'HYDRA_FAIL', 'DEPLETED', `All keys for ${provider} are in cooldown.`);
        // V20 Emergency Bypass: If all dead, force use the "least recently failed" (risk taking)
        // Or simply return null to trigger provider failover in Kernel.
        return null; 
    }

    // 2. Round Robin Selection
    let currentIndex = this.counters[provider] % activeKeys.length;
    const selectedKey = activeKeys[currentIndex];

    // Increment for next time
    this.counters[provider] = (currentIndex + 1) % activeKeys.length;

    // debugService.log('TRACE', 'HYDRA_ROTATE', 'SELECT', `Rotating to ${selectedKey.id} (Index ${currentIndex})`);

    return SECURITY_MATRIX.decloak(selectedKey.cloakedKey);
  }

  public reportFailure(provider: Provider, plainKeyString: string, error: any): void {
    const pool = this.vault[provider];
    const searchHash = SECURITY_MATRIX.cloak(plainKeyString);
    const record = pool?.find((k) => k.cloakedKey === searchHash);
    if (!record) return;

    record.fails++;
    record.status = 'COOLDOWN';
    
    // SMART PENALTY V20
    // Rate Limit (429) -> 5 mins
    // Overloaded (503) -> 1 min
    // Other -> 30 sec (Quick retry)
    const errStr = JSON.stringify(error).toLowerCase();
    let penaltyMs = 30000; // Default 30s

    if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('limit')) {
        penaltyMs = 300000; // 5 mins
    } else if (errStr.includes('503') || errStr.includes('overloaded')) {
        penaltyMs = 60000; // 1 min
    }
    
    record.cooldownUntil = Date.now() + penaltyMs;
    
    debugService.log('WARN', 'HYDRA_PENALTY', 'COOLDOWN', `${provider} Key ${record.id} penalized for ${penaltyMs/1000}s. Reason: ${error.message?.slice(0, 50)}`);
  }

  public reportSuccess(provider: Provider) {
      // V20: Success keeps the key healthy. No action needed for Round Robin.
  }

  public isProviderHealthy(provider: Provider): boolean {
      return (this.vault[provider] || []).some(k => k.status === 'ACTIVE');
  }

  public getAllProviderStatuses(): ProviderStatus[] {
      const now = Date.now();
      return Object.keys(this.vault).map(id => {
          const pool = this.vault[id];
          const cooldowns = pool.filter(k => k.status === 'COOLDOWN');
          const minRemaining = cooldowns.length > 0 
            ? Math.ceil(Math.min(...cooldowns.map(k => k.cooldownUntil - now)) / 60000)
            : 0;

          return {
            id, 
            status: this.isProviderHealthy(id as Provider) ? 'HEALTHY' : 'COOLDOWN', 
            keyCount: pool.length,
            cooldownRemaining: minRemaining > 0 ? minRemaining : 0
          };
      });
  }
}

export const GLOBAL_VAULT = new HydraVault();
