import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Folder, Task, Request } from '../types';

const CACHE_DURATION = 5 * 60 * 1000;
const LS_KEY_FOLDERS = 'cache_folders_v1';
const LS_KEY_TASKS = 'cache_tasks_v1';
const LS_KEY_REQUESTS = 'cache_requests_v1';

interface CacheEntry<T> {
  data: T[];
  timestamp: number;
}

interface CacheData {
  folders: Folder[];
  tasks: Task[];
  requests: Request[];
  foldersTimestamp: number | null;
  tasksTimestamp: number | null;
  requestsTimestamp: number | null;
}

interface DataCacheContextType {
  cache: CacheData;
  loadFolders: (force?: boolean) => Promise<Folder[]>;
  loadTasks: (folderId: string, force?: boolean) => Promise<Task[]>;
  loadRequests: (folderId: string, force?: boolean) => Promise<Request[]>;
  invalidateFolders: () => void;
  invalidateTasks: () => void;
  invalidateRequests: () => void;
  invalidateAll: () => void;
  isLoading: {
    folders: boolean;
    tasks: boolean;
    requests: boolean;
  };
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

function readLS<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (typeof parsed.timestamp !== 'number' || !Array.isArray(parsed.data)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLS<T>(key: string, data: T[], timestamp: number) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp }));
  } catch {
  }
}

function clearLS(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
  }
}

function isValid(timestamp: number | null): boolean {
  if (!timestamp) return false;
  return Date.now() - timestamp < CACHE_DURATION;
}

function buildInitialCache(): CacheData {
  const foldersLS = readLS<Folder>(LS_KEY_FOLDERS);
  const tasksLS = readLS<Task>(LS_KEY_TASKS);
  const requestsLS = readLS<Request>(LS_KEY_REQUESTS);

  return {
    folders: foldersLS && isValid(foldersLS.timestamp) ? foldersLS.data : [],
    tasks: tasksLS && isValid(tasksLS.timestamp) ? tasksLS.data : [],
    requests: requestsLS && isValid(requestsLS.timestamp) ? requestsLS.data : [],
    foldersTimestamp: foldersLS && isValid(foldersLS.timestamp) ? foldersLS.timestamp : null,
    tasksTimestamp: tasksLS && isValid(tasksLS.timestamp) ? tasksLS.timestamp : null,
    requestsTimestamp: requestsLS && isValid(requestsLS.timestamp) ? requestsLS.timestamp : null,
  };
}

