import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PortalProject {
  id: number;
  parent: number;
  title?: {
    rendered?: string;
  };
  acf?: {
    nazev_projektu?: string;
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

    if (!config || !config.projects_sync_enabled) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Projects sync is not configured or disabled',
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

    const portalApiUrl = config.projects_portal_url;
    const portalBaseUrl = portalApiUrl.split('/wp-json')[0];

    console.log('Fetching projects from portal API...');
    let allPortalProjects: PortalProject[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${portalApiUrl}?page=${page}&per_page=100`;
      console.log(`Fetching page ${page}: ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Supabase-Edge-Function/1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 400 && page > 1) {
          console.log('No more pages available');
          hasMore = false;
          break;
        }
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`Failed to fetch portal API: ${response.status} ${response.statusText}`);
      }

      const pageData: PortalProject[] = await response.json();
      console.log(`Received ${pageData.length} projects from page ${page}`);

      if (pageData.length === 0) {
        hasMore = false;
      } else {
        allPortalProjects = allPortalProjects.concat(pageData);
        page++;

        if (pageData.length < 100) {
          hasMore = false;
        }
      }
    }

    console.log(`Fetched ${allPortalProjects.length} items from portal`);

    const mainProjects = allPortalProjects.filter(project => project.parent === 0);
    console.log(`Filtered to ${mainProjects.length} main projects (parent=0), excluding ${allPortalProjects.length - mainProjects.length} phases`);

    const portalProjectsMap = new Map<string, PortalProject>();
    mainProjects.forEach(project => {
      if (project.id) {
        portalProjectsMap.set(String(project.id), project);
      }
    });

    const portalExternalIds = Array.from(portalProjectsMap.keys());
    console.log(`Found ${portalExternalIds.length} valid project IDs`);

    const { data: existingProjects } = await supabaseAdmin
      .from('projects')
      .select('id, name, external_project_id')
      .not('external_project_id', 'is', null);

    const existingExternalIds = new Set(existingProjects?.map(p => p.external_project_id) || []);

    const idsToAdd = portalExternalIds.filter(id => !existingExternalIds.has(id));
    const idsInPortal = new Set(portalExternalIds);
    const projectsToRemove = existingProjects?.filter(p => !idsInPortal.has(p.external_project_id)) || [];

    console.log(`Projects to add: ${idsToAdd.length}`);
    console.log(`Projects to remove: ${projectsToRemove.length}`);

    let added = 0;
    let removed = 0;
    let skipped = 0;

    for (const externalId of idsToAdd) {
      try {
        const portalProject = portalProjectsMap.get(externalId);
        if (!portalProject) {
          skipped++;
          continue;
        }

        const projectName = portalProject.acf?.nazev_projektu ||
                           portalProject.title?.rendered ||
                           `Project ${externalId}`;

        const importSourceUrl = `${portalBaseUrl}/wp-json/wp/v2/projekt/${externalId}`;

        const { error } = await supabaseAdmin
          .from('projects')
          .insert({
            name: projectName,
            external_project_id: externalId,
            import_source_url: importSourceUrl,
            sync_enabled: true,
            project_type: 'vývoj',
            project_category: 'klientský',
            status: 'aktivní',
          });

        if (error) {
          console.error(`Failed to add project ${projectName}:`, error);
          skipped++;
        } else {
          console.log(`✓ Added ${projectName} (${externalId})`);
          added++;
        }
      } catch (error) {
        console.error(`Error adding project ${externalId}:`, error);
        skipped++;
      }
    }

    for (const project of projectsToRemove) {
      try {
        const { error } = await supabaseAdmin
          .from('projects')
          .delete()
          .eq('id', project.id);

        if (error) {
          console.error(`Failed to remove ${project.name}:`, error);
          skipped++;
        } else {
          console.log(`✓ Removed ${project.name}`);
          removed++;
        }
      } catch (error) {
        console.error(`Error removing ${project.name}:`, error);
        skipped++;
      }
    }

    await supabaseAdmin
      .from('portal_sync_config')
      .update({
        projects_last_sync_at: new Date().toISOString(),
        projects_sync_error: null,
      })
      .eq('id', config.id);

    console.log(`Sync completed: ${added} added, ${removed} removed, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        total: portalExternalIds.length,
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
          projects_sync_error: error instanceof Error ? error.message : 'Unknown error',
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