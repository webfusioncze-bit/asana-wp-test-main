import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get portal sync config
    const { data: config, error: configError } = await supabaseAdmin
      .from('portal_sync_config')
      .select('*')
      .eq('is_enabled', true)
      .maybeSingle();

    if (configError) {
      throw new Error(`Failed to fetch config: ${configError.message}`);
    }

    if (!config) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Portal sync is not configured or disabled',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log(`Fetching websites from portal: ${config.portal_url}`);

    // Fetch websites from portal
    const response = await fetch(config.portal_url, {
      headers: {
        'User-Agent': 'Supabase-Edge-Function/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch portal: ${response.statusText}`);
    }

    const portalWebsites = await response.json();

    if (!Array.isArray(portalWebsites)) {
      throw new Error('Invalid portal response format');
    }

    console.log(`Found ${portalWebsites.length} websites in portal`);

    // Get current websites from database
    const { data: currentWebsites, error: websitesError } = await supabaseAdmin
      .from('websites')
      .select('id, url, name');

    if (websitesError) {
      throw new Error(`Failed to fetch current websites: ${websitesError.message}`);
    }

    const currentWebsiteUrls = new Set(currentWebsites?.map(w => w.url.toLowerCase()) || []);
    const portalWebsiteUrls = new Set<string>();

    let added = 0;
    let skipped = 0;

    // Get first admin user as owner
    const { data: adminUser } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    if (!adminUser) {
      throw new Error('No admin user found');
    }

    // Add new websites from portal
    for (const portalSite of portalWebsites) {
      const url = portalSite.acf?.url_adresa_webu;
      if (!url) continue;

      let normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }

      portalWebsiteUrls.add(normalizedUrl.toLowerCase());

      if (currentWebsiteUrls.has(normalizedUrl.toLowerCase())) {
        skipped++;
        continue;
      }

      // Extract website name from title or URL
      const name = portalSite.title?.rendered || portalSite.acf?.nazev_webu || normalizedUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

      const { error: insertError } = await supabaseAdmin
        .from('websites')
        .insert({
          url: normalizedUrl,
          name: name,
          owner_id: adminUser.user_id,
        });

      if (insertError) {
        console.error(`Failed to add website ${normalizedUrl}:`, insertError);
      } else {
        added++;
        console.log(`✓ Added website: ${name}`);
      }
    }

    // Remove websites that are no longer in portal
    let removed = 0;
    if (currentWebsites) {
      for (const website of currentWebsites) {
        if (!portalWebsiteUrls.has(website.url.toLowerCase())) {
          const { error: deleteError } = await supabaseAdmin
            .from('websites')
            .delete()
            .eq('id', website.id);

          if (deleteError) {
            console.error(`Failed to remove website ${website.url}:`, deleteError);
          } else {
            removed++;
            console.log(`✗ Removed website: ${website.name}`);
          }
        }
      }
    }

    // Update config with last sync time
    await supabaseAdmin
      .from('portal_sync_config')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_error: null,
      })
      .eq('id', config.id);

    return new Response(
      JSON.stringify({
        success: true,
        added,
        removed,
        skipped,
        total: portalWebsites.length,
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
    console.error('Portal sync error:', error);

    // Try to update config with error
    try {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabaseAdmin
        .from('portal_sync_config')
        .update({
          sync_error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('is_enabled', true);
    } catch (updateError) {
      console.error('Failed to update config with error:', updateError);
    }

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