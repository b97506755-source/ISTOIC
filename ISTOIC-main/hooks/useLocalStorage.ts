
import { useState, useEffect, useCallback, useRef } from 'react';

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // Helper to read from local storage
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [initialValue, key]);

  const [storedValue, setStoredValue] = useState<T>(readValue);
  
  // Ref to prevent loop if value doesn't actually change
  const currentStoredValue = useRef<T>(storedValue);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    setStoredValue((prevValue) => {
      // Correctly apply functional update based on the PREVIOUS state (prevValue)
      // not the storedValue from the closure which might be stale.
      const valueToStore = value instanceof Function ? value(prevValue) : value;
      
      try {
        // Save to local storage
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          
          // DISPATCH CUSTOM EVENT FOR SAME-WINDOW UPDATES
          window.dispatchEvent(new CustomEvent('local-storage-update', {
              detail: { key, newValue: valueToStore }
          }));
        }
      } catch (error) {
        console.warn(`Error saving localStorage key "${key}":`, error);
      }
      
      currentStoredValue.current = valueToStore;
      return valueToStore;
    });
  }, [key]); // Dependency array minimized to prevent thrashing

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent | CustomEvent) => {
      // Handle native storage event (other tabs)
      if (event instanceof StorageEvent) {
          if (event.key === key && event.newValue) {
            setStoredValue(JSON.parse(event.newValue));
          }
      } 
      // Handle custom event (same tab)
      else if (event instanceof CustomEvent) {
          if (event.detail.key === key) {
              setStoredValue(event.detail.newValue);
          }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-update', handleStorageChange as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-update', handleStorageChange as EventListener);
    };
  }, [key]);

  return [storedValue, setValue];
}

export default useLocalStorage;
