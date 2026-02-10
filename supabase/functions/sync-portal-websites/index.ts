import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PortalWebsite {
  id: number;
  title?: { rendered?: string };
  acf?: {
    url_adresa_webu?: string;
    prihlasovaci_token?: string;
  };
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '').trim();
}

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

    const { data: config } = await supabaseAdmin
      .from('portal_sync_config')
      .select('*')
      .maybeSingle();

    if (!config || !config.is_enabled) {
      return new Response(
        JSON.stringify({ success: false, error: 'Portal sync is not configured or disabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: adminRole } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    if (!adminRole) {
      throw new Error('No admin user found to assign as website owner');
    }

    const ownerId = adminRole.user_id;
    const portalApiUrl = config.portal_url;

    console.log('Fetching websites from portal API...');
    let allPortalWebsites: PortalWebsite[] = [];
    let page = 1;
    let hasMore = true;
    let totalPages: number | null = null;

    while (hasMore) {
      const separator = portalApiUrl.includes('?') ? '&' : '?';
      const url = `${portalApiUrl}${separator}per_page=100&page=${page}`;
      console.log(`Fetching page ${page}: ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Supabase-Edge-Function/1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`Failed to fetch portal API: ${response.status} ${response.statusText}`);
      }

      if (page === 1) {
        const totalPagesHeader = response.headers.get('X-WP-TotalPages');
        if (totalPagesHeader) {
          totalPages = parseInt(totalPagesHeader, 10);
          console.log(`Total pages from API: ${totalPages}`);
        }
      }

      const pageData: PortalWebsite[] = await response.json();
      console.log(`Received ${pageData.length} websites from page ${page}`);

      if (pageData.length === 0) {
        hasMore = false;
      } else {
        allPortalWebsites = allPortalWebsites.concat(pageData);
        if (totalPages && page >= totalPages) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    console.log(`Fetched ${allPortalWebsites.length} websites from portal`);

    const portalData = allPortalWebsites
      .map(w => ({
        url: normalizeUrl(w.acf?.url_adresa_webu || ''),
        name: w.title?.rendered || w.acf?.url_adresa_webu || '',
        loginToken: w.acf?.prihlasovaci_token || null,
      }))
      .filter(w => w.url !== '');

    console.log(`Found ${portalData.length} valid website URLs`);

    const { data: existingWebsites } = await supabaseAdmin
      .from('websites')
      .select('id, url');

    const existingUrlMap = new Map<string, string>();
    for (const w of existingWebsites || []) {
      existingUrlMap.set(normalizeUrl(w.url), w.id);
    }

    const toAdd = portalData.filter(w => !existingUrlMap.has(w.url));

    console.log(`URLs to add: ${toAdd.length}`);

    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const website of toAdd) {
      try {
        const { error } = await supabaseAdmin
          .from('websites')
          .insert({
            url: website.url,
            name: website.name,
            owner_id: ownerId,
            login_token: website.loginToken,
          });

        if (error) {
          console.error(`Failed to add ${website.url}:`, error);
          skipped++;
        } else {
          console.log(`Added ${website.url}`);
          added++;
        }
      } catch (error) {
        console.error(`Error adding ${website.url}:`, error);
        skipped++;
      }
    }

    for (const website of portalData) {
      const existingId = existingUrlMap.get(website.url);
      if (existingId && website.loginToken) {
        const { error } = await supabaseAdmin
          .from('websites')
          .update({ login_token: website.loginToken })
          .eq('id', existingId);

        if (!error) updated++;
      }
    }

    await supabaseAdmin
      .from('portal_sync_config')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_error: null,
      })
      .eq('id', config.id);

    console.log(`Sync completed: ${added} added, ${updated} updated, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        total: portalData.length,
        added,
        updated,
        skipped,
        message: `Sync completed successfully`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);

    try {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { data: config } = await supabaseAdmin
        .from('portal_sync_config')
        .select('id')
        .maybeSingle();

      if (config) {
        await supabaseAdmin
          .from('portal_sync_config')
          .update({
            sync_error: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', config.id);
      }
    } catch (_) {}

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
