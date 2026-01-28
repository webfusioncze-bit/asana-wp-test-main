import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import nodemailer from 'npm:nodemailer@6.9.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailRequest {
  to: string | string[];
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

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
    const recipients = Array.isArray(to) ? to : [to];

    for (const recipient of recipients) {
      const { error: logError } = await supabase
        .from('email_logs')
        .insert({
          to_email: recipient,
          from_email: smtpSettings.from_email,
          subject: subject,
          body_text: text || null,
          body_html: html || null,
          status: 'pending',
        });

      if (logError) {
        console.error('Error logging email:', logError);
      }
    }

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

    const emailPromises = recipients.map(async (recipient) => {
      try {
        await transporter.sendMail({
          from: smtpSettings.from_name
            ? `${smtpSettings.from_name} <${smtpSettings.from_email}>`
            : smtpSettings.from_email,
          to: recipient,
          subject: subject,
          text: text || '',
          html: html || undefined,
        });

        await supabase
          .from('email_logs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('to_email', recipient)
          .eq('subject', subject)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1);

        return { recipient, success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await supabase
          .from('email_logs')
          .update({
            status: 'failed',
            error_message: errorMessage,
          })
          .eq('to_email', recipient)
          .eq('subject', subject)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1);

        return { recipient, success: false, error: errorMessage };
      }
    });

    const results = await Promise.all(emailPromises);
    const failedEmails = results.filter((r) => !r.success);

    return new Response(
      JSON.stringify({
        success: failedEmails.length === 0,
        message:
          failedEmails.length === 0
            ? 'All emails sent successfully'
            : `${results.length - failedEmails.length}/${results.length} emails sent`,
        results,
      }),
      {
        status: failedEmails.length === 0 ? 200 : 207,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
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
