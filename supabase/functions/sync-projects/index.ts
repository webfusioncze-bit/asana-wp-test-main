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

    const { data: projects, error: projectsError } = await supabaseAdmin
      .from('projects')
      .select('id, name, import_source_url, last_sync_at')
      .eq('sync_enabled', true)
      .not('import_source_url', 'is', null);

    if (projectsError) {
      throw new Error(`Failed to fetch projects: ${projectsError.message}`);
    }

    console.log(`Found ${projects.length} projects to sync`);

    const results = [];

    for (const project of projects) {
      try {
        console.log(`Syncing project: ${project.name} (${project.id})`);
        
        const response = await fetch(project.import_source_url);
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const projectData = await response.json();
        const acf = projectData.acf;

        if (!acf) {
          throw new Error('Missing ACF data');
        }

        function stripHtmlTags(html: string | null): string | null {
          if (!html) return null;
          return html.replace(/<[^>]*>/g, '').trim();
        }

        function parseDate(dateStr: string | null): string | null {
          if (!dateStr) return null;
          if (dateStr.length === 8) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            return `${year}-${month}-${day}`;
          }
          return dateStr;
        }

        function normalizeStatus(status: string): string {
          const cleanStatus = stripHtmlTags(status)?.toLowerCase() || '';
          if (cleanStatus.includes('aktivní')) return 'aktivní';
          if (cleanStatus.includes('dokončen')) return 'dokončen';
          if (cleanStatus.includes('pozastaven')) return 'pozastaven';
          if (cleanStatus.includes('zruše')) return 'zrušen';
          if (cleanStatus.includes('klient')) return 'čeká se na klienta';
          return 'aktivní';
        }

        function normalizePhaseStatus(status: string): string {
          const cleanStatus = stripHtmlTags(status)?.toLowerCase() || '';
          if (cleanStatus.includes('probíhá')) return 'fáze probíhá';
          if (cleanStatus.includes('dokončen')) return 'dokončena';
          if (cleanStatus.includes('zruše')) return 'zrušena';
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

        const projectUpdate = {
          name: stripHtmlTags(acf.nazev_projektu) || projectData.title?.rendered || project.name,
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
          last_sync_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabaseAdmin
          .from('projects')
          .update(projectUpdate)
          .eq('id', project.id);

        if (updateError) {
          throw new Error(`Failed to update project: ${updateError.message}`);
        }

        const { data: existingPhases } = await supabaseAdmin
          .from('project_phases')
          .select('id, position, external_operator_id, name')
          .eq('project_id', project.id)
          .order('position');

        const phases = acf.faze_projektu || [];
        console.log(`Project has ${phases.length} phases in API, ${existingPhases?.length || 0} phases in DB`);
        let phasesUpdated = 0;
        let timeEntriesAdded = 0;

        for (let i = 0; i < phases.length; i++) {
          const phase = phases[i];
          const existingPhase = existingPhases?.[i];

          const phaseData: any = {
            name: phase.nazev_faze || `Fáze ${i + 1}`,
            description: stripHtmlTags(phase.popis_faze),
            status: normalizePhaseStatus(phase.stav_faze || ''),
            estimated_hours: phase.hodinovy_rozpocet || 0,
            hour_budget: phase.hodinovy_rozpocet || 0,
            hourly_rate: phase.hodinova_sazba_operatora || null,
            notes: stripHtmlTags(phase.zapisky),
          };

          if (phase.operator_faze) {
            phaseData.external_operator_id = String(phase.operator_faze);
          }

          if (existingPhase) {
            const { error: phaseError } = await supabaseAdmin
              .from('project_phases')
              .update(phaseData)
              .eq('id', existingPhase.id);

            if (!phaseError) {
              phasesUpdated++;

              const { data: phaseWithUser } = await supabaseAdmin
                .from('project_phases')
                .select('assigned_user_id')
                .eq('id', existingPhase.id)
                .single();

              const { data: existingEntries } = await supabaseAdmin
                .from('project_time_entries')
                .select('entry_date, hours, description')
                .eq('phase_id', existingPhase.id);

              const existingEntriesSet = new Set(
                existingEntries?.map(e => `${e.entry_date}|${e.hours}|${e.description}`) || []
              );

              const timeEntries = phase.polozkovy_vykaz || [];
              console.log(`Phase "${phaseData.name}": ${timeEntries.length} time entries from API, ${existingEntries?.length || 0} existing in DB`);

              for (const entry of timeEntries) {
                const entryDate = parseDate(entry.datum);
                const hours = Number(entry.pocet_hodin) || 0;
                const description = entry.cinnost || 'Importovaná činnost';

                if (hours > 0 && entryDate) {
                  const entryKey = `${entryDate}|${hours}|${description}`;

                  if (!existingEntriesSet.has(entryKey)) {
                    const timeEntryInsert: any = {
                      phase_id: existingPhase.id,
                      description: description,
                      hours: hours,
                      entry_date: entryDate,
                      visible_to_client: !entry.vidi_klient || !entry.vidi_klient.includes('nevidi'),
                    };

                    if (phaseWithUser?.assigned_user_id) {
                      timeEntryInsert.user_id = phaseWithUser.assigned_user_id;
                    }

                    const { error: timeError } = await supabaseAdmin
                      .from('project_time_entries')
                      .insert(timeEntryInsert);

                    if (!timeError) {
                      timeEntriesAdded++;
                      console.log(`  ✓ Added time entry: ${entryDate} - ${hours}h - ${description}`);
                    } else {
                      console.error(`  ✗ Failed to add time entry: ${timeError.message}`);
                    }
                  }
                }
              }
            }
          } else {
            phaseData.project_id = project.id;
            phaseData.position = i + 1;

            const { data: newPhase, error: phaseError } = await supabaseAdmin
              .from('project_phases')
              .insert(phaseData)
              .select('id, assigned_user_id')
              .single();

            if (!phaseError && newPhase) {
              phasesUpdated++;
              console.log(`  ✓ Created new phase: "${phaseData.name}"`);

              const timeEntries = phase.polozkovy_vykaz || [];
              console.log(`New phase "${phaseData.name}": ${timeEntries.length} time entries from API`);

              for (const entry of timeEntries) {
                const entryDate = parseDate(entry.datum);
                const hours = Number(entry.pocet_hodin) || 0;
                const description = entry.cinnost || 'Importovaná činnost';

                if (hours > 0 && entryDate) {
                  const timeEntryInsert: any = {
                    phase_id: newPhase.id,
                    description: description,
                    hours: hours,
                    entry_date: entryDate,
                    visible_to_client: !entry.vidi_klient || !entry.vidi_klient.includes('nevidi'),
                  };

                  if (newPhase.assigned_user_id) {
                    timeEntryInsert.user_id = newPhase.assigned_user_id;
                  }

                  const { error: timeError } = await supabaseAdmin
                    .from('project_time_entries')
                    .insert(timeEntryInsert);

                  if (!timeError) {
                    timeEntriesAdded++;
                    console.log(`  ✓ Added time entry: ${entryDate} - ${hours}h - ${description}`);
                  } else {
                    console.error(`  ✗ Failed to add time entry: ${timeError.message}`);
                  }
                }
              }
            } else if (phaseError) {
              console.error(`  ✗ Failed to create phase: ${phaseError.message}`);
            }
          }
        }

        results.push({
          projectId: project.id,
          projectName: project.name,
          success: true,
          phasesUpdated,
          timeEntriesAdded,
        });

        console.log(`Synced ${project.name}: ${phasesUpdated} phases, ${timeEntriesAdded} new time entries`);
      } catch (error) {
        console.error(`Failed to sync project ${project.name}:`, error);
        results.push({
          projectId: project.id,
          projectName: project.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedProjects: results.filter(r => r.success).length,
        failedProjects: results.filter(r => !r.success).length,
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