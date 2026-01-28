import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import nodemailer from "npm:nodemailer@6.9.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const testEmail = url.searchParams.get('email') || 'milan.vodak@webfusion.cz';

    console.log('Testing SMTP connection and sending test email to:', testEmail);

    const { data: settings, error: settingsError } = await supabase
      .from('smtp_settings')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (settingsError || !settings) {
      throw new Error(`SMTP settings not found: ${settingsError?.message}`);
    }

    console.log('SMTP Settings loaded:', {
      host: settings.host,
      port: settings.port,
      user: settings.username,
      ssl: settings.use_ssl,
      tls: settings.use_tls,
      from: settings.from_email,
    });

    console.log('Creating nodemailer transporter...');

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.use_ssl,
      auth: {
        user: settings.username,
        pass: settings.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    console.log('Transporter created, preparing message...');

    const message = {
      from: settings.from_name
        ? `${settings.from_name} <${settings.from_email}>`
        : settings.from_email,
      to: testEmail,
      subject: 'Test SMTP Connection',
      text: 'This is a test email to verify SMTP connection is working properly.',
    };

    console.log('Message prepared:', {
      from: message.from,
      to: message.to,
      subject: message.subject,
    });

    console.log('Sending email...');

    const result = await transporter.sendMail(message);

    console.log('Email sent successfully!', result);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test email sent successfully',
        to: testEmail,
        smtp: {
          host: settings.host,
          port: settings.port,
          ssl: settings.use_ssl,
          tls: settings.use_tls,
        },
        result: result,
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
    console.error('Error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : null,
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
