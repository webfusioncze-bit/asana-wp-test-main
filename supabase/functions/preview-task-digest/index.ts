import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type DigestType = "daily" | "weekly" | "next-week";

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  priority: string;
  folder_id: string | null;
  category_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const userEmail = url.searchParams.get('email') || 'milan.vodak@webfusion.cz';
    const digestType = (url.searchParams.get('digest_type') || 'daily') as DigestType;

    // Get user
    const { data: user, error: userError } = await supabase
      .from('user_profiles')
      .select('id, email, display_name, first_name, last_name, avatar_url')
      .eq('email', userEmail)
      .maybeSingle();

    if (userError || !user) {
      throw new Error(`User not found: ${userEmail}`);
    }

    // Calculate date ranges
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = today.toISOString().split('T')[0];

    let startDate: string;
    let endDate: string;
    let title: string;

    if (digestType === 'daily') {
      startDate = todayStr;
      endDate = todayStr;
      title = 'Úkoly na dnes';
    } else if (digestType === 'weekly') {
      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      startDate = monday.toISOString().split('T')[0];
      endDate = sunday.toISOString().split('T')[0];
      title = 'Úkoly na tento týden';
    } else {
      const dayOfWeek = today.getDay();
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + (dayOfWeek === 0 ? 1 : 8 - dayOfWeek));
      const nextSunday = new Date(nextMonday);
      nextSunday.setDate(nextMonday.getDate() + 6);
      
      startDate = nextMonday.toISOString().split('T')[0];
      endDate = nextSunday.toISOString().split('T')[0];
      title = 'Úkoly na příští týden';
    }

    // Get tasks assigned to user in date range
    const { data: assignedTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', user.id)
      .is('completed_at', null)
      .gte('due_date', startDate)
      .lte('due_date', endDate + 'T23:59:59')
      .order('due_date', { ascending: true });

    // Get overdue tasks
    const { data: overdueTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', user.id)
      .is('completed_at', null)
      .lt('due_date', todayStr)
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true });

    // Get tasks created by user
    const { data: createdTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('created_by', user.id)
      .neq('assigned_to', user.id)
      .is('completed_at', null)
      .gte('due_date', startDate)
      .lte('due_date', endDate + 'T23:59:59')
      .order('due_date', { ascending: true });

    const html = await generateDigestEmail({
      user,
      assignedTasks: assignedTasks || [],
      overdueTasks: overdueTasks || [],
      createdTasks: createdTasks || [],
      title,
      digestType,
      startDate,
      endDate,
      supabase,
    });

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Preview error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

async function generateDigestEmail({
  user,
  assignedTasks,
  overdueTasks,
  createdTasks,
  title,
  digestType,
  startDate,
  endDate,
  supabase,
}: {
  user: any;
  assignedTasks: Task[];
  overdueTasks: Task[];
  createdTasks: Task[];
  title: string;
  digestType: DigestType;
  startDate: string;
  endDate: string;
  supabase: any;
}): Promise<string> {
  const userName = user.first_name && user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.display_name || user.email;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('cs-CZ', { 
      day: 'numeric', 
      month: 'short',
      year: digestType !== 'daily' ? 'numeric' : undefined 
    });
  };

  const renderTaskList = async (tasks: Task[], sectionTitle: string, isOverdue = false) => {
    if (tasks.length === 0) return '';

    const taskItems = await Promise.all(tasks.map(async (task) => {
      let folderName = '';
      if (task.folder_id) {
        const { data: folder } = await supabase
          .from('folders')
          .select('name')
          .eq('id', task.folder_id)
          .maybeSingle();
        folderName = folder?.name || '';
      }

      let assignedUserName = '';
      if (task.assigned_to && task.assigned_to !== user.id) {
        const { data: assignedUser } = await supabase
          .from('user_profiles')
          .select('display_name, first_name, last_name, email')
          .eq('id', task.assigned_to)
          .maybeSingle();
        
        assignedUserName = assignedUser?.first_name && assignedUser?.last_name
          ? `${assignedUser.first_name} ${assignedUser.last_name}`
          : assignedUser?.display_name || assignedUser?.email || '';
      }

      const priorityColors: { [key: string]: string } = {
        urgent: '#dc2626',
        high: '#ef4444',
        medium: '#f59e0b',
        low: '#6b7280',
      };

      const priorityLabels: { [key: string]: string } = {
        urgent: 'Naléhavá',
        high: 'Vysoká',
        medium: 'Střední',
        low: 'Nízká',
      };

      const priorityColor = priorityColors[task.priority || 'medium'];
      const priorityLabel = priorityLabels[task.priority || 'medium'];

      return `
        <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 12px; background-color: ${isOverdue ? '#fef2f2' : '#ffffff'};">
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="width: 16px; height: 16px; border: 2px solid #d1d5db; border-radius: 4px; flex-shrink: 0; margin-top: 2px;"></div>
            <div style="flex: 1;">
              <div style="font-size: 14px; font-weight: 600; color: #151b26; margin-bottom: 8px;">${task.title}</div>
              <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: #6b7280;">
                ${task.due_date ? `<span>📅 ${formatDate(task.due_date)}</span>` : ''}
                ${folderName ? `<span>📁 ${folderName}</span>` : ''}
                ${assignedUserName ? `<span>👤 ${assignedUserName}</span>` : ''}
                <span style="color: ${priorityColor};">● ${priorityLabel} priorita</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }));

    return `
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 16px; font-weight: 600; color: #151b26; margin-bottom: 16px; ${isOverdue ? 'color: #dc2626;' : ''}">
          ${sectionTitle} ${isOverdue ? '⚠️' : ''} (${tasks.length})
        </h2>
        ${taskItems.join('')}
      </div>
    `;
  };

  const overdueSection = await renderTaskList(overdueTasks, 'Zpožděné úkoly', true);
  const assignedSection = await renderTaskList(assignedTasks, title);
  const createdSection = await renderTaskList(createdTasks, 'Úkoly které jste vytvořili');

  const totalTasks = assignedTasks.length + overdueTasks.length + createdTasks.length;
  const noTasksMessage = totalTasks === 0 ? `
    <div style="padding: 32px; text-align: center; background-color: #f3f4f6; border-radius: 8px;">
      <p style="font-size: 16px; color: #6b7280; margin: 0;">
        ✨ Skvělé! Nemáte žádné úkoly v tomto období.
      </p>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - ${userName}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.5; color: #151b26; background-color: #f6f8fa;">
        <div style="max-width: 600px; margin: 40px auto; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="padding: 32px 40px 24px; border-bottom: 1px solid #f3f4f6;">
            <img src="https://webfusion.sk/wp-content/uploads/2021/02/Webfusion-logo.png" alt="Webfusion" style="max-width: 120px; height: auto;" />
          </div>

          <div style="padding: 32px 40px;">
            <h1 style="font-size: 24px; font-weight: 700; color: #151b26; margin-bottom: 8px;">
              Dobrý den, ${userName}!
            </h1>
            <p style="font-size: 14px; color: #6b7280; margin-bottom: 32px;">
              ${digestType === 'daily' ? 'Zde je přehled vašich úkolů na dnes' : digestType === 'weekly' ? 'Zde je přehled vašich úkolů na tento týden' : 'Zde je přehled vašich úkolů na příští týden'}${overdueTasks.length > 0 ? ' a zpožděných úkolů' : ''}.
              <br><small style="color: #9ca3af;">(Náhled pro: ${startDate} až ${endDate})</small>
            </p>

            <a href="https://task.webfusion.cz" style="display: inline-block; background-color: #22a0a0; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-bottom: 32px;">Zobrazit v Task Manager</a>

            ${noTasksMessage}
            ${overdueSection}
            ${assignedSection}
            ${createdSection}
          </div>

          <div style="padding: 24px 40px 32px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; line-height: 1.6;">
            Toto je automaticky generovaný email ze systému Task Manager.<br>
            Chcete změnit způsob doručování notifikací? <a href="https://task.webfusion.cz" style="color: #22a0a0; text-decoration: none;">Upravte nastavení</a>
          </div>
        </div>
      </body>
    </html>
  `;
}
