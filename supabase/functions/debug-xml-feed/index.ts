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

    const { data: websites } = await supabaseAdmin
      .from('websites')
      .select('id, url, name')
      .limit(1);

    if (!websites || websites.length === 0) {
      return new Response('No websites found', { status: 404, headers: corsHeaders });
    }

    const website = websites[0];
    const feedUrl = `${website.url}/wp-content/plugins/webfusion-connector/feeds/stav-webu.xml`;

    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Supabase-Edge-Function/1.0',
      },
    });

    if (!response.ok) {
      return new Response(`Failed to fetch feed: ${response.statusText}`, { 
        status: response.status, 
        headers: corsHeaders 
      });
    }

    const xmlText = await response.text();

    // Extract just the plugin and user sections to see structure
    const pluginMatch = xmlText.match(/<active_plugins>(.*?)<\/active_plugins>/is);
    const userMatch = xmlText.match(/<users>(.*?)<\/users>/is);

    const debug = {
      feedUrl,
      xmlLength: xmlText.length,
      firstPlugin: pluginMatch ? pluginMatch[1].substring(0, 500) : 'Not found',
      users: userMatch ? userMatch[1] : 'Not found',
      fullXmlSample: xmlText.substring(0, 3000),
    };

    return new Response(
      JSON.stringify(debug, null, 2),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
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
