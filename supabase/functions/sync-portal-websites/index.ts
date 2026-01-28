import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PortalWebsite {
  id: number;
  acf?: {
    url_adresa_webu?: string;
  };
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

    const portalApiUrl = config.portal_url;

    console.log('Fetching websites from portal API...');
    let allPortalWebsites: PortalWebsite[] = [];
    let page = 1;
    let hasMore = true;
    let totalPages: number | null = null;

    while (hasMore) {
      const url = page === 1 ? portalApiUrl : `${portalApiUrl}?page=${page}`;
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
          console.log(`Reached last page (${totalPages})`);
        } else {
          page++;
        }
      }
    }

    console.log(`Fetched ${allPortalWebsites.length} websites from portal`);

    const portalUrls = allPortalWebsites
      .map(w => w.acf?.url_adresa_webu)
      .filter((url): url is string => !!url && url.trim() !== '');

    console.log(`Found ${portalUrls.length} valid website URLs`);

    const { data: existingWebsites } = await supabaseAdmin
      .from('websites')
      .select('id, url');

    const existingUrls = new Set(existingWebsites?.map(w => w.url) || []);

    const urlsToAdd = portalUrls.filter(url => !existingUrls.has(url));
    const urlsInPortal = new Set(portalUrls);
    const websitesToRemove = existingWebsites?.filter(w => !urlsInPortal.has(w.url)) || [];

    console.log(`URLs to add: ${urlsToAdd.length}`);
    console.log(`URLs to remove: ${websitesToRemove.length}`);

    let added = 0;
    let removed = 0;
    let skipped = 0;

    for (const url of urlsToAdd) {
      try {
        const { error } = await supabaseAdmin
          .from('websites')
          .insert({
            url: url,
            name: url,
          });

        if (error) {
          console.error(`Failed to add ${url}:`, error);
          skipped++;
        } else {
          console.log(`✓ Added ${url}`);
          added++;
        }
      } catch (error) {
        console.error(`Error adding ${url}:`, error);
        skipped++;
      }
    }

    for (const website of websitesToRemove) {
      try {
        const { error } = await supabaseAdmin
          .from('websites')
          .delete()
          .eq('id', website.id);

        if (error) {
          console.error(`Failed to remove ${website.url}:`, error);
          skipped++;
        } else {
          console.log(`✓ Removed ${website.url}`);
          removed++;
        }
      } catch (error) {
        console.error(`Error removing ${website.url}:`, error);
        skipped++;
      }
    }

    await supabaseAdmin
      .from('portal_sync_config')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_error: null,
      })
      .eq('id', config.id);

    console.log(`Sync completed: ${added} added, ${removed} removed, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        total: portalUrls.length,
        added,
        removed,
        skipped,
        message: `Sync completed successfully`,
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
    console.error('Sync error:', error);

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
