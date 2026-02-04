import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import nodemailer from 'npm:nodemailer@6.9.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface AssignmentEmailRequest {
  request_id: string;
  assigned_user_id: string;
  assigner_user_id: string;
}

interface SMTPSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  use_ssl: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { request_id, assigned_user_id, assigner_user_id }: AssignmentEmailRequest = await req.json();

    if (!request_id || !assigned_user_id || !assigner_user_id) {
      throw new Error('Missing required fields: request_id, assigned_user_id, assigner_user_id');
    }

    const { data: requestData, error: requestError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', request_id)
      .maybeSingle();

    if (requestError || !requestData) {
      throw new Error('Request not found');
    }

    const { data: assignedUser, error: assignedUserError } = await supabase
      .from('user_profiles')
      .select('id, email, display_name, first_name, last_name')
      .eq('id', assigned_user_id)
      .maybeSingle();

    if (assignedUserError || !assignedUser || !assignedUser.email) {
      throw new Error('Assigned user not found or has no email');
    }

    const { data: assignerUser } = await supabase
      .from('user_profiles')
      .select('id, email, display_name, first_name, last_name')
      .eq('id', assigner_user_id)
      .maybeSingle();

    const assignerName = assignerUser?.first_name && assignerUser?.last_name
      ? `${assignerUser.first_name} ${assignerUser.last_name}`
      : assignerUser?.display_name || assignerUser?.email || 'Neznamy uzivatel';

    const assignedUserName = assignedUser?.first_name && assignedUser?.last_name
      ? `${assignedUser.first_name} ${assignedUser.last_name}`
      : assignedUser?.display_name || assignedUser?.email || '';

    const { data: settings, error: settingsError } = await supabase
      .from('smtp_settings')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (settingsError || !settings) {
      console.log('SMTP settings not configured, skipping email');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'SMTP not configured, email skipped',
          skipped: true,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const smtpSettings = settings as SMTPSettings;

    let requestTypeName = '';
    if (requestData.request_type_id) {
      const { data: typeData } = await supabase
        .from('request_types')
        .select('name')
        .eq('id', requestData.request_type_id)
        .maybeSingle();
      requestTypeName = typeData?.name || '';
    }

    const priorityLabels: Record<string, string> = {
      low: 'Nizka',
      medium: 'Stredni',
      high: 'Vysoka',
      urgent: 'Urgentni',
    };

    const priorityColors: Record<string, string> = {
      low: '#6b7280',
      medium: '#f59e0b',
      high: '#ef4444',
      urgent: '#dc2626',
    };

    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return 'Neni nastaven';
      return new Date(dateStr).toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    };

    const subject = `Byla vam pridelena poptavka: ${requestData.title}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.5; color: #151b26; background-color: #f6f8fa;">
          <div style="max-width: 600px; margin: 40px auto; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="padding: 32px 40px 24px; border-bottom: 1px solid #f3f4f6;">
              <img src="https://webfusion.sk/wp-content/uploads/2021/02/Webfusion-logo.png" alt="Webfusion" style="max-width: 120px; height: auto;" />
            </div>

            <div style="padding: 32px 40px;">
              <h1 style="font-size: 24px; font-weight: 700; color: #151b26; margin-bottom: 8px;">
                Dobry den, ${assignedUserName}!
              </h1>
              <p style="font-size: 14px; color: #6b7280; margin-bottom: 24px;">
                Uzivatel <strong>${assignerName}</strong> vam pridelil novou poptavku k zpracovani.
              </p>

              <div style="background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <h2 style="font-size: 18px; font-weight: 600; color: #151b26; margin: 0 0 16px 0;">
                  ${requestData.title}
                </h2>

                ${requestData.description ? `
                  <p style="font-size: 14px; color: #4b5563; margin: 0 0 16px 0;">
                    ${requestData.description.substring(0, 200)}${requestData.description.length > 200 ? '...' : ''}
                  </p>
                ` : ''}

                <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px;">
                  ${requestData.client_name ? `
                    <div>
                      <span style="color: #6b7280;">Klient:</span>
                      <span style="color: #151b26; font-weight: 500;"> ${requestData.client_name}</span>
                    </div>
                  ` : ''}

                  ${requestTypeName ? `
                    <div>
                      <span style="color: #6b7280;">Typ:</span>
                      <span style="color: #151b26; font-weight: 500;"> ${requestTypeName}</span>
                    </div>
                  ` : ''}

                  <div>
                    <span style="color: #6b7280;">Priorita:</span>
                    <span style="color: ${priorityColors[requestData.priority] || '#6b7280'}; font-weight: 500;"> ${priorityLabels[requestData.priority] || 'Stredni'}</span>
                  </div>

                  ${requestData.deadline ? `
                    <div>
                      <span style="color: #6b7280;">Termin:</span>
                      <span style="color: #151b26; font-weight: 500;"> ${formatDate(requestData.deadline)}</span>
                    </div>
                  ` : ''}

                  ${requestData.budget ? `
                    <div>
                      <span style="color: #6b7280;">Rozpocet:</span>
                      <span style="color: #151b26; font-weight: 500;"> ${requestData.budget}</span>
                    </div>
                  ` : ''}
                </div>
              </div>

              <a href="https://task.webfusion.cz" style="display: inline-block; background-color: #22a0a0; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">
                Zobrazit poptavku
              </a>
            </div>

            <div style="padding: 24px 40px 32px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; line-height: 1.6;">
              Toto je automaticky generovany email ze systemu Task Manager.<br>
              Chcete zmenit zpusob dorucovani notifikaci? <a href="https://task.webfusion.cz" style="color: #22a0a0; text-decoration: none;">Upravte nastaveni</a>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Dobry den, ${assignedUserName}!

Uzivatel ${assignerName} vam pridelil novou poptavku k zpracovani.

POPTAVKA: ${requestData.title}
${requestData.description ? `Popis: ${requestData.description.substring(0, 200)}${requestData.description.length > 200 ? '...' : ''}\n` : ''}
${requestData.client_name ? `Klient: ${requestData.client_name}\n` : ''}
${requestTypeName ? `Typ: ${requestTypeName}\n` : ''}
Priorita: ${priorityLabels[requestData.priority] || 'Stredni'}
${requestData.deadline ? `Termin: ${formatDate(requestData.deadline)}\n` : ''}
${requestData.budget ? `Rozpocet: ${requestData.budget}\n` : ''}

Zobrazit poptavku: https://task.webfusion.cz
    `.trim();

    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        to_email: assignedUser.email,
        from_email: smtpSettings.from_email,
        subject: subject,
        body_text: text,
        body_html: html,
        status: 'pending',
      });

    if (logError) {
      console.error('Error logging email:', logError);
    }

    console.log('Preparing to send assignment email to:', assignedUser.email);

    try {
      const transporter = nodemailer.createTransport({
        host: smtpSettings.host,
        port: smtpSettings.port,
        secure: smtpSettings.use_ssl,
        auth: {
          user: smtpSettings.username,
          pass: smtpSettings.password,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      await transporter.sendMail({
        from: smtpSettings.from_name
          ? `${smtpSettings.from_name} <${smtpSettings.from_email}>`
          : smtpSettings.from_email,
        to: assignedUser.email,
        subject: subject,
        text: text,
        html: html,
      });

      console.log('Assignment email sent successfully to:', assignedUser.email);

      await supabase
        .from('email_logs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('to_email', assignedUser.email)
        .eq('subject', subject)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Assignment email sent successfully',
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await supabase
        .from('email_logs')
        .update({
          status: 'failed',
          error_message: errorMessage,
        })
        .eq('to_email', assignedUser.email)
        .eq('subject', subject)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      throw error;
    }
  } catch (error) {
    console.error('Error sending assignment email:', error);
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