export function DataCacheProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<CacheData>(buildInitialCache);

  const [isLoading, setIsLoading] = useState({
    folders: false,
    tasks: false,
    requests: false,
  });

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LS_KEY_FOLDERS) {
        const entry = readLS<Folder>(LS_KEY_FOLDERS);
        if (entry && isValid(entry.timestamp)) {
          setCache(prev => ({ ...prev, folders: entry.data, foldersTimestamp: entry.timestamp }));
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const loadFolders = useCallback(async (force = false): Promise<Folder[]> => {
    if (!force && isValid(cache.foldersTimestamp)) {
      return cache.folders;
    }

    setIsLoading(prev => ({ ...prev, folders: true }));

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setIsLoading(prev => ({ ...prev, folders: false }));
        return [];
      }

      const { data, error } = await supabase
        .from('folders')
        .select(`
          *,
          folder_tags(
            tag:tags(*)
          )
        `)
        .order('name');

      if (error) {
        console.error('Error loading folders:', error);
        setIsLoading(prev => ({ ...prev, folders: false }));
        return cache.folders;
      }

      const folders = data || [];
      const timestamp = Date.now();
      writeLS(LS_KEY_FOLDERS, folders, timestamp);
      setCache(prev => ({ ...prev, folders, foldersTimestamp: timestamp }));
      setIsLoading(prev => ({ ...prev, folders: false }));
      return folders;
    } catch (error) {
      console.error('Error loading folders:', error);
      setIsLoading(prev => ({ ...prev, folders: false }));
      return cache.folders;
    }
  }, [cache.folders, cache.foldersTimestamp]);

  const loadTasks = useCallback(async (folderId: string, force = false): Promise<Task[]> => {
    if (!force && isValid(cache.tasksTimestamp)) {
      return cache.tasks.filter(t => t.folder_id === folderId);
    }

    setIsLoading(prev => ({ ...prev, tasks: true }));

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_tags(
            tag:tags(*)
          ),
          assigned_user:user_profiles!tasks_assigned_to_fkey(id, email, full_name, avatar_url)
        `)
        .eq('folder_id', folderId)
        .order('position');

      if (error) {
        console.error('Error loading tasks:', error);
        setIsLoading(prev => ({ ...prev, tasks: false }));
        return cache.tasks.filter(t => t.folder_id === folderId);
      }

      const tasks = data || [];
      const timestamp = Date.now();

      setCache(prev => {
        const otherTasks = prev.tasks.filter(t => t.folder_id !== folderId);
        const merged = [...otherTasks, ...tasks];
        writeLS(LS_KEY_TASKS, merged, timestamp);
        return { ...prev, tasks: merged, tasksTimestamp: timestamp };
      });

      setIsLoading(prev => ({ ...prev, tasks: false }));
      return tasks;
    } catch (error) {
      console.error('Error loading tasks:', error);
      setIsLoading(prev => ({ ...prev, tasks: false }));
      return cache.tasks.filter(t => t.folder_id === folderId);
    }
  }, [cache.tasks, cache.tasksTimestamp]);

  const loadRequests = useCallback(async (folderId: string, force = false): Promise<Request[]> => {
    if (!force && isValid(cache.requestsTimestamp)) {
      return cache.requests.filter(r => r.folder_id === folderId);
    }

    setIsLoading(prev => ({ ...prev, requests: true }));

    try {
      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          request_type:request_types(*),
          assigned_user:user_profiles!requests_assigned_to_fkey(id, email, full_name, avatar_url)
        `)
        .eq('folder_id', folderId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading requests:', error);
        setIsLoading(prev => ({ ...prev, requests: false }));
        return cache.requests.filter(r => r.folder_id === folderId);
      }

      const requests = data || [];
      const timestamp = Date.now();

      setCache(prev => {
        const otherRequests = prev.requests.filter(r => r.folder_id !== folderId);
        const merged = [...otherRequests, ...requests];
        writeLS(LS_KEY_REQUESTS, merged, timestamp);
        return { ...prev, requests: merged, requestsTimestamp: timestamp };
      });

      setIsLoading(prev => ({ ...prev, requests: false }));
      return requests;
    } catch (error) {
      console.error('Error loading requests:', error);
      setIsLoading(prev => ({ ...prev, requests: false }));
      return cache.requests.filter(r => r.folder_id === folderId);
    }
  }, [cache.requests, cache.requestsTimestamp]);

  const invalidateFolders = useCallback(() => {
    clearLS(LS_KEY_FOLDERS);
    setCache(prev => ({ ...prev, foldersTimestamp: null }));
  }, []);

  const invalidateTasks = useCallback(() => {
    clearLS(LS_KEY_TASKS);
    setCache(prev => ({ ...prev, tasksTimestamp: null }));
  }, []);

  const invalidateRequests = useCallback(() => {
    clearLS(LS_KEY_REQUESTS);
    setCache(prev => ({ ...prev, requestsTimestamp: null }));
  }, []);

  const invalidateAll = useCallback(() => {
    clearLS(LS_KEY_FOLDERS);
    clearLS(LS_KEY_TASKS);
    clearLS(LS_KEY_REQUESTS);
    setCache({
      folders: [],
      tasks: [],
      requests: [],
      foldersTimestamp: null,
      tasksTimestamp: null,
      requestsTimestamp: null,
    });
  }, []);

  return (
    <DataCacheContext.Provider
      value={{
        cache,
        loadFolders,
        loadTasks,
        loadRequests,
        invalidateFolders,
        invalidateTasks,
        invalidateRequests,
        invalidateAll,
        isLoading,
      }}
    >
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const context = useContext(DataCacheContext);
  if (context === undefined) {
    throw new Error('useDataCache must be used within DataCacheProvider');
  }
  return context;
}
