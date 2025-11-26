import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  action: 'reset-password' | 'delete-user' | 'set-external-id' | 'update-user-profile';
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

    if (action === 'delete-user') {
      // Kontrola globálních dat před smazáním
      const { data: globalFolders } = await supabaseClient
        .from('folders')
        .select('id, name')
        .eq('owner_id', userId)
        .eq('is_global', true);

      if (globalFolders && globalFolders.length > 0) {
        const folderNames = globalFolders.map(f => f.name).join(', ');
        console.warn(`User ${userId} has global folders that will become ownerless: ${folderNames}`);
      }

      // Kontrola kategorií
      const { data: categories } = await supabaseClient
        .from('categories')
        .select('id, name')
        .eq('owner_id', userId);

      if (categories && categories.length > 0) {
        console.warn(`User ${userId} has ${categories.length} categories that will become ownerless`);
      }

      // Kontrola request types
      const { data: requestTypes } = await supabaseClient
        .from('request_types')
        .select('id, name')
        .eq('created_by', userId);

      if (requestTypes && requestTypes.length > 0) {
        console.warn(`User ${userId} has ${requestTypes.length} request types that will become ownerless`);
      }

      // Smazat uživatele - jeho globální data zůstanou s owner_id = NULL
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