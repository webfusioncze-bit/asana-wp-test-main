import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface AcfFields {
  sazba?: string;
  nazev_?: string;
  web?: number;
  text_pozadavku?: string;
  priorita?: string;
  soubory?: { url?: string } | false;
  screenshot?: { url?: string } | false;
  odhadovane_dokonceni?: string;
  operator_podpory?: number | string;
  odhad?: string;
  stav?: string;
  realny_cas?: string;
  manager_pozadavku?: number | string;
  cas_managera?: string;
  reklamace?: string;
  uznany_cas?: string;
  zakladam_za_klienta?: number | string | null;
}

interface TicketData {
  id: number;
  title: { rendered: string };
  slug: string;
  link: string;
  date: string;
  modified: string;
  author: number;
  acf: AcfFields;
}

interface CommentData {
  id: number;
  post: number;
  parent: number;
  author: number;
  author_name: string;
  date: string;
  content: { rendered: string };
  status: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function parseAcfDate(dateStr: string | undefined): string | null {
  if (!dateStr || dateStr.length !== 8) return null;
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

function parsePortalId(val: number | string | null | undefined): number | null {
  if (val === null || val === undefined || val === '' || val === 0) return null;
  const n = typeof val === 'string' ? parseInt(val, 10) : val;
  return isNaN(n) || n === 0 ? null : n;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let limitParam = 0;
    try {
      const body = await req.json();
      limitParam = body?.limit || 0;
    } catch {
      // no body
    }

    const { data: configData } = await supabase
      .from('portal_sync_config')
      .select('tickets_portal_url')
      .maybeSingle();

    const API_BASE = configData?.tickets_portal_url ||
      'https://portal.webfusion.cz/wp-json/wp/v2/pozadavek-na-podporu';

    const { data: operatorMappings } = await supabase
      .from('operator_user_mappings')
      .select('external_operator_id, user_id');

    const opMap = new Map<string, string>();
    if (operatorMappings) {
      for (const m of operatorMappings) {
        opMap.set(m.external_operator_id, m.user_id);
      }
    }

    const { data: allWebsites } = await supabase
      .from('websites')
      .select('id, url, owner_id');

    const websiteByPortalId = new Map<string, { id: string; owner_id: string }>();
    // We need to map portal website IDs to our website records.
    // Fetch portal_sync_config websites mapping if available
    // For now, match by the existing website_portal_id in support_tickets

    const { data: allClients } = await supabase
      .from('clients')
      .select('id, portal_id');

    const clientByPortalId = new Map<number, string>();
    if (allClients) {
      for (const c of allClients) {
        clientByPortalId.set(c.portal_id, c.id);
      }
    }

    // Fetch existing website mappings from support_tickets to reuse
    const { data: existingWebsiteMappings } = await supabase
      .from('support_tickets')
      .select('website_portal_id, website_id, client_id')
      .not('website_id', 'is', null);

    const websiteIdMap = new Map<number, string>();
    if (existingWebsiteMappings) {
      for (const m of existingWebsiteMappings) {
        if (m.website_portal_id && m.website_id) {
          websiteIdMap.set(m.website_portal_id, m.website_id);
        }
      }
    }

    // Also build a map from websites table using client_websites
    const { data: clientWebsites } = await supabase
      .from('client_websites')
      .select('client_id, website_id, website_url');

    let syncedTickets = 0;
    let syncedComments = 0;
    let failedTickets = 0;
    let currentPage = 1;
    let totalPages = 1;
    let totalFetched = 0;

    while (currentPage <= totalPages) {
      const url = `${API_BASE}?per_page=20&page=${currentPage}&_fields=id,title,slug,link,date,modified,author,acf`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 400) break;
        throw new Error(`API error: ${response.status}`);
      }

      const totalPagesHeader = response.headers.get('X-WP-TotalPages');
      if (totalPagesHeader) totalPages = parseInt(totalPagesHeader, 10);

      const tickets: TicketData[] = await response.json();

      for (const ticket of tickets) {
        try {
          const acf = ticket.acf || {};

          const statusRaw = typeof acf.stav === 'string' ? stripHtml(acf.stav) : '';
          const priorityRaw = typeof acf.priorita === 'string' ? stripHtml(acf.priorita) : '';

          const operatorPortalId = parsePortalId(acf.operator_podpory);
          const managerPortalId = parsePortalId(acf.manager_pozadavku);
          const websitePortalId = typeof acf.web === 'number' ? acf.web : null;

          const operatorUserId = operatorPortalId ? opMap.get(String(operatorPortalId)) || null : null;
          const managerUserId = managerPortalId ? opMap.get(String(managerPortalId)) || null : null;

          let websiteId: string | null = null;
          if (websitePortalId) {
            websiteId = websiteIdMap.get(websitePortalId) || null;
            if (!websiteId && allWebsites) {
              // Try to find matching website by portal ID in websites table
              // The websites don't have portal_id directly, so we look at existing mappings
            }
          }

          // Try to find client from author
          let clientId: string | null = null;
          const authorPortalId = ticket.author;
          // Look through clients to find one matching the author
          if (authorPortalId && clientByPortalId.has(authorPortalId)) {
            clientId = clientByPortalId.get(authorPortalId) || null;
          }

          let websiteName = '';
          if (websiteId && allWebsites) {
            const ws = allWebsites.find(w => w.id === websiteId);
            if (ws) websiteName = ws.url;
          }

          // Try to get website name from existing ticket data if we don't have it
          if (!websiteName && websitePortalId) {
            const { data: existingTicket } = await supabase
              .from('support_tickets')
              .select('website_name, website_id, client_id')
              .eq('portal_id', ticket.id)
              .maybeSingle();
            if (existingTicket) {
              websiteName = existingTicket.website_name || '';
              if (!websiteId) websiteId = existingTicket.website_id;
              if (!clientId) clientId = existingTicket.client_id;
            }
          }

          const screenshotUrl = acf.screenshot && typeof acf.screenshot === 'object' ? acf.screenshot.url || null : null;
          const attachmentUrl = acf.soubory && typeof acf.soubory === 'object' ? acf.soubory.url || null : null;

          const { error: ticketError } = await supabase
            .from('support_tickets')
            .upsert(
              {
                portal_id: ticket.id,
                title: stripHtml(ticket.title.rendered),
                slug: ticket.slug,
                description: acf.text_pozadavku || '',
                portal_link: ticket.link,
                status: statusRaw || '',
                priority: priorityRaw || '',
                is_complaint: acf.reklamace === 'Ano',
                hourly_rate: acf.sazba || null,
                estimated_hours: acf.odhad || '',
                actual_time: acf.realny_cas || '',
                manager_time: acf.cas_managera || '',
                approved_time: acf.uznany_cas || '',
                estimated_completion: parseAcfDate(acf.odhadovane_dokonceni),
                website_portal_id: websitePortalId,
                website_id: websiteId,
                website_name: websiteName,
                client_id: clientId,
                author_portal_id: authorPortalId,
                author_name: '',
                operator_portal_id: operatorPortalId,
                operator_user_id: operatorUserId,
                manager_portal_id: managerPortalId,
                manager_user_id: managerUserId,
                screenshot_url: screenshotUrl,
                attachment_url: attachmentUrl,
                portal_created_at: ticket.date,
                portal_modified_at: ticket.modified,
                last_sync_at: new Date().toISOString(),
                sync_error: null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'portal_id' }
            );

          if (ticketError) {
            console.error(`Error upserting ticket ${ticket.id}:`, ticketError);
            failedTickets++;
            continue;
          }

          // Fetch comments for this ticket
          try {
            const commentsUrl = `https://portal.webfusion.cz/wp-json/wp/v2/comments?post=${ticket.id}&per_page=100&_fields=id,post,parent,author,author_name,date,content,status`;
            const commentsRes = await fetch(commentsUrl);

            if (commentsRes.ok) {
              const commentsData: CommentData[] = await commentsRes.json();

              const { data: ticketRecord } = await supabase
                .from('support_tickets')
                .select('id')
                .eq('portal_id', ticket.id)
                .maybeSingle();

              if (ticketRecord && commentsData.length > 0) {
                for (const comment of commentsData) {
                  const { error: commentError } = await supabase
                    .from('support_ticket_comments')
                    .upsert(
                      {
                        ticket_id: ticketRecord.id,
                        portal_comment_id: comment.id,
                        parent_portal_comment_id: comment.parent || 0,
                        author_portal_id: comment.author,
                        author_name: comment.author_name || '',
                        content: comment.content.rendered || '',
                        portal_date: comment.date,
                        status: comment.status || 'approved',
                        updated_at: new Date().toISOString(),
                      },
                      { onConflict: 'portal_comment_id' }
                    );

                  if (!commentError) syncedComments++;
                }
              }
            }
          } catch (commentErr) {
            console.error(`Error fetching comments for ticket ${ticket.id}:`, commentErr);
          }

          syncedTickets++;
          totalFetched++;

          if (limitParam > 0 && totalFetched >= limitParam) break;
        } catch (err) {
          console.error(`Error processing ticket ${ticket.id}:`, err);
          failedTickets++;
        }
      }

      if (limitParam > 0 && totalFetched >= limitParam) break;
      currentPage++;
    }

    await supabase
      .from('portal_sync_config')
      .update({
        tickets_last_sync_at: new Date().toISOString(),
        tickets_sync_error: null,
      })
      .not('id', 'is', null);

    return new Response(
      JSON.stringify({
        success: true,
        syncedTickets,
        syncedComments,
        failedTickets,
        totalPages,
        message: `Synchronized ${syncedTickets} tickets with ${syncedComments} comments`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('portal_sync_config')
        .update({
          tickets_sync_error: error instanceof Error ? error.message : 'Unknown error',
        })
        .not('id', 'is', null);
    } catch (updateErr) {
      console.error('Failed to update sync error:', updateErr);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
