import { useState, useEffect, useRef } from 'react';
import { TagIcon, XIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ProjectPhaseTag } from '../types';

interface TimeEntryTagsEditProps {
  timeEntryId: string;
  canManage: boolean;
}

export function TimeEntryTagsEdit({ timeEntryId, canManage }: TimeEntryTagsEditProps) {
  const [allTags, setAllTags] = useState<ProjectPhaseTag[]>([]);
  const [assignedTagIds, setAssignedTagIds] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTags();
    loadAssignedTags();
  }, [timeEntryId]);

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
  }

  async function loadAssignedTags() {
    const { data } = await supabase
      .from('project_time_entry_tags')
      .select('tag_id')
      .eq('time_entry_id', timeEntryId);

    if (data) {
      setAssignedTagIds(data.map(t => t.tag_id));
    }
  }

  async function toggleTag(tagId: string) {
    if (assignedTagIds.includes(tagId)) {
      const { error } = await supabase
        .from('project_time_entry_tags')
        .delete()
        .eq('time_entry_id', timeEntryId)
        .eq('tag_id', tagId);

      if (!error) {
        setAssignedTagIds(assignedTagIds.filter(id => id !== tagId));
      }
    } else {
      const { error } = await supabase
        .from('project_time_entry_tags')
        .insert({
          time_entry_id: timeEntryId,
          tag_id: tagId
        });

      if (!error) {
        setAssignedTagIds([...assignedTagIds, tagId]);
      }
    }
  }

  const assignedTags = allTags.filter(tag => assignedTagIds.includes(tag.id));
  const availableTags = allTags.filter(tag => !assignedTagIds.includes(tag.id));

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-1">
        {assignedTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {assignedTags.map(tag => (
              <div
                key={tag.id}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border border-gray-200 group/tag"
                style={{ backgroundColor: `${tag.color}15` }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span style={{ color: tag.color }} className="text-xs">{tag.name}</span>
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTag(tag.id);
                    }}
                    className="opacity-0 group-hover/tag:opacity-100 transition-opacity"
                  >
                    <XIcon className="w-2.5 h-2.5" style={{ color: tag.color }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {canManage && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-all"
            title="Přidat štítek"
          >
            <TagIcon className="w-3.5 h-3.5 text-gray-500" />
          </button>
        )}
      </div>

      {showDropdown && availableTags.length > 0 && (
        <div className="absolute z-50 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 p-1 max-h-48 overflow-y-auto">
          {availableTags.map(tag => (
            <button
              key={tag.id}
              onClick={(e) => {
                e.stopPropagation();
                toggleTag(tag.id);
                setShowDropdown(false);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded transition-colors text-xs"
            >
              <div
                className="w-2 h-2 rounded-full"
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
