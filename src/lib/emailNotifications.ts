import { supabase } from './supabase';

interface SendTaskAssignmentEmailParams {
  taskId: string;
  taskTitle: string;
  assignedUserId: string;
  assignedByUserId: string;
  dueDate?: string;
  isReassignment?: boolean;
}

export async function sendTaskAssignmentEmail({
  taskId,
  taskTitle,
  assignedUserId,
  assignedByUserId,
  dueDate,
  isReassignment = false
}: SendTaskAssignmentEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (assignedUserId === assignedByUserId) {
      return { success: true };
    }

    const notificationType = isReassignment ? 'reassignment' : 'assignment';

    const { data: existingNotification } = await supabase
      .from('task_email_notifications')
      .select('*')
      .eq('task_id', taskId)
      .eq('user_id', assignedUserId)
      .eq('notification_type', notificationType)
      .eq('email_sent', true)
      .maybeSingle();

    if (existingNotification && !isReassignment) {
      return { success: true };
    }

    const { data: assignedUser } = await supabase
      .from('user_profiles')
      .select('email, display_name, first_name, last_name, avatar_url')
      .eq('id', assignedUserId)
      .maybeSingle();

    if (!assignedUser?.email) {
      return { success: false, error: 'User email not found' };
    }

    const { data: assignedByUser } = await supabase
      .from('user_profiles')
      .select('display_name, first_name, last_name, email, avatar_url')
      .eq('id', assignedByUserId)
      .maybeSingle();

    const { data: task } = await supabase
      .from('tasks')
      .select('*, folder_id, category_id')
      .eq('id', taskId)
      .maybeSingle();

    let folderName = '';
    let categoryName = '';
    let folderHierarchy: string[] = [];

    if (task?.folder_id) {
      const hierarchy: Array<{ id: string; name: string; parent_id: string | null }> = [];
      let currentFolderId: string | null = task.folder_id;

      while (currentFolderId) {
        const { data: folder } = await supabase
          .from('folders')
          .select('id, name, parent_id')
          .eq('id', currentFolderId)
          .maybeSingle();

        if (!folder) break;

        hierarchy.unshift(folder);
        currentFolderId = folder.parent_id;
      }

      folderHierarchy = hierarchy.map(f => f.name);
      folderName = hierarchy[hierarchy.length - 1]?.name || '';
    }

    if (task?.category_id) {
      const { data: category } = await supabase
        .from('categories')
        .select('name')
        .eq('id', task.category_id)
        .maybeSingle();
      categoryName = category?.name || '';
    }

    const assignedByName = assignedByUser?.first_name && assignedByUser?.last_name
      ? `${assignedByUser.first_name} ${assignedByUser.last_name}`
      : assignedByUser?.display_name || assignedByUser?.email || 'Systém';

    const assignedByInitials = assignedByUser?.first_name && assignedByUser?.last_name
      ? `${assignedByUser.first_name[0]}${assignedByUser.last_name[0]}`.toUpperCase()
      : assignedByUser?.display_name?.[0]?.toUpperCase() || 'S';

    const userName = assignedUser.first_name && assignedUser.last_name
      ? `${assignedUser.first_name} ${assignedUser.last_name}`
      : assignedUser.display_name || assignedUser.email;

    const userInitials = assignedUser.first_name && assignedUser.last_name
      ? `${assignedUser.first_name[0]}${assignedUser.last_name[0]}`.toUpperCase()
      : assignedUser.display_name?.[0]?.toUpperCase() || assignedUser.email[0].toUpperCase();

    const subject = `Byl jsi přiřazen k úkolu: ${taskTitle}`;

    const dueDateFormatted = dueDate
      ? new Date(dueDate).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
      : null;

    const breadcrumb = folderHierarchy.length > 0
      ? folderHierarchy.join(' › ')
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
              line-height: 1.5;
              color: #151b26;
              background-color: #f6f8fa;
              padding: 40px 20px;
            }
            .email-wrapper {
              max-width: 600px;
              margin: 0 auto;
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              background-color: #ffffff;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            }
            .header { padding: 32px 40px 24px; border-bottom: 1px solid #f3f4f6; }
            .logo img { max-width: 120px; height: auto; }
            .assignor-section {
              padding: 24px 40px;
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .avatar {
              width: 40px;
              height: 40px;
              border-radius: 50%;
              background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: 600;
              font-size: 14px;
              flex-shrink: 0;
            }
            .assignor-text {
              flex: 1;
            }
            .assignor-name {
              font-size: 16px;
              font-weight: 600;
              color: #151b26;
              line-height: 1.4;
            }
            .assignor-subtitle {
              font-size: 14px;
              color: #6b7280;
            }
            .cta-section { padding: 0 40px 24px; }
            .btn {
              display: inline-block;
              background-color: #22a0a0;
              color: #ffffff;
              text-decoration: none;
              padding: 12px 24px;
              border-radius: 6px;
              font-weight: 600;
              font-size: 14px;
            }
            .task-card {
              margin: 0 40px 32px;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 24px;
              background-color: #fafafa;
            }
            .breadcrumb {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 12px;
              padding-bottom: 12px;
              border-bottom: 1px solid #e5e7eb;
            }
            .task-title {
              font-size: 18px;
              font-weight: 600;
              color: #151b26;
              margin-bottom: 20px;
              display: flex;
              align-items: flex-start;
              gap: 12px;
            }
            .checkbox {
              width: 20px;
              height: 20px;
              border: 2px solid #d1d5db;
              border-radius: 4px;
              flex-shrink: 0;
              margin-top: 2px;
            }
            .task-meta {
              display: table;
              width: 100%;
              border-spacing: 0;
            }
            .meta-row {
              display: table-row;
            }
            .meta-label {
              display: table-cell;
              padding: 8px 16px 8px 0;
              font-size: 13px;
              color: #6b7280;
              width: 110px;
              vertical-align: top;
            }
            .meta-value {
              display: table-cell;
              padding: 8px 0;
              font-size: 13px;
              color: #151b26;
              vertical-align: top;
            }
            .meta-value-user {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .small-avatar {
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background: linear-gradient(135deg, #2ab8b8 0%, #22a0a0 100%);
              display: inline-flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: 600;
              font-size: 10px;
            }
            .project-badge {
              display: inline-flex;
              align-items: center;
              gap: 6px;
            }
            .project-dot {
              width: 12px;
              height: 12px;
              border-radius: 2px;
              background-color: #22a0a0;
            }
            .footer {
              padding: 24px 40px 32px;
              border-top: 1px solid #e5e7eb;
              font-size: 12px;
              color: #6b7280;
              line-height: 1.6;
            }
            .footer-link {
              color: #22a0a0;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="header">
              <div class="logo">
                <img src="https://webfusion.sk/wp-content/uploads/2021/02/Webfusion-logo.png" alt="Webfusion" />
              </div>
            </div>

            <div class="assignor-section">
              <div class="avatar">${assignedByInitials}</div>
              <div class="assignor-text">
                <div class="assignor-name">${assignedByName} ${isReassignment ? 'změnil/a přiřazení úkolu' : 'přiřadil/a vám úkol'}</div>
                ${folderName ? `<div class="assignor-subtitle">${folderName}</div>` : ''}
              </div>
            </div>

            <div class="cta-section">
              <a href="https://task.webfusion.cz" class="btn">Zobrazit úkol</a>
            </div>

            <div class="task-card">
              ${breadcrumb ? `<div class="breadcrumb">${breadcrumb}</div>` : ''}

              <div class="task-title">
                <div class="checkbox"></div>
                <div>${taskTitle}</div>
              </div>

              <div class="task-meta">
                <div class="meta-row">
                  <div class="meta-label">Assigned to</div>
                  <div class="meta-value">
                    <div class="meta-value-user">
                      <div class="small-avatar">${userInitials}</div>
                      <span>${userName}</span>
                    </div>
                  </div>
                </div>
                ${dueDateFormatted ? `
                <div class="meta-row">
                  <div class="meta-label">Due date</div>
                  <div class="meta-value">${dueDateFormatted}</div>
                </div>
                ` : ''}
                ${folderName ? `
                <div class="meta-row">
                  <div class="meta-label">Project</div>
                  <div class="meta-value">
                    <div class="project-badge">
                      <div class="project-dot"></div>
                      <span>${folderName}</span>
                    </div>
                  </div>
                </div>
                ` : ''}
                ${categoryName ? `
                <div class="meta-row">
                  <div class="meta-label">Category</div>
                  <div class="meta-value">${categoryName}</div>
                </div>
                ` : ''}
              </div>
            </div>

            <div class="footer">
              Toto je automaticky generovaný email ze systému Task Manager.<br>
              Chcete změnit způsob doručování notifikací? <a href="https://task.webfusion.cz" class="footer-link">Upravte nastavení</a>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
${assignedByName} ${isReassignment ? 'změnil/a přiřazení úkolu' : 'přiřadil/a vám úkol'}
${folderName}

ÚKOL: ${taskTitle}

Assigned to: ${userName}
${dueDateFormatted ? `Due date: ${dueDateFormatted}` : ''}
${folderName ? `Project: ${folderName}` : ''}
${categoryName ? `Category: ${categoryName}` : ''}

Zobrazit úkol v Task Manager

---
Toto je automaticky generovaný email ze systému Task Manager.
Chcete změnit způsob doručování notifikací? Upravte nastavení
    `.trim();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: assignedUser.email,
        subject,
        text,
        html,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error sending email:', result.error);
      return { success: false, error: result.error };
    }

    await supabase
      .from('task_email_notifications')
      .upsert({
        task_id: taskId,
        user_id: assignedUserId,
        notification_type: notificationType,
        email_sent: true,
        sent_at: new Date().toISOString(),
      }, {
        onConflict: 'task_id,user_id,notification_type'
      });

    await supabase
      .from('task_activity_log')
      .insert({
        task_id: taskId,
        activity_type: 'email_sent',
        email_sent_to: assignedUser.email,
        created_by: assignedByUserId,
        metadata: {
          notification_type: notificationType,
          subject
        }
      });

    return { success: true };
  } catch (error) {
    console.error('Error in sendTaskAssignmentEmail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
