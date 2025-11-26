import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Folder, Task, Request } from '../types';

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

const CACHE_DURATION = 30000;

export function DataCacheProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<CacheData>({
    folders: [],
    tasks: [],
    requests: [],
    foldersTimestamp: null,
    tasksTimestamp: null,
    requestsTimestamp: null,
  });

  const [isLoading, setIsLoading] = useState({
    folders: false,
    tasks: false,
    requests: false,
  });

  const isCacheValid = (timestamp: number | null): boolean => {
    if (!timestamp) return false;
    return Date.now() - timestamp < CACHE_DURATION;
  };

  const loadFolders = useCallback(async (force = false): Promise<Folder[]> => {
    if (!force && isCacheValid(cache.foldersTimestamp)) {
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
      setCache(prev => ({
        ...prev,
        folders,
        foldersTimestamp: Date.now(),
      }));

      setIsLoading(prev => ({ ...prev, folders: false }));
      return folders;
    } catch (error) {
      console.error('Error loading folders:', error);
      setIsLoading(prev => ({ ...prev, folders: false }));
      return cache.folders;
    }
  }, [cache.folders, cache.foldersTimestamp]);

  const loadTasks = useCallback(async (folderId: string, force = false): Promise<Task[]> => {
    if (!force && isCacheValid(cache.tasksTimestamp)) {
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

      setCache(prev => {
        const otherTasks = prev.tasks.filter(t => t.folder_id !== folderId);
        return {
          ...prev,
          tasks: [...otherTasks, ...tasks],
          tasksTimestamp: Date.now(),
        };
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
    if (!force && isCacheValid(cache.requestsTimestamp)) {
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

      setCache(prev => {
        const otherRequests = prev.requests.filter(r => r.folder_id !== folderId);
        return {
          ...prev,
          requests: [...otherRequests, ...requests],
          requestsTimestamp: Date.now(),
        };
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
    setCache(prev => ({ ...prev, foldersTimestamp: null }));
  }, []);

  const invalidateTasks = useCallback(() => {
    setCache(prev => ({ ...prev, tasksTimestamp: null }));
  }, []);

  const invalidateRequests = useCallback(() => {
    setCache(prev => ({ ...prev, requestsTimestamp: null }));
  }, []);

  const invalidateAll = useCallback(() => {
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
