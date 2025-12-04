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
      .select('email, display_name, first_name, last_name')
      .eq('id', assignedUserId)
      .maybeSingle();

    if (!assignedUser?.email) {
      return { success: false, error: 'User email not found' };
    }

    const { data: assignedByUser } = await supabase
      .from('user_profiles')
      .select('display_name, first_name, last_name, email')
      .eq('id', assignedByUserId)
      .maybeSingle();

    const assignedByName = assignedByUser?.first_name && assignedByUser?.last_name
      ? `${assignedByUser.first_name} ${assignedByUser.last_name}`
      : assignedByUser?.display_name || assignedByUser?.email || 'Systém';

    const userName = assignedUser.first_name && assignedUser.last_name
      ? `${assignedUser.first_name} ${assignedUser.last_name}`
      : assignedUser.display_name || assignedUser.email;

    const subject = isReassignment
      ? `Změna přiřazení úkolu: ${taskTitle}`
      : `Nový úkol přiřazen: ${taskTitle}`;

    const dueDateText = dueDate
      ? `Termín dokončení: ${new Date(dueDate).toLocaleDateString('cs-CZ')}`
      : '';

    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #0891b2; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .task-title { font-size: 20px; font-weight: bold; color: #0891b2; margin: 20px 0; }
            .info-row { margin: 10px 0; }
            .label { font-weight: 600; color: #6b7280; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #d1d5db; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">${isReassignment ? 'Změna přiřazení úkolu' : 'Nový úkol'}</h1>
            </div>
            <div class="content">
              <p>Dobrý den ${userName},</p>
              <p>${isReassignment ? 'byl Vám znovu přiřazen úkol' : 'byl Vám přiřazen nový úkol'}:</p>

              <div class="task-title">${taskTitle}</div>

              ${dueDateText ? `<div class="info-row"><span class="label">${dueDateText}</span></div>` : ''}
              <div class="info-row"><span class="label">Přiřadil:</span> ${assignedByName}</div>

              <p style="margin-top: 30px;">
                Pro zobrazení detailu úkolu se přihlaste do systému Task Manager.
              </p>
            </div>
            <div class="footer">
              Toto je automaticky generovaný email ze systému Task Manager. Neodpovídejte na něj.
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Dobrý den ${userName},

${isReassignment ? 'byl Vám znovu přiřazen úkol' : 'byl Vám přiřazen nový úkol'}:

${taskTitle}

${dueDateText}
Přiřadil: ${assignedByName}

Pro zobrazení detailu úkolu se přihlaste do systému Task Manager.

---
Toto je automaticky generovaný email ze systému Task Manager. Neodpovídejte na něj.
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
