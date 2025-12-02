import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FEED_URL = "https://portal.webfusion.cz/webs_feed.xml";

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

    console.log('Fetching websites feed from:', FEED_URL);

    const response = await fetch(FEED_URL, {
      headers: {
        'User-Agent': 'Supabase-Edge-Function/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.statusText}`);
    }

    const xmlText = await response.text();
    console.log('Feed fetched successfully');

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

    const webRegex = /<web>(.*?)<\/web>/gis;
    const allPortalWebsites = [];
    let webMatch;

    while ((webMatch = webRegex.exec(xmlText)) !== null) {
      const webXml = webMatch[1];
      const url = parseXmlValue(webXml, 'post');

      if (!url) continue;

      const activePlugins = extractPlugins(webXml, 'active_plugins');
      const inactivePlugins = extractPlugins(webXml, 'inactive_plugins');
      const updatePlugins = extractPlugins(webXml, 'update_plugins');
      const users = extractUsers(webXml);
      const ult = parseXmlValue(webXml, 'ult');

      allPortalWebsites.push({
        url,
        ult,
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
        active_plugins: activePlugins,
        inactive_plugins: inactivePlugins,
        update_plugins: updatePlugins,
        users: users,
      });
    }

    console.log(`Total websites parsed from feed: ${allPortalWebsites.length}`);

    // Get current websites from database
    const { data: currentWebsites, error: websitesError } = await supabaseAdmin
      .from('websites')
      .select('id, url, name');

    if (websitesError) {
      throw new Error(`Failed to fetch current websites: ${websitesError.message}`);
    }

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

    const results = [];

    // Process each website from the feed
    for (const websiteData of allPortalWebsites) {
      try {
        const { data: existingWebsite, error: findError } = await supabaseAdmin
          .from('websites')
          .select('id')
          .eq('url', websiteData.url)
          .maybeSingle();

        if (findError) {
          throw new Error(`Failed to find website: ${findError.message}`);
        }

        let websiteId = existingWebsite?.id;

        // Create or update website
        if (!websiteId) {
          const urlObj = new URL(websiteData.url);
          const domain = urlObj.hostname.replace('www.', '');

          const { data: newWebsite, error: insertError } = await supabaseAdmin
            .from('websites')
            .insert({
              url: websiteData.url,
              name: domain,
              owner_id: adminUser.user_id,
              login_token: websiteData.ult,
              last_sync_at: new Date().toISOString(),
              is_available: true,
              last_check_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (insertError) {
            throw new Error(`Failed to insert website: ${insertError.message}`);
          }

          websiteId = newWebsite.id;
          console.log(`Created new website: ${domain}`);
        } else {
          const { error: updateError } = await supabaseAdmin
            .from('websites')
            .update({
              login_token: websiteData.ult,
              last_sync_at: new Date().toISOString(),
              sync_error: null,
              is_available: true,
              last_check_at: new Date().toISOString(),
            })
            .eq('id', websiteId);

          if (updateError) {
            throw new Error(`Failed to update website: ${updateError.message}`);
          }
        }

        // Insert status data
        const statusData = {
          website_id: websiteId,
          last_updated: websiteData.last_updated,
          wordpress_version: websiteData.wordpress_version,
          php_version: websiteData.php_version,
          mysql_version: websiteData.mysql_version,
          memory_limit: websiteData.memory_limit,
          upload_max_filesize: websiteData.upload_max_filesize,
          num_pages: websiteData.num_pages,
          num_posts: websiteData.num_posts,
          num_comments: websiteData.num_comments,
          num_users: websiteData.num_users,
          num_media_files: websiteData.num_media_files,
          https_status: websiteData.https_status,
          indexing_allowed: websiteData.indexing_allowed,
          storage_usage: websiteData.storage_usage,
          active_plugins_count: websiteData.active_plugins_count,
          inactive_plugins_count: websiteData.inactive_plugins_count,
          update_plugins_count: websiteData.update_plugins_count,
          theme_name: websiteData.theme_name,
          theme_version: websiteData.theme_version,
          server_load: websiteData.server_load,
          uptime: websiteData.uptime,
          ult: websiteData.ult,
          raw_data: {
            active_plugins: websiteData.active_plugins,
            inactive_plugins: websiteData.inactive_plugins,
            update_plugins: websiteData.update_plugins,
            users: websiteData.users,
          },
        };

        const { error: statusError } = await supabaseAdmin
          .from('website_status')
          .insert(statusData);

        if (statusError) {
          throw new Error(`Failed to insert status: ${statusError.message}`);
        }

        results.push({
          url: websiteData.url,
          websiteId: websiteId,
          success: true,
        });

        console.log(`✓ Synced ${websiteData.url}`);
      } catch (error) {
        console.error(`Failed to sync website ${websiteData.url}:`, error);
        results.push({
          url: websiteData.url,
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
        total: allPortalWebsites.length,
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