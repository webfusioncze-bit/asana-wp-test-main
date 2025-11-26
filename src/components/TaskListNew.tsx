import { useState, useEffect } from 'react';
import { ArrowLeftIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SubfolderGrid } from './SubfolderGrid';
import { TaskSectionList } from './TaskSectionList';
import { TaskOverview } from './TaskOverview';
import { FolderDetailHeader } from './FolderDetailHeader';
import { FolderSettingsModal } from './FolderSettingsModal';
import { TaskListSkeleton } from './LoadingSkeleton';
import { useDataCache } from '../contexts/DataCacheContext';
import type { Folder } from '../types';

interface TaskListNewProps {
  folderId: string | null;
  onSelectTask: (taskId: string | null) => void;
}

export function TaskListNew({ folderId, onSelectTask }: TaskListNewProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(folderId);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [folderPath, setFolderPath] = useState<Folder[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const { loadFolders: loadCachedFolders, invalidateFolders, invalidateTasks, isLoading: cacheLoading } = useDataCache();

  useEffect(() => {
    setCurrentFolderId(folderId);
  }, [folderId]);

  useEffect(() => {
    loadData();
  }, [currentFolderId]);

  async function loadData() {
    setLoading(true);
    await Promise.all([
      loadFolders(),
      loadCurrentFolder(),
      loadFolderPath()
    ]);
    setLoading(false);
  }

  async function loadFolders() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('folder_type', 'tasks')
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading folders:', error);
      return;
    }

    setFolders(data || []);
  }

  async function loadCurrentFolder() {
    if (!currentFolderId) {
      setCurrentFolder(null);
      return;
    }

    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('id', currentFolderId)
      .maybeSingle();

    if (error) {
      console.error('Error loading current folder:', error);
      return;
    }

    setCurrentFolder(data);
  }

  async function loadFolderPath() {
    if (!currentFolderId) {
      setFolderPath([]);
      return;
    }

    const path: Folder[] = [];
    let folderId: string | null = currentFolderId;

    while (folderId) {
      const { data: folder } = await supabase
        .from('folders')
        .select('*')
        .eq('id', folderId)
        .maybeSingle();

      if (!folder) break;
      path.unshift(folder);
      folderId = folder.parent_id;
    }

    setFolderPath(path);
  }

  function navigateToFolder(folderId: string | null) {
    setCurrentFolderId(folderId);
  }

  function navigateUp() {
    if (currentFolder?.parent_id) {
      navigateToFolder(currentFolder.parent_id);
    } else {
      navigateToFolder(null);
    }
  }

  if (loading || cacheLoading.folders) {
    return <TaskListSkeleton />;
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="px-3 py-2">
          <div className="flex items-center gap-2">
            {currentFolder && (
              <button
                onClick={navigateUp}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <ArrowLeftIcon className="w-4 h-4 text-gray-600" />
              </button>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <button
                onClick={() => navigateToFolder(null)}
                className="hover:text-blue-500 transition-colors"
              >
                Moje složky
              </button>
              {folderPath.map((folder, index) => (
                <span key={folder.id} className="flex items-center gap-2">
                  <span>/</span>
                  {index === folderPath.length - 1 ? (
                    <span className="text-gray-900 font-medium">{folder.name}</span>
                  ) : (
                    <button
                      onClick={() => navigateToFolder(folder.id)}
                      className="hover:text-blue-500 transition-colors"
                    >
                      {folder.name}
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
        {currentFolder && (
          <FolderDetailHeader
            folder={currentFolder}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {currentFolderId ? (
          <>
            <SubfolderGrid
              parentFolderId={currentFolderId}
              folders={folders}
              onFolderSelect={navigateToFolder}
              onFolderCreated={() => {
                loadFolders();
                setRefreshTrigger(prev => prev + 1);
              }}
            />
            <TaskSectionList
              folderId={currentFolderId}
              onTaskClick={onSelectTask}
              refreshTrigger={refreshTrigger}
              isCompletedFolder={currentFolder?.name === 'Dokončené'}
            />
          </>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Moje složky</h2>
              <SubfolderGrid
                parentFolderId={null}
                folders={folders}
                onFolderSelect={navigateToFolder}
                onFolderCreated={() => {
                  loadFolders();
                  setRefreshTrigger(prev => prev + 1);
                }}
                excludeGlobal={true}
              />
            </div>
            <div className="border-t border-gray-200 pt-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Přehled důležitých úkolů</h2>
              <TaskOverview onTaskClick={onSelectTask} />
            </div>
          </>
        )}
      </div>

      {showSettings && currentFolder && (
        <FolderSettingsModal
          folder={currentFolder}
          onClose={() => setShowSettings(false)}
          onUpdate={() => {
            loadCurrentFolder();
            loadFolderPath();
            setRefreshTrigger(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
}
