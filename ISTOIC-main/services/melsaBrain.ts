import { getMemoryLayer } from "./brain/memory";
import { getReasoningLayer } from "./brain/reasoning";
import { getPlanningLayer } from "./brain/planning";
import { Note } from "../types";

export const HANISAH_BRAIN = {
  getSystemInstruction: async (persona: 'hanisah' | 'stoic' = 'hanisah', query: string = '', notes: Note[] | string = []) => {
    try {
        // Check for manual override
        const localOverride = typeof localStorage !== 'undefined' ? localStorage.getItem(`${persona}_system_prompt`) : null;
        if (localOverride) return localOverride;

        const reasoning = getReasoningLayer(persona);
        const planning = getPlanningLayer(persona);
        
        // Pass notes safely
        const memory = await getMemoryLayer(query, notes);

        return `
${reasoning}
${memory}
${planning}

[FINAL_DIRECTIVE]
Synthesize the layers above to provide the most efficient and persona-aligned response.
`;
    } catch (err) {
        console.error("HANISAH_BRAIN Critical Failure:", err);
        // Fallback System Instruction jika Brain error total
        return `
[SYSTEM_RECOVERY_MODE]
The primary cognitive engine encountered an error. 
You are a helpful AI assistant. 
Persona: ${persona}.
Answer the user's request directly.
`;
    }
  },

  getMechanicInstruction: () => {
      return `
[ROLE: SYSTEM_MECHANIC_PRIME]
Autonomous Maintenance System for IStoicAI Titanium.
Objective: 100% Node Efficiency.
Output: JSON or Technical Logs only.
`;
  }
};