import React, { useEffect, useState } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TaskList } from './components/TaskList';
import { TaskSidebar } from './components/TaskSidebar';
import { FolderSidebar } from './components/FolderSidebar';
import { Header } from './components/Header';
import { Task, Folder, Category, User } from './types';

declare global {
  interface Window {
    atmConfig: {
      ajaxUrl: string;
      nonce: string;
      supabaseUrl: string;
      supabaseAnonKey: string;
      currentUser: {
        id: number;
        email: string;
        displayName: string;
      };
    };
  }
}

export const TaskManagerApp: React.FC = () => {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'today' | 'upcoming' | 'all' | 'completed'>('today');

  useEffect(() => {
    const config = window.atmConfig;
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      console.error('Supabase configuration missing');
      setIsLoading(false);
      return;
    }

    const client = createClient(config.supabaseUrl, config.supabaseAnonKey);
    setSupabase(client);

    initializeUser(client);
  }, []);

  const initializeUser = async (client: SupabaseClient) => {
    try {
      const config = window.atmConfig;

      const { data: existingUser } = await client
        .from('users_meta')
        .select('*')
        .eq('wordpress_user_id', config.currentUser.id)
        .maybeSingle();

      if (existingUser) {
        setCurrentUser(existingUser);
      } else {
        const { data: newUser } = await client
          .from('users_meta')
          .insert({
            wordpress_user_id: config.currentUser.id,
            email: config.currentUser.email,
            display_name: config.currentUser.displayName,
          })
          .select()
          .single();

        if (newUser) {
          setCurrentUser(newUser);
        }
      }

      await loadData(client);
    } catch (error) {
      console.error('Error initializing user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async (client: SupabaseClient) => {
    try {
      const [tasksRes, foldersRes, categoriesRes, usersRes] = await Promise.all([
        client.from('tasks').select('*').order('position'),
        client.from('folders').select('*').order('position'),
        client.from('categories').select('*'),
        client.from('users_meta').select('*'),
      ]);

      if (tasksRes.data) setTasks(tasksRes.data);
      if (foldersRes.data) setFolders(foldersRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (usersRes.data) setUsers(usersRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const refreshTasks = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('tasks').select('*').order('position');
    if (data) setTasks(data);
  };

  const refreshFolders = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('folders').select('*').order('position');
    if (data) setFolders(data);
  };

  const getFilteredTasks = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let filtered = tasks;

    if (selectedFolder) {
      filtered = filtered.filter(t => t.folder_id === selectedFolder);
    }

    switch (view) {
      case 'today':
        return filtered.filter(t => {
          if (t.status === 'completed') return false;
          if (!t.due_date) return false;
          const dueDate = new Date(t.due_date);
          return dueDate < tomorrow;
        });
      case 'upcoming':
        return filtered.filter(t => {
          if (t.status === 'completed') return false;
          if (!t.due_date) return true;
          const dueDate = new Date(t.due_date);
          return dueDate >= tomorrow;
        });
      case 'completed':
        return filtered.filter(t => t.status === 'completed');
      default:
        return filtered.filter(t => t.status !== 'completed');
    }
  };

  if (isLoading) {
    return (
      <div className="atm-loading">
        <div className="atm-spinner"></div>
        <p>Načítání task manageru...</p>
      </div>
    );
  }

  if (!supabase || !currentUser) {
    return (
      <div className="atm-error">
        <p>Nepodařilo se načíst konfiguraci. Zkontrolujte nastavení pluginu.</p>
      </div>
    );
  }

  return (
    <div className="atm-container">
      <FolderSidebar
        folders={folders}
        selectedFolder={selectedFolder}
        onSelectFolder={setSelectedFolder}
        onRefresh={refreshFolders}
        supabase={supabase}
        currentUser={currentUser}
      />

      <div className="atm-main">
        <Header
          view={view}
          onViewChange={setView}
          selectedFolder={selectedFolder}
          folders={folders}
        />

        <TaskList
          tasks={getFilteredTasks()}
          users={users}
          categories={categories}
          onSelectTask={setSelectedTask}
          onRefresh={refreshTasks}
          supabase={supabase}
          currentUser={currentUser}
          selectedFolder={selectedFolder}
        />
      </div>

      {selectedTask && (
        <TaskSidebar
          task={selectedTask}
          users={users}
          categories={categories}
          folders={folders}
          tasks={tasks}
          onClose={() => setSelectedTask(null)}
          onRefresh={refreshTasks}
          supabase={supabase}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
