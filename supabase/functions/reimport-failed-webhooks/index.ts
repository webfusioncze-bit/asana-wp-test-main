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

    // Helper function to parse integer values that might be ranges
    function parseIntegerValue(value: any): number | null {
      if (value === null || value === undefined || value === '') return null;
      const strValue = String(value).trim();
      if (strValue.includes('-')) {
        const parts = strValue.split('-');
        const firstNum = parseInt(parts[0].trim(), 10);
        return isNaN(firstNum) ? null : firstNum;
      }
      const num = parseInt(strValue, 10);
      return isNaN(num) ? null : num;
    }

    // Helper to calculate age in days
    function getAgeInDays(dateStr: string): number {
      const createdDate = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - createdDate.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    // Get first admin user
    const { data: adminUsers } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);

    if (!adminUsers || adminUsers.length === 0) {
      return new Response(
        JSON.stringify({ error: "No admin user found" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adminUserId = adminUsers[0].user_id;

    // Get all failed webhooks since Feb 1, 2026
    const { data: failedLogs, error: logsError } = await supabase
      .from("zapier_webhooks_log")
      .select("*")
      .eq("status", "error")
      .gte("created_at", "2026-02-01")
      .order("created_at", { ascending: true });

    if (logsError) {
      console.error("Error fetching logs:", logsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch logs" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!failedLogs || failedLogs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No failed webhooks to reimport",
          imported: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = {
      total: failedLogs.length,
      imported: 0,
      skipped: 0,
      errors: [] as any[],
    };

    // Process each failed webhook
    for (const log of failedLogs) {
      try {
        // Get source configuration
        const { data: source } = await supabase
          .from("zapier_sources")
          .select("*")
          .eq("id", log.source_id)
          .maybeSingle();

        if (!source || !source.field_mapping) {
          results.skipped++;
          continue;
        }

        const payload = log.payload;
        const fieldMapping = source.field_mapping;
        const integerFields = ['subpage_count', 'product_count'];

        // Map fields
        const mappedData: any = {
          status: "new",
          priority: "medium",
          created_by: adminUserId,
          assigned_to: null,
          source: "zapier",
          zapier_source_id: source.id,
        };

        for (const [webhookField, requestField] of Object.entries(fieldMapping)) {
          if (payload[webhookField] !== undefined) {
            let value = payload[webhookField];
            if (integerFields.includes(requestField as string)) {
              value = parseIntegerValue(value);
            }
            mappedData[requestField as string] = value;
          }
        }

        // Special handling for email integrations
        const isEmailIntegration = source.name?.toLowerCase().includes('email') ||
                                   source.name?.toLowerCase().includes('emaily');
        if (isEmailIntegration && mappedData.client_email) {
          mappedData.title = `Novy email na hello - ${mappedData.client_email}`;
        }

        // Add manual import note with age
        const ageInDays = getAgeInDays(log.created_at);
        const originalDate = new Date(log.created_at).toLocaleDateString('cs-CZ');
        const manualNote = `\n\n--- MANUALNI IMPORT ---\nPoptavka byla importovana manualne kvuli chybe v puvodnim zpracovani.\nPuvodne vytvoreno: ${originalDate} (pred ${ageInDays} dny)\nChyba: ${log.error_message}`;

        if (mappedData.description) {
          mappedData.description = mappedData.description + manualNote;
        } else {
          mappedData.description = manualNote.trim();
        }

        // Create request
        const { data: request, error: requestError } = await supabase
          .from("requests")
          .insert(mappedData)
          .select()
          .single();

        if (requestError) {
          console.error("Error creating request:", requestError);
          results.errors.push({
            log_id: log.id,
            email: payload.email || payload.client_email,
            error: requestError.message,
          });
          continue;
        }

        // Update log status to indicate successful reimport
        await supabase
          .from("zapier_webhooks_log")
          .update({
            request_id: request.id,
            status: "reimported",
          })
          .eq("id", log.id);

        results.imported++;

      } catch (error) {
        console.error("Error processing log:", log.id, error);
        results.errors.push({
          log_id: log.id,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Successfully reimported ${results.imported} out of ${results.total} failed webhooks`,
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
