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

    // Build a map of existing websites by URL for fast lookup
    const existingWebsitesMap = new Map(
      currentWebsites?.map(w => [w.url.toLowerCase(), w]) || []
    );

    const websitesToInsert = [];
    const websitesToUpdate = [];
    const statusesToInsert = [];

    const now = new Date().toISOString();

    // Process all websites and prepare batch operations
    for (const websiteData of allPortalWebsites) {
      const existingWebsite = existingWebsitesMap.get(websiteData.url.toLowerCase());

      if (!existingWebsite) {
        // New website - prepare for batch insert
        const urlObj = new URL(websiteData.url);
        const domain = urlObj.hostname.replace('www.', '');

        websitesToInsert.push({
          url: websiteData.url,
          name: domain,
          owner_id: adminUser.user_id,
          login_token: websiteData.ult,
          last_sync_at: now,
          is_available: true,
          last_check_at: now,
        });
      } else {
        // Existing website - prepare for batch update
        websitesToUpdate.push({
          id: existingWebsite.id,
          login_token: websiteData.ult,
          last_sync_at: now,
          sync_error: null,
          is_available: true,
          last_check_at: now,
        });
      }
    }

    console.log(`Batch operations: ${websitesToInsert.length} to insert, ${websitesToUpdate.length} to update`);

    // Batch insert new websites
    let newWebsiteIds = [];
    if (websitesToInsert.length > 0) {
      const { data: insertedWebsites, error: insertError } = await supabaseAdmin
        .from('websites')
        .insert(websitesToInsert)
        .select('id, url');

      if (insertError) {
        throw new Error(`Failed to batch insert websites: ${insertError.message}`);
      }

      newWebsiteIds = insertedWebsites || [];
      console.log(`✓ Inserted ${newWebsiteIds.length} new websites`);
    }

    // Batch update existing websites
    if (websitesToUpdate.length > 0) {
      for (const website of websitesToUpdate) {
        const { error: updateError } = await supabaseAdmin
          .from('websites')
          .update({
            login_token: website.login_token,
            last_sync_at: website.last_sync_at,
            sync_error: website.sync_error,
            is_available: website.is_available,
            last_check_at: website.last_check_at,
          })
          .eq('id', website.id);

        if (updateError) {
          console.error(`Failed to update website ${website.id}:`, updateError);
        }
      }
      console.log(`✓ Updated ${websitesToUpdate.length} existing websites`);
    }

    // Rebuild the website map with new IDs
    const { data: allWebsites } = await supabaseAdmin
      .from('websites')
      .select('id, url');

    const websiteUrlToIdMap = new Map(
      allWebsites?.map(w => [w.url.toLowerCase(), w.id]) || []
    );

    // Prepare status data for batch insert
    for (const websiteData of allPortalWebsites) {
      const websiteId = websiteUrlToIdMap.get(websiteData.url.toLowerCase());
      if (!websiteId) continue;

      statusesToInsert.push({
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
      });
    }

    // Batch insert status data
    if (statusesToInsert.length > 0) {
      const { error: statusError } = await supabaseAdmin
        .from('website_status')
        .insert(statusesToInsert);

      if (statusError) {
        console.error('Failed to batch insert status data:', statusError);
        throw new Error(`Failed to batch insert status data: ${statusError.message}`);
      }

      console.log(`✓ Inserted ${statusesToInsert.length} status records`);
    }

    const results = {
      newWebsites: websitesToInsert.length,
      updatedWebsites: websitesToUpdate.length,
      statusRecords: statusesToInsert.length,
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedWebsites: results.newWebsites + results.updatedWebsites,
        failedWebsites: 0,
        total: allPortalWebsites.length,
        newWebsites: results.newWebsites,
        updatedWebsites: results.updatedWebsites,
        statusRecords: results.statusRecords,
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