import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HANISAH_BRAIN } from '../services/melsaBrain';

// Mock localStorage for Persona checks
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('HANISAH_BRAIN Logic Core', () => {
  
  beforeEach(() => {
    localStorage.clear();
    // Default language mock
    localStorage.setItem('app_language', 'id');
  });

  it('should generate correct System Instruction for HANISAH persona', () => {
    const prompt = HANISAH_BRAIN.getSystemInstruction('hanisah');
    expect(prompt).toContain('SYSTEM_IDENTITY: HANISAH_V25_TITANIUM');
    expect(prompt).toContain('Hyper-Intelligent Digital Partner');
  });

  it('should generate correct System Instruction for STOIC persona', () => {
    const prompt = HANISAH_BRAIN.getSystemInstruction('stoic');
    expect(prompt).toContain('SYSTEM_IDENTITY: STOIC_V25_TITANIUM');
    expect(prompt).toContain('Marcus Aurelius meets Quantum AI');
  });

  it('should include user context when provided', () => {
    const context = "User is stressed about coding.";
    const prompt = HANISAH_BRAIN.getSystemInstruction('stoic', context);
    expect(prompt).toContain('=== ACTIVE MEMORY (RAG CONTEXT) ===');
    expect(prompt).toContain(context);
  });

  it('should respect manual prompt overrides from localStorage', () => {
    const override = "Custom Override Prompt Logic";
    localStorage.setItem('hanisah_system_prompt', override);
    
    const prompt = HANISAH_BRAIN.getSystemInstruction('hanisah');
    expect(prompt).toContain(override);
  });
});