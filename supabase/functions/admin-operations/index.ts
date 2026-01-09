import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  action: 'reset-password' | 'delete-user' | 'set-external-id' | 'update-user-profile' | 'send-invitation';
  userId: string;
  newPassword?: string;
  externalId?: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
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
        JSON.stringify({ error: 'Only admins can perform these operations' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const body: RequestBody = await req.json();
    const { action, userId, newPassword, externalId, firstName, lastName, avatarUrl } = body;

    if (!action || !userId) {
      return new Response(
        JSON.stringify({ error: 'Action and userId are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (action === 'reset-password') {
      if (!newPassword) {
        return new Response(
          JSON.stringify({ error: 'newPassword is required for password reset' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Password updated successfully' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (action === 'set-external-id') {
      const { data, error: rpcError } = await supabaseClient.rpc('update_user_external_id', {
        target_user_id: userId,
        new_external_id: externalId || null
      });

      if (rpcError) {
        console.error('Error updating external ID:', rpcError);
        return new Response(
          JSON.stringify({ error: rpcError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'External ID updated successfully', data }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (action === 'update-user-profile') {
      console.log('Updating user profile:', { userId, firstName, lastName, avatarUrl });

      const updateData: any = {};
      if (firstName !== undefined) updateData.first_name = firstName;
      if (lastName !== undefined) updateData.last_name = lastName;
      if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;

      console.log('Update data for user_roles:', updateData);

      const { error: updateError } = await supabaseAdmin
        .from('user_roles')
        .update(updateData)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating user_roles:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      console.log('User profile updated successfully in user_roles');

      return new Response(
        JSON.stringify({ success: true, message: 'User profile updated successfully' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (action === 'send-invitation') {
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

      if (userError || !userData.user) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const userEmail = userData.user.email || '';

      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: userEmail,
      });

      if (linkError || !linkData) {
        console.error('Error generating invitation link:', linkError);
        return new Response(
          JSON.stringify({ error: linkError?.message || 'Failed to generate invitation link' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const originalUrl = new URL(linkData.properties.action_link);

      const token = originalUrl.searchParams.get('token');
      const tokenHash = originalUrl.searchParams.get('token_hash');
      const type = originalUrl.searchParams.get('type') || 'recovery';

      const tokenValue = tokenHash || token || linkData.properties.hashed_token;
      const tokenParamName = tokenHash ? 'token_hash' : 'token';

      const resetUrl = `https://task.webfusion.cz#${tokenParamName}=${tokenValue}&type=${type}`;

      const { data: userProfile } = await supabaseClient
        .from('user_profiles')
        .select('display_name, first_name, last_name, last_sign_in_at')
        .eq('id', userId)
        .maybeSingle();

      const userName = userProfile?.first_name && userProfile?.last_name
        ? `${userProfile.first_name} ${userProfile.last_name}`
        : userProfile?.display_name || userEmail;

      const userInitials = userProfile?.first_name && userProfile?.last_name
        ? `${userProfile.first_name[0]}${userProfile.last_name[0]}`.toUpperCase()
        : userProfile?.display_name?.[0]?.toUpperCase() || userEmail[0].toUpperCase();

      const isNewUser = !userProfile?.last_sign_in_at;
      const subject = isNewUser ? 'Pozvánka do Task Manager' : 'Odkaz pro změnu hesla - Task Manager';

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
              .user-section {
                padding: 24px 40px;
                display: flex;
                align-items: center;
                gap: 12px;
              }
              .avatar {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: linear-gradient(135deg, #2ab8b8 0%, #22a0a0 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 600;
                font-size: 16px;
                flex-shrink: 0;
              }
              .user-text {
                flex: 1;
              }
              .user-name {
                font-size: 18px;
                font-weight: 600;
                color: #151b26;
                line-height: 1.4;
                margin-bottom: 4px;
              }
              .user-subtitle {
                font-size: 14px;
                color: #6b7280;
              }
              .content-section {
                padding: 0 40px 24px;
              }
              .message {
                font-size: 15px;
                color: #374151;
                line-height: 1.6;
                margin-bottom: 24px;
              }
              .btn {
                display: inline-block;
                background-color: #22a0a0;
                color: #ffffff !important;
                text-decoration: none;
                padding: 14px 28px;
                border-radius: 6px;
                font-weight: 600;
                font-size: 15px;
              }
              .info-box {
                margin: 24px 40px 32px;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 20px;
                background-color: #fafafa;
              }
              .info-title {
                font-size: 14px;
                font-weight: 600;
                color: #374151;
                margin-bottom: 8px;
              }
              .info-text {
                font-size: 13px;
                color: #6b7280;
                line-height: 1.6;
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

              <div class="user-section">
                <div class="avatar">${userInitials}</div>
                <div class="user-text">
                  <div class="user-name">${isNewUser ? 'Vítejte v Task Manager' : 'Resetování hesla'}</div>
                  <div class="user-subtitle">${userName}</div>
                </div>
              </div>

              <div class="content-section">
                <p class="message">
                  ${isNewUser
                    ? 'Byli jste pozváni do systému Task Manager. Pro dokončení registrace a nastavení hesla klikněte na tlačítko níže.'
                    : 'Obdrželi jste žádost o změnu hesla. Pro nastavení nového hesla klikněte na tlačítko níže.'}
                </p>
                <a href="${resetUrl}" class="btn">${isNewUser ? 'Nastavit heslo a přihlásit se' : 'Změnit heslo'}</a>
              </div>

              <div class="info-box">
                <div class="info-title">Důležité informace:</div>
                <div class="info-text">
                  • Odkaz je platný pouze 60 minut<br>
                  • Po kliknutí na odkaz budete vyzváni k nastavení nového hesla<br>
                  • ${isNewUser ? 'Po nastavení hesla se budete moci přihlásit do systému' : 'Po změně hesla použijte nové heslo pro přihlášení'}<br>
                  • Pokud jste tuto akci nevyžádali, tento email ignorujte
                </div>
              </div>

              <div class="footer">
                Toto je automaticky generovaný email ze systému Task Manager.<br>
                Pro více informací navštivte <a href="https://task.webfusion.cz" class="footer-link">task.webfusion.cz</a>
              </div>
            </div>
          </body>
        </html>
      `;

      const text = `
${isNewUser ? 'Vítejte v Task Manager' : 'Resetování hesla'}
${userName}

${isNewUser
  ? 'Byli jste pozváni do systému Task Manager. Pro dokončení registrace a nastavení hesla použijte následující odkaz:'
  : 'Obdrželi jste žádost o změnu hesla. Pro nastavení nového hesla použijte následující odkaz:'}

${resetUrl}

Důležité informace:
• Odkaz je platný pouze 60 minut
• Po kliknutí na odkaz budete vyzváni k nastavení nového hesla
• ${isNewUser ? 'Po nastavení hesla se budete moci přihlásit do systému' : 'Po změně hesla použijte nové heslo pro přihlášení'}
• Pokud jste tuto akci nevyžádali, tento email ignorujte

---
Toto je automaticky generovaný email ze systému Task Manager.
Pro více informací navštivte task.webfusion.cz
      `.trim();

      const emailUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`;
      const emailResponse = await fetch(emailUrl, {
        method: 'POST',
        headers: {
          'Authorization': req.headers.get('Authorization')!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: userEmail,
          subject,
          html,
          text,
        }),
      });

      const emailResult = await emailResponse.json();

      if (!emailResponse.ok) {
        console.error('Error sending invitation email:', emailResult);
        return new Response(
          JSON.stringify({ error: 'Pozvánka byla vytvořena, ale email se nepodařilo odeslat: ' + (emailResult.error || 'Neznámá chyba') }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: isNewUser ? 'Pozvánka byla úspěšně odeslána' : 'Email pro změnu hesla byl úspěšně odeslán' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (action === 'delete-user') {
      const { data: globalFolders } = await supabaseClient
        .from('folders')
        .select('id, name')
        .eq('owner_id', userId)
        .eq('is_global', true);

      if (globalFolders && globalFolders.length > 0) {
        const folderNames = globalFolders.map(f => f.name).join(', ');
        console.warn(`User ${userId} has global folders that will become ownerless: ${folderNames}`);
      }

      const { data: categories } = await supabaseClient
        .from('categories')
        .select('id, name')
        .eq('owner_id', userId);

      if (categories && categories.length > 0) {
        console.warn(`User ${userId} has ${categories.length} categories that will become ownerless`);
      }

      const { data: requestTypes } = await supabaseClient
        .from('request_types')
        .select('id, name')
        .eq('created_by', userId);

      if (requestTypes && requestTypes.length > 0) {
        console.warn(`User ${userId} has ${requestTypes.length} request types that will become ownerless`);
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const message = globalFolders && globalFolders.length > 0
        ? `Uživatel byl smazán. ${globalFolders.length} globálních složek zůstalo bez vlastníka a může je spravovat pouze admin.`
        : 'Uživatel byl úspěšně smazán';

      return new Response(
        JSON.stringify({
          success: true,
          message,
          orphanedData: {
            globalFolders: globalFolders?.length || 0,
            categories: categories?.length || 0,
            requestTypes: requestTypes?.length || 0,
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Admin operations error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});