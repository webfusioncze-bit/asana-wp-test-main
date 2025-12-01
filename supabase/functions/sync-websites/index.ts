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

    // Check if a specific website ID was provided
    let websiteId = null;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        websiteId = body.websiteId;
      } catch (e) {
        // No body or invalid JSON, sync all websites
      }
    }

    // Fetch websites to sync
    let query = supabaseAdmin
      .from('websites')
      .select('id, url, name, last_sync_at');

    if (websiteId) {
      query = query.eq('id', websiteId);
      console.log(`Syncing specific website: ${websiteId}`);
    } else {
      console.log('Syncing all websites');
    }

    const { data: websites, error: websitesError } = await query;

    if (websitesError) {
      throw new Error(`Failed to fetch websites: ${websitesError.message}`);
    }

    if (!websites || websites.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          syncedWebsites: 0,
          failedWebsites: 0,
          results: [],
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log(`Found ${websites.length} websites to sync`);

    const results = [];

    for (const website of websites) {
      try {
        console.log(`Syncing website: ${website.name} (${website.url})`);

        const startTime = Date.now();
        let isAvailable = true;
        let responseTimeMs = null;

        try {
          const healthCheck = await fetch(website.url, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'Supabase-Edge-Function/1.0',
            },
          });
          responseTimeMs = Date.now() - startTime;
          isAvailable = healthCheck.ok;
        } catch (error) {
          isAvailable = false;
          console.error(`Availability check failed for ${website.name}:`, error);
        }

        const feedUrl = `${website.url}/wp-content/plugins/webfusion-connector/feeds/stav-webu.xml`;

        const response = await fetch(feedUrl, {
          headers: {
            'User-Agent': 'Supabase-Edge-Function/1.0',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const xmlText = await response.text();

        const parseXmlValue = (xml: string, tag: string): string | null => {
          const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
          const match = xml.match(regex);
          return match ? match[1].trim() : null;
        };

        const parseXmlInt = (xml: string, tag: string): number => {
          const value = parseXmlValue(xml, tag);
          return value ? parseInt(value, 10) : 0;
        };

        const extractPlugins = (xml: string, containerTag: string): any[] => {
          const regex = new RegExp(`<${containerTag}>(.*?)</${containerTag}>`, 'is');
          const match = xml.match(regex);
          if (!match) return [];

          const pluginsXml = match[1];
          const pluginRegex = /<plugin>(.*?)<\/plugin>/gis;
          const plugins = [];
          let pluginMatch;

          while ((pluginMatch = pluginRegex.exec(pluginsXml)) !== null) {
            const pluginXml = pluginMatch[1];
            plugins.push({
              name: parseXmlValue(pluginXml, 'name'),
              version: parseXmlValue(pluginXml, 'version'),
              author: parseXmlValue(pluginXml, 'author'),
            });
          }

          return plugins;
        };

        const extractUsers = (xml: string): any[] => {
          const regex = /<users>(.*?)<\/users>/is;
          const match = xml.match(regex);
          if (!match) return [];

          const usersXml = match[1];
          const userRegex = /<user>(.*?)<\/user>/gis;
          const users = [];
          let userMatch;

          while ((userMatch = userRegex.exec(usersXml)) !== null) {
            const userXml = userMatch[1];
            users.push({
              username: parseXmlValue(userXml, 'username'),
              email: parseXmlValue(userXml, 'email'),
              role: parseXmlValue(userXml, 'role'),
            });
          }

          return users;
        };

        const activePlugins = extractPlugins(xmlText, 'active_plugins');
        const inactivePlugins = extractPlugins(xmlText, 'inactive_plugins');
        const updatePlugins = extractPlugins(xmlText, 'update_plugins');
        const users = extractUsers(xmlText);
        const ult = parseXmlValue(xmlText, 'ult');

        const statusData = {
          website_id: website.id,
          last_updated: parseXmlValue(xmlText, 'last_updated'),
          wordpress_version: parseXmlValue(xmlText, 'wordpress_version'),
          php_version: parseXmlValue(xmlText, 'php_version'),
          mysql_version: parseXmlValue(xmlText, 'mysql_version'),
          memory_limit: parseXmlValue(xmlText, 'memory_limit'),
          upload_max_filesize: parseXmlValue(xmlText, 'upload_max_filesize'),
          num_pages: parseXmlInt(xmlText, 'num_pages'),
          num_posts: parseXmlInt(xmlText, 'num_posts'),
          num_comments: parseXmlInt(xmlText, 'num_comments'),
          num_users: parseXmlInt(xmlText, 'num_users'),
          num_media_files: parseXmlInt(xmlText, 'num_media_files'),
          https_status: parseXmlValue(xmlText, 'https_status'),
          indexing_allowed: parseXmlValue(xmlText, 'indexing_allowed'),
          storage_usage: parseXmlValue(xmlText, 'storage_usage'),
          active_plugins_count: parseXmlInt(xmlText, 'active_plugins_count'),
          inactive_plugins_count: parseXmlInt(xmlText, 'inactive_plugins_count'),
          update_plugins_count: parseXmlInt(xmlText, 'update_plugins_count'),
          theme_name: parseXmlValue(xmlText, 'theme_name'),
          theme_version: parseXmlValue(xmlText, 'theme_version'),
          server_load: parseXmlValue(xmlText, 'server_load'),
          uptime: parseXmlValue(xmlText, 'uptime'),
          ult: ult,
          raw_data: {
            active_plugins: activePlugins,
            inactive_plugins: inactivePlugins,
            update_plugins: updatePlugins,
            users: users,
          },
        };

        const { error: statusError } = await supabaseAdmin
          .from('website_status')
          .insert(statusData);

        if (statusError) {
          throw new Error(`Failed to insert status: ${statusError.message}`);
        }

        const { error: updateError } = await supabaseAdmin
          .from('websites')
          .update({
            last_sync_at: new Date().toISOString(),
            sync_error: null,
            login_token: ult,
            is_available: isAvailable,
            last_check_at: new Date().toISOString(),
            response_time_ms: responseTimeMs,
          })
          .eq('id', website.id);

        if (updateError) {
          throw new Error(`Failed to update website: ${updateError.message}`);
        }

        results.push({
          websiteId: website.id,
          websiteName: website.name,
          success: true,
        });

        console.log(`✓ Synced ${website.name}`);
      } catch (error) {
        console.error(`Failed to sync website ${website.name}:`, error);

        await supabaseAdmin
          .from('websites')
          .update({
            sync_error: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', website.id);

        results.push({
          websiteId: website.id,
          websiteName: website.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedWebsites: results.filter(r => r.success).length,
        failedWebsites: results.filter(r => !r.success).length,
        results,
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