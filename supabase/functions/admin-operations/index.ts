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

      const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || null;
      if (displayName) {
        updateData.display_name = displayName;
      }

      console.log('Update data:', updateData);

      const { data: updateResult, error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { user_metadata: updateData }
      );

      if (metadataError) {
        console.error('Error updating user metadata:', metadataError);
        return new Response(
          JSON.stringify({ error: metadataError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      console.log('User metadata updated successfully:', updateResult);

      return new Response(
        JSON.stringify({ success: true, message: 'User profile updated successfully' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (action === 'send-invitation') {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: (await supabaseAdmin.auth.admin.getUserById(userId)).data.user?.email || '',
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

      const resetUrl = linkData.properties.action_link;

      const emailUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`;
      const emailResponse = await fetch(emailUrl, {
        method: 'POST',
        headers: {
          'Authorization': req.headers.get('Authorization')!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: (await supabaseAdmin.auth.admin.getUserById(userId)).data.user?.email || '',
          subject: 'Pozvánka do systému',
          html: `
            <h2>Vítejte v systému Task Manager</h2>
            <p>Byli jste pozváni do systému. Pro nastavení hesla a přihlášení klikněte na následující odkaz:</p>
            <p><a href="${resetUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Nastavit heslo</a></p>
            <p>Odkaz je platný 60 minut.</p>
            <p>Pokud jste tuto pozvánku neočekávali, ignorujte tento email.</p>
          `,
          text: `Vítejte v systému Task Manager\n\nByli jste pozváni do systému. Pro nastavení hesla a přihlášení použijte následující odkaz:\n\n${resetUrl}\n\nOdkaz je platný 60 minut.\n\nPokud jste tuto pozvánku neočekávali, ignorujte tento email.`,
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
        JSON.stringify({ success: true, message: 'Pozvánka byla úspěšně odeslána' }),
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