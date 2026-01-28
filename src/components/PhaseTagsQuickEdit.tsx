import { useState, useEffect, useRef } from 'react';
import { TagIcon, XIcon, PlusIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ProjectPhaseTag, ProjectPhaseTagAssignment } from '../types';

interface PhaseTagsQuickEditProps {
  phaseId: string;
  canManage: boolean;
}

export function PhaseTagsQuickEdit({ phaseId, canManage }: PhaseTagsQuickEditProps) {
  const [allTags, setAllTags] = useState<ProjectPhaseTag[]>([]);
  const [assignedTagIds, setAssignedTagIds] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTags();
    loadAssignedTags();
  }, [phaseId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  async function loadTags() {
    const { data } = await supabase
      .from('project_phase_tags')
      .select('*')
      .order('name');

    if (data) {
      setAllTags(data);
    }
    setLoading(false);
  }

  async function loadAssignedTags() {
    const { data } = await supabase
      .from('project_phase_tag_assignments')
      .select('tag_id')
      .eq('phase_id', phaseId);

    if (data) {
      setAssignedTagIds(data.map(t => t.tag_id));
    }
  }

  async function toggleTag(tagId: string) {
    if (assignedTagIds.includes(tagId)) {
      const { error } = await supabase
        .from('project_phase_tag_assignments')
        .delete()
        .eq('phase_id', phaseId)
        .eq('tag_id', tagId);

      if (!error) {
        setAssignedTagIds(assignedTagIds.filter(id => id !== tagId));
      }
    } else {
      const { error } = await supabase
        .from('project_phase_tag_assignments')
        .insert({
          phase_id: phaseId,
          tag_id: tagId
        });

      if (!error) {
        setAssignedTagIds([...assignedTagIds, tagId]);
      }
    }
  }

  const assignedTags = allTags.filter(tag => assignedTagIds.includes(tag.id));
  const availableTags = allTags.filter(tag => !assignedTagIds.includes(tag.id));

  if (loading) {
    return <div className="text-xs text-gray-400">Načítání...</div>;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-1 flex-wrap">
        {assignedTags.map(tag => (
          <div
            key={tag.id}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-gray-200 group"
            style={{ backgroundColor: `${tag.color}15` }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            <span style={{ color: tag.color }}>{tag.name}</span>
            {canManage && (
              <button
                onClick={() => toggleTag(tag.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <XIcon className="w-3 h-3" style={{ color: tag.color }} />
              </button>
            )}
          </div>
        ))}
        {canManage && (
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded-full hover:border-gray-400 transition-colors"
          >
            <PlusIcon className="w-3 h-3" />
            Přidat štítek
          </button>
        )}
      </div>

      {showDropdown && availableTags.length > 0 && (
        <div className="absolute z-50 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-2 max-h-64 overflow-y-auto">
          {availableTags.map(tag => (
            <button
              key={tag.id}
              onClick={() => {
                toggleTag(tag.id);
                setShowDropdown(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded transition-colors text-sm"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <span style={{ color: tag.color }}>{tag.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
