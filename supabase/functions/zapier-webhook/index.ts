import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get webhook token from URL parameter
    const url = new URL(req.url);
    const webhookToken = url.searchParams.get("token");

    if (!webhookToken) {
      return new Response(
        JSON.stringify({ error: "Missing webhook token" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get incoming payload
    const payload = await req.json();

    // Find zapier source by token
    const { data: source, error: sourceError } = await supabase
      .from("zapier_sources")
      .select("*")
      .eq("webhook_token", webhookToken)
      .eq("is_active", true)
      .maybeSingle();

    if (sourceError) {
      console.error("Error fetching source:", sourceError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!source) {
      // Create a new source with sample data if token doesn't exist
      const { data: newSource, error: createError } = await supabase
        .from("zapier_sources")
        .insert({
          name: "New Zapier Integration",
          webhook_token: webhookToken,
          sample_data: payload,
          is_active: false,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating source:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create source" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Log the webhook
      await supabase.from("zapier_webhooks_log").insert({
        source_id: newSource.id,
        payload,
        status: "pending_mapping",
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "New source created. Please configure field mapping in admin panel.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update sample data if not set
    if (!source.sample_data) {
      await supabase
        .from("zapier_sources")
        .update({ sample_data: payload })
        .eq("id", source.id);
    }

    // Check if field mapping is configured
    const fieldMapping = source.field_mapping || {};
    const hasMappings = Object.keys(fieldMapping).length > 0;

    if (!hasMappings) {
      // Log webhook without creating request
      await supabase.from("zapier_webhooks_log").insert({
        source_id: source.id,
        payload,
        status: "pending_mapping",
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Webhook received. Field mapping required.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get first admin user as creator
    const { data: adminUsers } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);

    if (!adminUsers || adminUsers.length === 0) {
      return new Response(
        JSON.stringify({ error: "No admin user found to create request" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Map fields from payload to request format
    const mappedData: any = {
      status: "new",
      priority: "medium",
      created_by: adminUsers[0].user_id,
      assigned_to: null,
      source: "zapier",
      zapier_source_id: source.id,
    };

    for (const [webhookField, requestField] of Object.entries(fieldMapping)) {
      if (payload[webhookField] !== undefined) {
        mappedData[requestField as string] = payload[webhookField];
      }
    }

    // Special handling for email integrations - format title with client email
    const isEmailIntegration = source.name?.toLowerCase().includes('email') ||
                               source.name?.toLowerCase().includes('emaily');
    if (isEmailIntegration && mappedData.client_email) {
      mappedData.title = `Novy email na hello - ${mappedData.client_email}`;
    }

    // Create request
    const { data: request, error: requestError } = await supabase
      .from("requests")
      .insert(mappedData)
      .select()
      .single();

    if (requestError) {
      console.error("Error creating request:", requestError);
      
      // Log failed webhook
      await supabase.from("zapier_webhooks_log").insert({
        source_id: source.id,
        payload,
        status: "error",
        error_message: requestError.message,
      });

      return new Response(
        JSON.stringify({ error: "Failed to create request", details: requestError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log successful webhook
    await supabase.from("zapier_webhooks_log").insert({
      source_id: source.id,
      payload,
      request_id: request.id,
      status: "success",
    });

    return new Response(
      JSON.stringify({
        success: true,
        request_id: request.id,
        message: "Request created successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});