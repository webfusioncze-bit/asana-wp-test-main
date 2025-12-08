import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { SMTPClient } from 'npm:emailjs@4.0.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailRequest {
  to: string;
  subject: string;
  text?: string;
  html?: string;
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

    const { to, subject, text, html }: EmailRequest = await req.json();

    if (!to || !subject || (!text && !html)) {
      throw new Error('Missing required fields: to, subject, and either text or html');
    }

    const { data: settings, error: settingsError } = await supabase
      .from('smtp_settings')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (settingsError || !settings) {
      throw new Error('SMTP settings not configured');
    }

    const smtpSettings = settings as SMTPSettings;

    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        to_email: to,
        from_email: smtpSettings.from_email,
        subject: subject,
        body_text: text || null,
        body_html: html || null,
        status: 'pending',
      });

    if (logError) {
      console.error('Error logging email:', logError);
    }

    const client = new SMTPClient({
      user: smtpSettings.username,
      password: smtpSettings.password,
      host: smtpSettings.host,
      port: smtpSettings.port,
      ssl: smtpSettings.use_ssl,
      tls: smtpSettings.use_tls,
    });

    try {
      await client.sendAsync({
        from: smtpSettings.from_name
          ? `${smtpSettings.from_name} <${smtpSettings.from_email}>`
          : smtpSettings.from_email,
        to: to,
        subject: subject,
        text: text || '',
        attachment: html
          ? [
              {
                data: html,
                alternative: true,
              },
            ]
          : undefined,
      });

      await supabase
        .from('email_logs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('to_email', to)
        .eq('subject', subject)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email sent successfully',
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
        .eq('to_email', to)
        .eq('subject', subject)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      throw error;
    }
  } catch (error) {
    console.error('Error sending email:', error);
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
