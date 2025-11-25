import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ImportRequest {
  url: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Ověření uživatele pomocí ANON_KEY
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Ověření oprávnění
    const { data: permission } = await supabaseAuth
      .from('user_permissions')
      .select('permission')
      .eq('user_id', user.id)
      .eq('permission', 'manage_projects')
      .maybeSingle();

    const isAllowed = permission || user.email === 'milan.vodak@webfusion.cz';
    
    if (!isAllowed) {
      throw new Error('Nemáte oprávnění importovat projekty');
    }

    // Pro samotný import použijeme SERVICE_ROLE_KEY aby se vyhnuli RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { url }: ImportRequest = await req.json();

    if (!url) {
      throw new Error("URL is required");
    }

    console.log(`Fetching data from: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch from URL: ${response.statusText}`);
    }

    const projectData = await response.json();
    console.log(`Received project: ${projectData.title?.rendered}`);

    const acf = projectData.acf;
    if (!acf) {
      throw new Error("Missing ACF data in imported project");
    }

    function stripHtmlTags(html: string | null): string | null {
      if (!html) return null;
      return html.replace(/<[^>]*>/g, '').trim();
    }

    function parseDate(dateStr: string | null): string | null {
      if (!dateStr) return null;
      
      // Odstranit HTML tagy
      const cleanDate = stripHtmlTags(dateStr);
      if (!cleanDate) return null;
      
      // Formát YYYYMMDD (8 číslic)
      if (/^\d{8}$/.test(cleanDate)) {
        const year = cleanDate.substring(0, 4);
        const month = cleanDate.substring(4, 6);
        const day = cleanDate.substring(6, 8);
        return `${year}-${month}-${day}`;
      }
      
      // Formát DD.MM.YYYY nebo D.M.YYYY
      const ddmmyyyyMatch = cleanDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (ddmmyyyyMatch) {
        const day = ddmmyyyyMatch[1].padStart(2, '0');
        const month = ddmmyyyyMatch[2].padStart(2, '0');
        const year = ddmmyyyyMatch[3];
        return `${year}-${month}-${day}`;
      }
      
      // Formát DD/MM/YYYY nebo D/M/YYYY
      const ddmmyyyySlashMatch = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (ddmmyyyySlashMatch) {
        const day = ddmmyyyySlashMatch[1].padStart(2, '0');
        const month = ddmmyyyySlashMatch[2].padStart(2, '0');
        const year = ddmmyyyySlashMatch[3];
        return `${year}-${month}-${day}`;
      }
      
      // Formát YYYY-MM-DD (už správný)
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
        return cleanDate;
      }
      
      // Zkusit parsovat jako ISO datum
      try {
        const date = new Date(cleanDate);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      } catch {
        // Pokud selže parsování, pokračujeme
      }
      
      console.warn(`Unable to parse date: ${cleanDate}`);
      return null;
    }

    function normalizeStatus(status: string): string {
      const cleanStatus = stripHtmlTags(status)?.toLowerCase() || '';
      if (cleanStatus.includes('aktivní')) return 'aktivní';
      if (cleanStatus.includes('dokončen')) return 'dokončen';
      if (cleanStatus.includes('pozastaven')) return 'pozastaven';
      if (cleanStatus.includes('zrušě')) return 'zrušen';
      if (cleanStatus.includes('klient')) return 'čeká se na klienta';
      return 'aktivní';
    }

    function normalizePhaseStatus(status: string): string {
      const cleanStatus = stripHtmlTags(status)?.toLowerCase() || '';
      if (cleanStatus.includes('probíhá')) return 'fáze probíhá';
      if (cleanStatus.includes('dokončen')) return 'dokončena';
      if (cleanStatus.includes('zrušě')) return 'zrušena';
      if (cleanStatus.includes('klient')) return 'čeká se na klienta';
      if (cleanStatus.includes('čeká')) return 'čeká na zahájení';
      return 'čeká na zahájení';
    }

    function normalizeProjectType(type: string): string {
      const cleanType = stripHtmlTags(type)?.toLowerCase() || '';
      if (cleanType.includes('vývoj') || cleanType.includes('tvorba')) return 'vývoj';
      if (cleanType.includes('údržba')) return 'údržba';
      if (cleanType.includes('konzultace')) return 'konzultace';
      return 'jiné';
    }

    function normalizeProjectCategory(category: string): string {
      const cleanCategory = stripHtmlTags(category)?.toLowerCase() || '';
      if (cleanCategory.includes('klientsk')) return 'klientský';
      if (cleanCategory.includes('interní')) return 'interní';
      if (cleanCategory.includes('open')) return 'open-source';
      return 'klientský';
    }

    const projectInsert = {
      name: stripHtmlTags(acf.nazev_projektu) || projectData.title?.rendered || 'Importovaný projekt',
      description: stripHtmlTags(acf.popis_projektu),
      project_type: normalizeProjectType(acf.typ_projektu || ''),
      project_category: normalizeProjectCategory(acf.zarazeni_projektu || ''),
      status: normalizeStatus(acf.stav_projektu || ''),
      price_offer: acf.investovana_castka || null,
      hour_budget: acf.hodinovy_rozpocet || null,
      start_date: parseDate(acf.datum_zahajeni_projektu),
      delivery_date: parseDate(acf.ocekavane_dodani),
      completed_date: parseDate(acf.datum_dokonceni),
      notes: stripHtmlTags(acf.zapisky),
      import_source_url: url,
      sync_enabled: true,
      last_sync_at: new Date().toISOString(),
      created_by: user.id,
    };

    console.log('Inserting project:', projectInsert);
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert(projectInsert)
      .select()
      .single();

    if (projectError) {
      console.error('Project insert error:', projectError);
      throw new Error(`Failed to create project: ${projectError.message}`);
    }

    console.log(`Project created with ID: ${project.id}`);

    const phases = acf.faze_projektu || [];
    console.log(`Importing ${phases.length} phases`);

    let totalTimeEntriesImported = 0;
    let totalTimeEntriesFailed = 0;
    const warnings: string[] = [];
    const failedEntries: any[] = [];

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      
      const phaseInsert: any = {
        project_id: project.id,
        name: phase.nazev_faze || `Fáze ${i + 1}`,
        description: stripHtmlTags(phase.popis_faze),
        status: normalizePhaseStatus(phase.stav_faze || ''),
        estimated_hours: phase.hodinovy_rozpocet || 0,
        hour_budget: phase.hodinovy_rozpocet || 0,
        hourly_rate: phase.hodinova_sazba_operatora || null,
        notes: stripHtmlTags(phase.zapisky),
        position: i + 1,
      };

      if (phase.operator_faze) {
        phaseInsert.external_operator_id = String(phase.operator_faze);
        console.log(`Phase ${i + 1} has external_operator_id: ${phaseInsert.external_operator_id}`);
      }

      console.log(`Inserting phase ${i + 1}:`, phaseInsert.name);
      const { data: insertedPhase, error: phaseError } = await supabase
        .from('project_phases')
        .insert(phaseInsert)
        .select()
        .single();

      if (phaseError) {
        console.error(`Phase ${i + 1} insert error:`, phaseError);
        warnings.push(`Fáze "${phaseInsert.name}" nebyla vytvořena: ${phaseError.message}`);
        continue;
      }

      if (!insertedPhase.assigned_user_id && insertedPhase.external_operator_id) {
        warnings.push(`Fáze "${insertedPhase.name}" čeká na uživatele s external_id: ${insertedPhase.external_operator_id}`);
      } else if (insertedPhase.assigned_user_id) {
        console.log(`Phase ${insertedPhase.name} assigned to user: ${insertedPhase.assigned_user_id}`);
      }

      const timeEntries = phase.polozkovy_vykaz || [];
      console.log(`Importing ${timeEntries.length} time entries for phase ${insertedPhase.name}`);

      for (const entry of timeEntries) {
        const entryDate = parseDate(entry.datum);
        const hours = Number(entry.pocet_hodin) || 0;
        const visibleToClient = !entry.vidi_klient || !entry.vidi_klient.includes('nevidi');

        if (hours === 0) {
          console.log(`Skipping entry with 0 hours: ${entry.cinnost}`);
          continue;
        }

        if (!entryDate) {
          console.warn(`Skipping entry with invalid date '${entry.datum}': ${entry.cinnost}`);
          failedEntries.push({ reason: 'invalid_date', date: entry.datum, activity: entry.cinnost });
          totalTimeEntriesFailed++;
          continue;
        }

        const timeEntryInsert: any = {
          phase_id: insertedPhase.id,
          description: entry.cinnost || 'Importovaná činnost',
          hours: hours,
          entry_date: entryDate,
          visible_to_client: visibleToClient,
          user_id: insertedPhase.assigned_user_id || null,
        };

        console.log(`Inserting time entry: ${hours}h on ${entryDate} - user: ${timeEntryInsert.user_id || 'NULL'}`);

        const { error: timeError } = await supabase
          .from('project_time_entries')
          .insert(timeEntryInsert);

        if (timeError) {
          console.error('Time entry insert error:', timeError);
          console.error('Failed entry data:', timeEntryInsert);
          failedEntries.push({ reason: 'db_error', error: timeError.message, data: timeEntryInsert });
          totalTimeEntriesFailed++;
        } else {
          totalTimeEntriesImported++;
        }
      }

      const milestones = phase.milestones || [];
      if (milestones && milestones.length > 0) {
        console.log(`Importing ${milestones.length} milestones for phase ${insertedPhase.name}`);
        
        for (let m = 0; m < milestones.length; m++) {
          const milestone = milestones[m];
          
          const milestoneInsert = {
            phase_id: insertedPhase.id,
            name: milestone.name || `Milestone ${m + 1}`,
            description: milestone.description || null,
            target_date: parseDate(milestone.target_date),
            completed_date: parseDate(milestone.completed_date),
            status: milestone.status || 'čeká',
            position: m + 1,
          };

          const { error: milestoneError } = await supabase
            .from('project_milestones')
            .insert(milestoneInsert);

          if (milestoneError) {
            console.error('Milestone insert error:', milestoneError);
          }
        }
      }
    }

    console.log(`Import complete. Time entries: ${totalTimeEntriesImported} imported, ${totalTimeEntriesFailed} failed`);
    if (failedEntries.length > 0) {
      console.log('Failed entries sample:', failedEntries.slice(0, 5));
    }

    return new Response(
      JSON.stringify({
        success: true,
        project: {
          id: project.id,
          name: project.name,
        },
        stats: {
          phases: phases.length,
          timeEntriesImported: totalTimeEntriesImported,
          timeEntriesFailed: totalTimeEntriesFailed,
        },
        warnings: warnings.length > 0 ? warnings : undefined,
        failedEntriesSample: failedEntries.length > 0 ? failedEntries.slice(0, 10) : undefined,
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
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
});