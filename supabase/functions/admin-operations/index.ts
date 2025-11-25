import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  action: 'reset-password' | 'delete-user' | 'set-external-id';
  userId: string;
  newPassword?: string;
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
        JSON.stringify({ error: 'Only admins can perform these operations' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const { action, userId, newPassword, externalId }: RequestBody = await req.json();

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
      const { data: userData, error: getUserError } = await supabaseAdmin
        .from('auth.users')
        .select('raw_user_meta_data')
        .eq('id', userId)
        .single();
      
      if (getUserError) {
        console.error('Error getting user:', getUserError);
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const currentMetadata = userData?.raw_user_meta_data || {};
      const updatedMetadata = { ...currentMetadata };
      
      if (externalId && externalId.trim()) {
        updatedMetadata.external_id = externalId.trim();
      } else {
        delete updatedMetadata.external_id;
      }

      const { error: updateError } = await supabaseAdmin
        .from('auth.users')
        .update({ raw_user_meta_data: updatedMetadata })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating user metadata:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'External ID updated successfully' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (action === 'delete-user') {
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

      return new Response(
        JSON.stringify({ success: true, message: 'User deleted successfully' }),
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