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

    const portalMap = new Map<string, { name: string; loginToken: string | null }>();
    for (const w of allPortalWebsites) {
      const rawUrl = w.acf?.url_adresa_webu || '';
      const url = normalizeUrl(rawUrl);
      if (!url) continue;
      if (portalMap.has(url)) continue;
      portalMap.set(url, {
        name: w.title?.rendered || rawUrl,
        loginToken: w.acf?.prihlasovaci_token || null,
      });
    }

    const uniquePortalCount = portalMap.size;
    console.log(`Found ${uniquePortalCount} unique website URLs in portal`);

    const { data: existingWebsites } = await supabaseAdmin
      .from('websites')
      .select('id, url');

    const existingByNormalized = new Map<string, { id: string; originalUrl: string }[]>();
    for (const w of existingWebsites || []) {
      const norm = normalizeUrl(w.url);
      if (!existingByNormalized.has(norm)) {
        existingByNormalized.set(norm, []);
      }
      existingByNormalized.get(norm)!.push({ id: w.id, originalUrl: w.url });
    }

    let added = 0;
    let updated = 0;
    let removed = 0;
    let skipped = 0;
    let normalizedUrls = 0;

    for (const [normalizedUrl, portalInfo] of portalMap) {
      const existing = existingByNormalized.get(normalizedUrl);

      if (!existing || existing.length === 0) {
        try {
          const { error } = await supabaseAdmin
            .from('websites')
            .insert({
              url: normalizedUrl,
              name: portalInfo.name,
              owner_id: ownerId,
              login_token: portalInfo.loginToken,
            });

          if (error) {
            console.error(`Failed to add ${normalizedUrl}:`, error);
            skipped++;
          } else {
            console.log(`Added ${normalizedUrl}`);
            added++;
          }
        } catch (error) {
          console.error(`Error adding ${normalizedUrl}:`, error);
          skipped++;
        }
      } else {
        if (existing.length > 1) {
          console.log(`Deduplicating ${normalizedUrl}: ${existing.length} entries`);
          for (let i = 1; i < existing.length; i++) {
            const { error } = await supabaseAdmin
              .from('websites')
              .delete()
              .eq('id', existing[i].id);

            if (!error) {
              console.log(`Removed duplicate ${existing[i].originalUrl}`);
              removed++;
            }
          }
        }

        const keepEntry = existing[0];

        const updateData: Record<string, string | null> = {};
        if (portalInfo.loginToken) {
          updateData.login_token = portalInfo.loginToken;
        }
        if (keepEntry.originalUrl !== normalizedUrl) {
          updateData.url = normalizedUrl;
          normalizedUrls++;
        }

        if (Object.keys(updateData).length > 0) {
          const { error } = await supabaseAdmin
            .from('websites')
            .update(updateData)
            .eq('id', keepEntry.id);

          if (!error) updated++;
        }
      }
    }

    const portalNormalizedUrls = new Set(portalMap.keys());
    const websitesToRemove: { id: string; url: string }[] = [];

    for (const [normUrl, entries] of existingByNormalized) {
      if (!portalNormalizedUrls.has(normUrl)) {
        for (const entry of entries) {
          websitesToRemove.push({ id: entry.id, url: entry.originalUrl });
        }
      }
    }

    console.log(`Websites to remove (not in portal): ${websitesToRemove.length}`);

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
          console.log(`Removed ${website.url}`);
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

    const summary = `Sync completed: ${added} added, ${updated} updated, ${removed} removed, ${normalizedUrls} URLs normalized, ${skipped} skipped`;
    console.log(summary);

    return new Response(
      JSON.stringify({
        success: true,
        portalTotal: uniquePortalCount,
        added,
        updated,
        removed,
        normalizedUrls,
        skipped,
        message: summary,
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
