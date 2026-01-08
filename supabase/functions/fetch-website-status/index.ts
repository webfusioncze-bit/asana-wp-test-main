import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const { websiteUrl, apiKey } = await req.json();

    if (!websiteUrl || !apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing websiteUrl or apiKey',
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

    console.log(`Fetching website status from: ${websiteUrl}`);

    const apiUrl = `${websiteUrl}/wp-json/webfusion-connector/v1/website-data`;
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-WBF-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch website status: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('Invalid response format from website API');
    }

    const statusData = {
      last_updated: result.retrieved_at,
      wordpress_version: result.data.wordpress_version,
      php_version: result.data.php_version,
      mysql_version: result.data.mysql_version,
      memory_limit: result.data.memory_limit,
      upload_max_filesize: result.data.upload_max_filesize,
      num_pages: result.data.num_pages,
      num_posts: result.data.num_posts,
      num_comments: result.data.num_comments,
      num_users: result.data.num_users,
      num_media_files: result.data.num_media_files,
      https_status: result.data.https_status,
      indexing_allowed: result.data.indexing_allowed,
      storage_usage: result.data.storage_usage,
      active_plugins_count: result.data.active_plugins_count,
      inactive_plugins_count: result.data.inactive_plugins_count,
      update_plugins_count: result.data.update_plugins_count,
      theme_name: result.data.theme_name,
      theme_version: result.data.theme_version,
      server_load: result.data.server_load,
      uptime: result.data.uptime,
      raw_data: {
        active_plugins: result.data.active_plugins || [],
        inactive_plugins: result.data.inactive_plugins || [],
        update_plugins: result.data.update_plugins || [],
        users: result.data.users || [],
      },
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: statusData,
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
    console.error('Fetch error:', error);
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