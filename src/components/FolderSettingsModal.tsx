import { useState, useEffect } from 'react';
import { X, Edit2Icon, UsersIcon, CheckIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FolderSharingManager } from './FolderSharingManager';
import type { Folder } from '../types';

interface FolderSettingsModalProps {
  folder: Folder;
  onClose: () => void;
  onUpdate: () => void;
  initialTab?: 'general' | 'sharing';
}

export function FolderSettingsModal({ folder, onClose, onUpdate, initialTab = 'general' }: FolderSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'sharing'>(initialTab);
  const [folderName, setFolderName] = useState(folder.name);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSaveName() {
    if (!folderName.trim() || folderName === folder.name) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);

    const { error } = await supabase
      .from('folders')
      .update({ name: folderName })
      .eq('id', folder.id);

    if (error) {
      console.error('Error updating folder name:', error);
      alert('Chyba při ukládání názvu složky');
    } else {
      onUpdate();
    }

    setIsSaving(false);
    setIsEditing(false);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Nastavení složky</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-b border-gray-200">
          <div className="flex px-6">
            <button
              onClick={() => setActiveTab('general')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'general'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Obecné
            </button>
            <button
              onClick={() => setActiveTab('sharing')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sharing'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <UsersIcon className="w-4 h-4" />
                Sdílení
              </div>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Název složky
                </label>
                {isEditing ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') {
                          setFolderName(folder.name);
                          setIsEditing(false);
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                      disabled={isSaving}
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={isSaving}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400"
                    >
                      <CheckIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-gray-900">
                      {folder.name}
                    </div>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Edit2Icon className="w-4 h-4" />
                      Upravit
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Typ složky
                </label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-700">
                  {folder.folder_type === 'task' ? 'Úkoly' : folder.folder_type === 'request' ? 'Poptávky' : 'Obecná'}
                </div>
              </div>

              {folder.description && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Popis
                  </label>
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-700">
                    {folder.description}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sharing' && (
            <FolderSharingManager
              folderId={folder.id}
              onUpdate={onUpdate}
            />
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
