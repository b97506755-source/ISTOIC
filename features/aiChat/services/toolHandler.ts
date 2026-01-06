
import { v4 as uuidv4 } from 'uuid';
import { type Note } from '../../../types';
import { generateImage } from '../../../services/geminiService';
import { PollinationsService } from '../../../services/pollinationsService'; 
import { executeMechanicTool } from '../../mechanic/mechanicTools';
import { VectorDB } from '../../../services/vectorDb';

export const executeNeuralTool = async (
    fc: any, 
    notes: Note[], 
    setNotes: (notes: Note[]) => void,
    imageModelPreference: string = 'hydra'
): Promise<string> => {
    const { name, args } = fc;
    
    // --- 1. NOTE MANAGEMENT ---
    if (name === 'manage_note') {
        const { action, id, title, content, appendContent, tags, taskContent, taskAction, taskDueDate } = args;
        let updatedNotes = [...notes];

        if (action === 'CREATE') {
            const newNote: Note = {
                id: uuidv4(),
                title: title || 'New Entry',
                content: content || '',
                tags: tags || [],
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                tasks: [],
                is_pinned: false,
                is_archived: false
            };
            setNotes([newNote, ...updatedNotes]);
            return `SUCCESS: Created note "${newNote.title}" (ID: ${newNote.id}).`;
        }

        if (action === 'UPDATE' && id) {
            const noteIndex = updatedNotes.findIndex(n => n.id === id);
            if (noteIndex === -1) return `ERROR: Note ID ${id} not found.`;

            let actionStatus = "Updated";
            const note = updatedNotes[noteIndex];
            
            // Task Logic
            let noteTasks = [...(note.tasks || [])];
            if (taskAction === 'ADD' && taskContent) {
                noteTasks.push({ id: uuidv4(), text: taskContent, isCompleted: false, dueDate: taskDueDate });
                actionStatus = "Task added";
            } else if (taskAction === 'TOGGLE' && taskContent) {
                const targetTask = noteTasks.find(t => t.text.toLowerCase().includes(taskContent.toLowerCase()));
                if (targetTask) {
                    targetTask.isCompleted = !targetTask.isCompleted;
                    actionStatus = "Task toggled";
                }
            }

            // Safe Merge
            updatedNotes[noteIndex] = {
                ...note,
                title: title !== undefined ? title : note.title,
                content: content !== undefined ? content : note.content,
                tags: tags !== undefined ? tags : note.tags,
                tasks: noteTasks,
                updated: new Date().toISOString()
            };
            
            setNotes(updatedNotes);
            return `SUCCESS: ${actionStatus} on note "${updatedNotes[noteIndex].title}".`;
        }

        if (action === 'APPEND' && id && appendContent) {
            const noteIndex = updatedNotes.findIndex(n => n.id === id);
            if (noteIndex === -1) return `ERROR: Note ID ${id} not found.`;
            
            const note = updatedNotes[noteIndex];
            const newContent = note.content 
                ? `${note.content}\n\n${appendContent}` 
                : appendContent;
            
            updatedNotes[noteIndex] = {
                ...note,
                content: newContent,
                updated: new Date().toISOString()
            };
            setNotes(updatedNotes);
            return `SUCCESS: Appended content to "${note.title}".`;
        }

        if (action === 'DELETE' && id) {
            setNotes(updatedNotes.filter(n => n.id !== id));
            return `SUCCESS: Note ${id} deleted permanently.`;
        }
    }

    // --- 2. INTELLIGENT RETRIEVAL (Hybrid RAG) ---
    if (name === 'search_notes') {
        const query = args.query.toLowerCase();
        let matches: Note[] = [];
        let searchMethod = "KEYWORD";

        // Try Semantic Vector Search first
        try {
            const vectorIds = await VectorDB.search(query, 5);
            if (vectorIds.length > 0) {
                const vectorMatches = notes.filter(n => vectorIds.includes(n.id));
                if (vectorMatches.length > 0) {
                    matches = vectorMatches;
                    searchMethod = "SEMANTIC_VECTOR";
                }
            }
        } catch (e) {
            console.warn("Vector search unavailable, falling back to keyword.", e);
        }

        // Fallback to Keyword
        if (matches.length === 0) {
            matches = notes.filter(n => 
                n.title.toLowerCase().includes(query) || 
                n.content.toLowerCase().includes(query) ||
                n.tags?.some(t => t.toLowerCase().includes(query))
            ).slice(0, 5);
        }

        if (matches.length === 0) return "SEARCH_RESULT: No matching notes found in vault.";

        const resultStr = matches.map(n => 
            `- ID: ${n.id}\n  Title: ${n.title}\n  Snippet: ${n.content.slice(0, 150).replace(/\n/g, ' ')}...`
        ).join('\n');

        return `[METHOD: ${searchMethod}] SEARCH_RESULT:\n${resultStr}\n\n(Use 'read_note' with ID to see full content)`;
    }

    if (name === 'read_note') {
        const note = notes.find(n => n.id === args.id);
        if (!note) return "ERROR: Note ID not found.";
        
        const cleanContent = note.content.replace(/<[^>]*>/g, '');
        const tasksStr = note.tasks?.map(t => `[${t.isCompleted ? 'x' : ' '}] ${t.text}`).join('\n') || "No tasks";

        return JSON.stringify({
            id: note.id,
            title: note.title,
            content: cleanContent,
            tags: note.tags,
            tasks: tasksStr,
            last_updated: note.updated
        }, null, 2);
    }

    // --- 3. VISUAL GENERATION (ENHANCED HYDRA & FALLBACK) ---
    if (name === 'generate_visual') {
        try {
            const prompt = args.prompt;
            let imgUrl: string | null = null;
            let providerInfo = "";
            let modelInfo = "";

            // Logic A: Use Gemini (if requested explicitly AND allowed)
            if (imageModelPreference.includes('gemini')) {
                try {
                    imgUrl = await generateImage(prompt, imageModelPreference);
                    if (imgUrl) {
                        providerInfo = "Google DeepMind";
                        modelInfo = "Imagen 3 (Fast)";
                    }
                } catch (geminiError: any) {
                    console.warn("Gemini Image Gen Failed, switching to Hydra.", geminiError.message);
                    // FALLTHROUGH TO HYDRA logic below
                }
            }
            
            // Logic B: Use Hydra (Pollinations/HF) - Default or Fallback
            if (!imgUrl) {
                const targetModel = imageModelPreference.includes('gemini') ? 'hydra-smart-route' : imageModelPreference;
                const result = await PollinationsService.generateHydraImage(prompt, targetModel);
                imgUrl = result.url;
                providerInfo = result.provider;
                modelInfo = result.model.toUpperCase();
            }

            // FINAL OUTPUT FORMATTING
            if (imgUrl) {
                // Return a clean Markdown Image with Metadata Footer
                return `\n![Generated Visual](${imgUrl})\n\n> 🎨 **GENERATED VIA ${providerInfo.toUpperCase()}**\n> 🧠 **MODEL:** ${modelInfo}\n> 📝 **PROMPT:** "${prompt.slice(0, 50)}..."`;
            } else {
                throw new Error("All generation engines failed.");
            }

        } catch (e: any) {
            return `⚠️ **VISUAL SYNTHESIS FAILED**: ${e.message}. System suggests retrying with 'Turbo' model.`;
        }
    }

    // --- 4. SYSTEM MECHANIC ---
    if (name === 'system_mechanic_tool') {
        return await executeMechanicTool(fc);
    }

    return "UNKNOWN_PROTOCOL.";
};
