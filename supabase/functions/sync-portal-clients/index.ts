import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ClientInvoice {
  datum: string;
  cislo_faktury: string;
  stav: string;
}

interface ClientData {
  id: number;
  title: string;
  slug: string;
  status: string;
  link: string;
  acf: {
    unikatni_id_klienta?: string;
    fakturacni_udaje?: {
      jmeno_a_prijmeni1?: string;
      telefon1?: string;
      email1?: string;
      spolecnost?: string;
      ic?: string;
      dic?: string;
      ulice?: string;
      mesto?: string;
      psc?: string;
      faktury?: ClientInvoice[];
    };
    webove_stranky_klienta?: string[];
  };
}

interface ApiResponse {
  items: ClientData[];
  total: number;
  total_pages: number;
  current_page: number;
  per_page: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const API_BASE_URL = 'https://portal.webfusion.cz/wp-json/webfusion/v1/klienti';
    let syncedClients = 0;
    let failedClients = 0;
    let currentPage = 1;
    let totalPages = 1;

    while (currentPage <= totalPages) {
      const apiUrl = `${API_BASE_URL}?page=${currentPage}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch clients from page ${currentPage}`);
      }

      const data: ApiResponse = await response.json();
      totalPages = data.total_pages;

      for (const clientData of data.items) {
        try {
          const billing = clientData.acf?.fakturacni_udaje || {};
          
          const { data: client, error: clientError } = await supabase
            .from('clients')
            .upsert(
              {
                external_id: clientData.acf?.unikatni_id_klienta || null,
                portal_id: clientData.id,
                name: clientData.title,
                slug: clientData.slug,
                status: clientData.status,
                company_name: billing.spolecnost || null,
                ic: billing.ic || null,
                dic: billing.dic || null,
                email: billing.email1 || null,
                phone: billing.telefon1 || null,
                street: billing.ulice || null,
                city: billing.mesto || null,
                postal_code: billing.psc || null,
                portal_link: clientData.link,
                last_sync_at: new Date().toISOString(),
                sync_error: null,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: 'portal_id',
              }
            )
            .select()
            .single();

          if (clientError) {
            console.error(`Error upserting client ${clientData.id}:`, clientError);
            failedClients++;
            continue;
          }

          if (billing.faktury && Array.isArray(billing.faktury)) {
            await supabase
              .from('client_invoices')
              .delete()
              .eq('client_id', client.id);

            for (const invoice of billing.faktury) {
              await supabase.from('client_invoices').insert({
                client_id: client.id,
                invoice_number: invoice.cislo_faktury,
                invoice_date: invoice.datum,
                status: invoice.stav,
              });
            }
          }

          const websites = clientData.acf?.webove_stranky_klienta || [];
          if (websites.length > 0) {
            await supabase
              .from('client_websites')
              .delete()
              .eq('client_id', client.id);

            for (const websiteUrl of websites) {
              const { data: matchedWebsite } = await supabase
                .from('websites')
                .select('id')
                .or(`url.eq.${websiteUrl},url.eq.${websiteUrl}/,url.eq.https://${websiteUrl},url.eq.http://${websiteUrl}`)
                .maybeSingle();

              await supabase.from('client_websites').insert({
                client_id: client.id,
                website_id: matchedWebsite?.id || null,
                website_url: websiteUrl,
              });
            }
          }

          syncedClients++;
        } catch (error) {
          console.error(`Error syncing client ${clientData.id}:`, error);
          failedClients++;
        }
      }

      currentPage++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedClients,
        failedClients,
        totalPages: totalPages,
        message: `Synchronized ${syncedClients} clients from ${totalPages} pages`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});