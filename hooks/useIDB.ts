
import { useState, useEffect, useCallback, useRef } from 'react';

// --- Internal IDB-KeyVal Replacement ---
const DB_NAME = 'keyval-store';
const STORE_NAME = 'keyval';

const getDB = () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      (e.target as any).result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const get = async <T>(key: string): Promise<T | undefined> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("IDB Get Error", e);
    return undefined;
  }
};

const set = async (key: string, val: any): Promise<void> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("IDB Set Error", e);
  }
};
// ----------------------------------------

export function useIDB<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void, boolean] {
  const [value, setInternalValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    async function loadData() {
      try {
        let dbValue = await get<T>(key);
        
        // Migration Logic: If DB is empty, check localStorage
        if (dbValue === undefined) {
            const local = localStorage.getItem(key);
            if (local) {
                try {
                    dbValue = JSON.parse(local);
                    await set(key, dbValue); // Persist migration
                    console.log(`[MIGRATION] Moved ${key} from LS to IDB`);
                } catch (e) {
                    console.error("Migration parse error", e);
                }
            }
        }

        if (mounted.current && dbValue !== undefined) {
          setInternalValue(dbValue);
        }
      } catch (err) {
        console.error(`Error loading ${key} from IDB:`, err);
      } finally {
        if (mounted.current) setIsLoaded(true);
      }
    }
    loadData();
    return () => { mounted.current = false; };
  }, [key]);

  const setValue = useCallback((val: T | ((prev: T) => T)) => {
    setInternalValue((prev) => {
      const newValue = val instanceof Function ? val(prev) : val;
      // Fire and forget save
      set(key, newValue).catch(err => console.error(`Error saving ${key} to IDB:`, err));
      return newValue;
    });
  }, [key]);

  return [value, setValue, isLoaded];
}
