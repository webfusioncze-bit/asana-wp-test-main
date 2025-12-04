import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CENTRAL_XML_FEED_URL = "https://portal.webfusion.cz/webs_feed.xml";

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

    console.log(`Fetching central XML feed from: ${CENTRAL_XML_FEED_URL}`);

    const response = await fetch(CENTRAL_XML_FEED_URL, {
      headers: {
        'User-Agent': 'Supabase-Edge-Function/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch XML feed: ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();
    console.log(`Received XML feed, size: ${xmlText.length} bytes`);

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

        const name = parseXmlValue(pluginXml, 'name') ||
                    parseXmlValue(pluginXml, 'plugin_name') ||
                    parseXmlValue(pluginXml, 'title');

        const version = parseXmlValue(pluginXml, 'version') ||
                       parseXmlValue(pluginXml, 'plugin_version') ||
                       parseXmlValue(pluginXml, 'ver');

        const author = parseXmlValue(pluginXml, 'author') ||
                      parseXmlValue(pluginXml, 'plugin_author') ||
                      parseXmlValue(pluginXml, 'author_name');

        plugins.push({
          name,
          version,
          author,
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

        const username = parseXmlValue(userXml, 'username') ||
                       parseXmlValue(userXml, 'user_login') ||
                       parseXmlValue(userXml, 'login') ||
                       parseXmlValue(userXml, 'name');

        const email = parseXmlValue(userXml, 'email') ||
                     parseXmlValue(userXml, 'user_email') ||
                     parseXmlValue(userXml, 'mail');

        const role = parseXmlValue(userXml, 'role') ||
                    parseXmlValue(userXml, 'user_role') ||
                    parseXmlValue(userXml, 'roles');

        users.push({
          username,
          email,
          role,
        });
      }

      return users;
    };

    const webRegex = /<web>(.*?)<\/web>/gis;
    const websites = [];
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

      websites.push({
        url,
        data: {
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
          ult,
          raw_data: {
            active_plugins: activePlugins,
            inactive_plugins: inactivePlugins,
            update_plugins: updatePlugins,
            users: users,
          },
        },
      });
    }

    console.log(`Parsed ${websites.length} websites from XML feed`);

    const { data: dbWebsites } = await supabaseAdmin
      .from('websites')
      .select('id, url');

    const urlToIdMap = new Map(dbWebsites?.map(w => [w.url, w.id]) || []);

    let synced = 0;
    let failed = 0;
    let notFound = 0;

    for (const website of websites) {
      const websiteId = urlToIdMap.get(website.url);

      if (!websiteId) {
        console.log(`Website not found in DB: ${website.url}`);
        notFound++;
        continue;
      }

      try {
        const { error: statusError } = await supabaseAdmin
          .from('website_status')
          .insert({
            website_id: websiteId,
            ...website.data,
          });

        if (statusError) {
          console.error(`Failed to insert status for ${website.url}:`, statusError.message);
          failed++;
          continue;
        }

        const { error: updateError } = await supabaseAdmin
          .from('websites')
          .update({
            last_sync_at: new Date().toISOString(),
            sync_error: null,
            login_token: website.data.ult,
            is_available: true,
            last_check_at: new Date().toISOString(),
          })
          .eq('id', websiteId);

        if (updateError) {
          console.error(`Failed to update website ${website.url}:`, updateError.message);
          failed++;
          continue;
        }

        synced++;
      } catch (error) {
        console.error(`Error syncing ${website.url}:`, error);
        failed++;
      }
    }

    console.log(`Sync complete: ${synced} synced, ${failed} failed, ${notFound} not found in DB`);

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        failed,
        notFound,
        total: websites.length,
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