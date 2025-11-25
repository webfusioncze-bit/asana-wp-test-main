import { useState, useEffect, useRef } from 'react';
import { TagIcon, XIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { FolderTag } from '../types';

interface TaskTagsQuickEditProps {
  taskId: string;
  folderId: string | null;
  selectedTagIds: string[];
  onTagsChanged: () => void;
}

export function TaskTagsQuickEdit({ taskId, folderId, selectedTagIds, onTagsChanged }: TaskTagsQuickEditProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<FolderTag[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && folderId) {
      loadAvailableTags();
    }
  }, [isOpen, folderId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  async function loadAvailableTags() {
    if (!folderId) return;

    const { data, error } = await supabase
      .from('folder_tags')
      .select('*')
      .eq('folder_id', folderId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading tags:', error);
      return;
    }

    setAvailableTags(data || []);
  }

  async function toggleTag(tagId: string) {
    const isSelected = selectedTagIds.includes(tagId);

    if (isSelected) {
      const { error } = await supabase
        .from('task_tags')
        .delete()
        .eq('task_id', taskId)
        .eq('tag_id', tagId);

      if (error) {
        console.error('Error removing tag:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('task_tags')
        .insert({
          task_id: taskId,
          tag_id: tagId
        });

      if (error) {
        console.error('Error adding tag:', error);
        return;
      }
    }

    onTagsChanged();
  }

  if (!folderId) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-gray-200 rounded text-xs text-gray-600 transition-colors"
        title="Upravit tagy"
      >
        <TagIcon className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
          <div className="p-2 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">Tagy</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="max-h-[200px] overflow-y-auto p-2">
            {availableTags.length === 0 ? (
              <p className="text-xs text-gray-500 py-2 px-2 text-center">
                Ve složce nejsou žádné tagy
              </p>
            ) : (
              <div className="space-y-1">
                {availableTags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTag(tag.id);
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-left">{tag.name}</span>
                      {isSelected && (
                        <div className="w-4 h-4 rounded bg-blue-600 text-white flex items-center justify-center">
                          <span className="text-[10px]">✓</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
