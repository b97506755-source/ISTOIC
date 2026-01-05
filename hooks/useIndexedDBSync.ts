
import { useEffect, useRef } from 'react';
import { LocalDB } from '../services/db';
import { Note } from '../types';
import { debugService } from '../services/debugService';

export const useIndexedDBSync = (notes: Note[]) => {
    const isFirstRun = useRef(true);

    useEffect(() => {
        // Skip sync on very first render to avoid overwriting DB with empty state if loading is slow
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }

        const sync = async () => {
            if (notes.length === 0) return;
            
            try {
                // Bulk put is faster than individual transactions for full sync
                // For a real production app with 1000s of notes, we would diff.
                // For now, we perform a "Save All" strategy periodically.
                for (const note of notes) {
                    await LocalDB.put(LocalDB.STORES.NOTES, note);
                }
                // Optional: debugService.log('TRACE', 'SYNC', 'IDB_UPDATE', `Synced ${notes.length} notes to DB.`);
            } catch (e) {
                console.error("Sync Failed", e);
            }
        };

        const timeout = setTimeout(sync, 2000); // Debounce sync
        return () => clearTimeout(timeout);
    }, [notes]);
};
