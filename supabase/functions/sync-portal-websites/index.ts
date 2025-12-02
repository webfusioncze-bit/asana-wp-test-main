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

    const portalFeedUrl = "https://portal.webfusion.cz/webs_feed.xml";

    console.log('Fetching portal feed...');
    const response = await fetch(portalFeedUrl, {
      headers: {
        'User-Agent': 'Supabase-Edge-Function/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch portal feed: ${response.statusText}`);
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

    const extractSimplePluginList = (xml: string, containerTag: string): string[] => {
      const regex = new RegExp(`<${containerTag}>(.*?)</${containerTag}>`, 'is');
      const match = xml.match(regex);
      if (!match) return [];

      const pluginsXml = match[1];
      const pluginRegex = /<plugin>([^<]+)<\/plugin>/gi;
      const plugins: string[] = [];
      let pluginMatch;

      while ((pluginMatch = pluginRegex.exec(pluginsXml)) !== null) {
        const pluginName = pluginMatch[1].trim();
        if (pluginName) {
          plugins.push(pluginName);
        }
      }

      return plugins;
    };

    const extractUpdatePlugins = (xml: string): any[] => {
      const regex = /<update_plugins>(.*?)<\/update_plugins>/is;
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
          current_version: parseXmlValue(pluginXml, 'current_version'),
          new_version: parseXmlValue(pluginXml, 'new_version'),
        });
      }

      return plugins;
    };

    const extractUsers = (xml: string): string[] => {
      const regex = /<users>(.*?)<\/users>/is;
      const match = xml.match(regex);
      if (!match) return [];

      const usersXml = match[1];
      const userRegex = /<user>([^<]+)<\/user>/gi;
      const users: string[] = [];
      let userMatch;

      while ((userMatch = userRegex.exec(usersXml)) !== null) {
        const username = userMatch[1].trim();
        if (username) {
          users.push(username);
        }
      }

      return users;
    };

    const webRegex = /<web>(.*?)<\/web>/gis;
    let webMatch;
    const results = [];

    while ((webMatch = webRegex.exec(xmlText)) !== null) {
      const webXml = webMatch[1];
      const webUrl = parseXmlValue(webXml, 'post');

      if (!webUrl) continue;

      try {
        console.log(`Processing website: ${webUrl}`);

        let website = await supabaseAdmin
          .from('websites')
          .select('id')
          .eq('url', webUrl)
          .maybeSingle();

        let websiteId;

        if (!website.data) {
          const { data: newWebsite, error: insertError } = await supabaseAdmin
            .from('websites')
            .insert({
              url: webUrl,
              name: webUrl,
            })
            .select('id')
            .single();

          if (insertError) {
            console.error(`Failed to create website ${webUrl}:`, insertError);
            continue;
          }

          websiteId = newWebsite.id;
        } else {
          websiteId = website.data.id;
        }

        const startTime = Date.now();
        let isAvailable = true;
        let responseTimeMs = null;

        try {
          const healthCheck = await fetch(webUrl, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'Supabase-Edge-Function/1.0',
            },
          });
          responseTimeMs = Date.now() - startTime;
          isAvailable = healthCheck.ok;
        } catch (error) {
          isAvailable = false;
        }

        const activePlugins = extractSimplePluginList(webXml, 'active_plugins');
        const inactivePlugins = extractSimplePluginList(webXml, 'inactive_plugins');
        const updatePlugins = extractUpdatePlugins(webXml);
        const users = extractUsers(webXml);
        const ult = parseXmlValue(webXml, 'ult');

        const statusData = {
          website_id: websiteId,
          last_updated: parseXmlValue(webXml, 'last_updated'),
          wordpress_version: parseXmlValue(webXml, 'wordpress_version'),
          php_version: parseXmlValue(webXml, 'php_version'),
          mysql_version: parseXmlValue(webXml, 'mysql_version'),
          memory_limit: parseXmlValue(webXml, 'memory_limit'),
          upload_max_filesize: parseXmlValue(webXml, 'upload_max_filesize'),
          num_pages: parseXmlInt(webXml, 'num_pages'),
          num_posts: parseXmlInt(webXml, 'num_posts'),
          num_comments: parseXmlInt(webXml, 'num_comments'),
          num_users: parseXmlInt(webXml, 'num_users'),
          num_media_files: parseXmlInt(webXml, 'num_media_files'),
          https_status: parseXmlValue(webXml, 'https_status'),
          indexing_allowed: parseXmlValue(webXml, 'indexing_allowed'),
          storage_usage: parseXmlValue(webXml, 'storage_usage'),
          active_plugins_count: parseXmlInt(webXml, 'active_plugins_count'),
          inactive_plugins_count: parseXmlInt(webXml, 'inactive_plugins_count'),
          update_plugins_count: parseXmlInt(webXml, 'update_plugins_count'),
          theme_name: parseXmlValue(webXml, 'theme_name'),
          theme_version: parseXmlValue(webXml, 'theme_version'),
          server_load: parseXmlValue(webXml, 'server_load'),
          uptime: parseXmlValue(webXml, 'uptime'),
          ult: ult,
          raw_data: {
            active_plugins: activePlugins.map(name => ({ name, version: null, author: null })),
            inactive_plugins: inactivePlugins.map(name => ({ name, version: null, author: null })),
            update_plugins: updatePlugins,
            users: users.map(username => ({ username, email: null, role: null })),
          },
        };

        const { error: statusError } = await supabaseAdmin
          .from('website_status')
          .insert(statusData);

        if (statusError) {
          console.error(`Failed to insert status for ${webUrl}:`, statusError);
          continue;
        }

        await supabaseAdmin
          .from('websites')
          .update({
            last_sync_at: new Date().toISOString(),
            sync_error: null,
            login_token: ult,
            is_available: isAvailable,
            last_check_at: new Date().toISOString(),
            response_time_ms: responseTimeMs,
          })
          .eq('id', websiteId);

        results.push({
          websiteUrl: webUrl,
          success: true,
        });

        console.log(`✓ Synced ${webUrl}`);
      } catch (error) {
        console.error(`Failed to process website ${webUrl}:`, error);
        results.push({
          websiteUrl: webUrl,
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
