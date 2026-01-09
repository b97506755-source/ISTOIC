
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
    
    // --- 1. NOTE MANAGEMENT (GENIUS LOGIC V2.5) ---
    if (name === 'manage_note') {
        const { action, id, title, content, appendContent, tags, taskContent, taskAction, taskDueDate, query } = args;
        let updatedNotes = [...notes];

        // A. CREATE (Smart Inference)
        if (action === 'CREATE') {
            // Logika Jenius: Jika title/content kosong, generate default yang berguna
            const finalTitle = title || `Quick Note ${new Date().toLocaleTimeString()}`;
            const finalContent = content || "_(Empty note initialized. Ready for input.)_";
            
            const newNote: Note = {
                id: uuidv4(),
                title: finalTitle,
                content: finalContent,
                tags: tags || ['QUICK_LOG'],
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                tasks: [],
                is_pinned: false,
                is_archived: false
            };
            
            // Jika ada task langsung ditambahkan
            if (taskContent) {
                newNote.tasks?.push({ id: uuidv4(), text: taskContent, isCompleted: false });
            }

            setNotes([newNote, ...updatedNotes]);
            
            // Background Indexing
            VectorDB.indexNotes([newNote]).catch(console.error);

            // Output Markdown Card (Cantik & Rapi)
            return `> ✅ **NOTE SECURED**\n> **Ref:** ${finalTitle}\n> **ID:** \`${newNote.id.slice(0,6)}\`\n> *Disimpan di Local Vault.*`;
        }

        // B. SEARCH (Hybrid & Deep)
        if (action === 'SEARCH') {
            if (!query) return "> ⚠️ **SEARCH ERROR**: Parameter query kosong.";
            
            const q = query.toLowerCase();
            let matches: Note[] = [];
            let method = "KEYWORD";

            // 1. Semantic Search (Prioritas)
            try {
                const vectorIds = await VectorDB.search(q, 5);
                if (vectorIds.length > 0) {
                    const vectorMatches = notes.filter(n => vectorIds.includes(n.id));
                    if (vectorMatches.length > 0) {
                        matches = vectorMatches;
                        method = "NEURAL";
                    }
                }
            } catch (e) {}

            // 2. Keyword Fallback
            if (matches.length === 0) {
                matches = notes.filter(n => 
                    (n.title && n.title.toLowerCase().includes(q)) || 
                    (n.content && n.content.toLowerCase().includes(q)) ||
                    (n.tags && n.tags.some(t => t.toLowerCase().includes(q)))
                ).slice(0, 5);
                method = "EXACT";
            }

            if (matches.length === 0) return `> 🔍 **NO TRACE FOUND**\n> Tidak ada catatan yang cocok dengan "${query}".`;

            const list = matches.map(n => 
                `- **${n.title}** (ID: \`${n.id}\`)\n  _${n.content.substring(0, 60).replace(/\n/g, ' ')}..._`
            ).join('\n');

            return `> 🔍 **VAULT RESULTS** (${method})\n\n${list}\n\n_Katakan "Lihat catatan ID..." untuk membaca isinya._`;
        }

        // C. READ (Fetch & Display)
        if (action === 'READ') {
            // Coba cari ID, jika gagal cari berdasarkan judul yang mirip
            let target = notes.find(n => n.id === id);
            
            if (!target && title) {
                target = notes.find(n => n.title.toLowerCase().includes(title.toLowerCase()));
            }

            if (!target && query) {
                 target = notes.find(n => n.title.toLowerCase().includes(query.toLowerCase()));
            }

            if (!target) return "> ❌ **READ ERROR**: Catatan tidak ditemukan. Coba cari dulu.";

            const tasksStr = target.tasks?.map(t => `[${t.isCompleted ? 'x' : ' '}] ${t.text}`).join('\n') || "";

            return `
**📂 FILE: ${target.title}**
\`ID: ${target.id}\` | \`Updated: ${new Date(target.updated).toLocaleString()}\`
***
${target.content}
***
${tasksStr ? `**TASKS:**\n${tasksStr}\n` : ''}
**TAGS:** \`[${target.tags?.join('] [') || 'NONE'}]\`
`;
        }

        // D. UPDATE / APPEND (Precise)
        if ((action === 'UPDATE' || action === 'APPEND') && (id || title)) {
            let noteIndex = -1;
            
            if (id) {
                noteIndex = updatedNotes.findIndex(n => n.id === id);
            }
            
            // Jika ID salah/kosong, coba cari by title (Smart Fallback)
            if (noteIndex === -1 && title) {
                noteIndex = updatedNotes.findIndex(n => n.title.toLowerCase().includes(title.toLowerCase()));
            }

            if (noteIndex === -1) {
                return `> ❌ **TARGET MISSING**: Note tidak ditemukan. Mohon spesifik.`;
            }

            const note = updatedNotes[noteIndex];
            let changesLog = [];

            // Content Logic
            let finalContent = note.content;
            if (action === 'APPEND' && appendContent) {
                finalContent = `${note.content}\n\n${appendContent}`;
                changesLog.push("Append Data");
            } else if (content !== undefined) {
                finalContent = content;
                changesLog.push("Rewrite Data");
            }

            // Task Logic
            let noteTasks = [...(note.tasks || [])];
            if (taskAction === 'ADD' && taskContent) {
                noteTasks.push({ id: uuidv4(), text: taskContent, isCompleted: false, dueDate: taskDueDate });
                changesLog.push("Add Task");
            }

            updatedNotes[noteIndex] = {
                ...note,
                title: title || note.title,
                content: finalContent,
                tags: tags || note.tags,
                tasks: noteTasks,
                updated: new Date().toISOString()
            };
            
            setNotes(updatedNotes);
            VectorDB.indexNotes([updatedNotes[noteIndex]]).catch(console.error);

            return `> 🔄 **UPDATE SUCCESS**\n> **Target:** ${note.title}\n> **Ops:** ${changesLog.join(', ')}`;
        }

        // E. DELETE
        if (action === 'DELETE' && id) {
            const target = updatedNotes.find(n => n.id === id);
            if (!target) return `> ❌ **ERROR**: ID Salah.`;
            
            setNotes(updatedNotes.filter(n => n.id !== id));
            return `> 🗑️ **DELETED**: "${target.title}" dihapus permanen.`;
        }
    }

    // --- 2. LEGACY READ SPECIFIC NOTE HANDLER (Fallback) ---
    if (name === 'read_note') {
        const note = notes.find(n => n.id === args.id);
        if (!note) return "> ❌ **READ ERROR**: Akses ditolak atau ID salah.";
        return `**📂 FILE: ${note.title}**\n\n${note.content}`;
    }

    // --- 3. SEARCH NOTES HANDLER (Fallback) ---
    if (name === 'search_notes') {
        // Redirect to manage_note logic logic internally or just exec simple search
        return executeNeuralTool({ name: 'manage_note', args: { action: 'SEARCH', query: args.query } }, notes, setNotes, imageModelPreference);
    }

    // --- 4. VISUAL GENERATION (Robust) ---
    if (name === 'generate_visual') {
        try {
            const prompt = args.prompt;
            let imgUrl: string | null = null;
            let engineName = "HYDRA";

            // Prioritize Gemini if configured/available
            if (imageModelPreference.includes('gemini')) {
                try {
                    imgUrl = await generateImage(prompt, imageModelPreference);
                    if (imgUrl) engineName = "IMAGEN 3";
                } catch (geminiError) {
                    console.warn("Gemini fail, fallback to Hydra");
                }
            }
            
            // Fallback / Default Hydra
            if (!imgUrl) {
                const targetModel = imageModelPreference.includes('gemini') ? 'hydra-smart-route' : imageModelPreference;
                const result = await PollinationsService.generateHydraImage(prompt, targetModel);
                imgUrl = result.url;
                engineName = result.model.toUpperCase();
            }

            if (imgUrl) {
                return `\n![Generated Visual](${imgUrl})\n\n> 🎨 **RENDER COMPLETE**\n> **Engine:** ${engineName}\n> **Prompt:** "${prompt.slice(0, 40)}..."`;
            } else {
                throw new Error("All rendering engines busy.");
            }

        } catch (e: any) {
            return `> ⚠️ **RENDER FAIL**: ${e.message}. Coba prompt yang lebih sederhana.`;
        }
    }

    // --- 5. MECHANIC ---
    if (name === 'system_mechanic_tool') {
        const res = await executeMechanicTool(fc);
        if (res.startsWith('{')) return res; 
        return `> 🔧 **SYSTEM OPS**: ${res}`;
    }

    return "> ❓ **UNKNOWN COMMAND**: Protocol mismatch.";
};
