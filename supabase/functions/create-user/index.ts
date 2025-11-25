import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateUserRequest {
  email: string;
  password: string;
  externalId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      },
    );

    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const { data: userRole, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    if (roleError || userRole?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only admins can create users' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const { email, password, externalId }: CreateUserRequest = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const userMetadata: any = {};
    if (externalId) {
      userMetadata.external_id = externalId;
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (error) {
      console.error('Auth error:', error);
      return new Response(
        JSON.stringify({ error: `Auth error: ${error.message}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!data.user) {
      console.error('No user created');
      return new Response(
        JSON.stringify({ error: 'Failed to create user - no user returned' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    console.log('User created successfully:', data.user.id, 'with external_id:', externalId || 'none');

    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: data.user.id,
        role: 'user'
      });

    if (roleInsertError) {
      console.error('Role insertion error:', roleInsertError);
    } else {
      console.log('User role created successfully');
    }

    const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Vítejte v Task Manageru!</h1>
              </div>
              <div class="content">
                <p>Dobrý den,</p>
                <p>Byl pro vás vytvořen účet v Task Manageru Webfusion.</p>
                <p><strong>Přihlašovací údaje:</strong></p>
                <ul>
                  <li>Email: <strong>${email}</strong></li>
                  <li>Dočasné heslo: <strong>${password}</strong></li>
                </ul>
                ${externalId ? `<p><strong>Váš ID:</strong> ${externalId}</p>` : ''}
                <p>Pro přihlášení použijte odkaz níže:</p>
                <div style="text-align: center;">
                  <a href="${Deno.env.get('SUPABASE_URL')?.replace('//', '//').replace(':54321', '')}" class="button">Přihlásit se</a>
                </div>
                <p><strong>Doporučení:</strong> Po prvním přihlášení si změňte heslo na vlastní.</p>
                <p>S pozdravem,<br>Tým Webfusion</p>
              </div>
              <div class="footer">
                <p>Tento email byl odeslán automaticky. Prosím neodpovídejte na něj.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Task Manager <noreply@webfusion.cz>',
            to: [email],
            subject: 'Vítejte v Task Manageru - Přihlašovací údaje',
            html: emailHtml,
          }),
        });
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }

    return new Response(
      JSON.stringify({ success: true, user: data.user }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});