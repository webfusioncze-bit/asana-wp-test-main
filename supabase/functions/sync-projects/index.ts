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

    const url = new URL(req.url);
    const batchSize = parseInt(url.searchParams.get('batch_size') || '5');
    const delayMs = parseInt(url.searchParams.get('delay_ms') || '2000');
    const syncIntervalMinutes = parseInt(url.searchParams.get('sync_interval') || '5');

    const syncThreshold = new Date(Date.now() - syncIntervalMinutes * 60 * 1000).toISOString();

    const { data: projects, error: projectsError } = await supabaseAdmin
      .from('projects')
      .select('id, name, import_source_url, last_sync_at')
      .eq('sync_enabled', true)
      .not('import_source_url', 'is', null)
      .or(`last_sync_at.is.null,last_sync_at.lt.${syncThreshold}`)
      .order('last_sync_at', { ascending: true, nullsFirst: true })
      .limit(batchSize);

    if (projectsError) {
      throw new Error(`Failed to fetch projects: ${projectsError.message}`);
    }

    console.log(`Found ${projects.length} projects to sync (batch size: ${batchSize}, threshold: ${syncThreshold})`);

    if (projects.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No projects need synchronization at this time',
          syncedProjects: 0,
          failedProjects: 0,
          totalProjectsInBatch: 0,
          remainingProjects: 0,
          batchSize,
          delayMs,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const results = [];
    const startTime = Date.now();
    const maxExecutionTime = 50000;

    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];

      if (Date.now() - startTime > maxExecutionTime) {
        console.log(`Execution time limit reached, stopping after ${i} projects`);
        break;
      }
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

          if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            return `${year}-${month}-${day}`;
          }

          if (dateStr.includes('.')) {
            const parts = dateStr.split('.');
            if (parts.length === 3) {
              const day = parts[0].padStart(2, '0');
              const month = parts[1].padStart(2, '0');
              const year = parts[2];
              return `${year}-${month}-${day}`;
            }
          }

          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
          }

          console.warn(`Unknown date format: ${dateStr}`);
          return null;
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
          .select('id, external_operator_id, assigned_user_id')
          .eq('project_id', project.id);

        const operatorUserMap = new Map<string, string>();
        existingPhases?.forEach(phase => {
          if (phase.external_operator_id && phase.assigned_user_id) {
            operatorUserMap.set(phase.external_operator_id, phase.assigned_user_id);
          }
        });

        console.log(`Saved ${operatorUserMap.size} operator→user mappings`);

        const { error: deleteError } = await supabaseAdmin
          .from('project_phases')
          .delete()
          .eq('project_id', project.id);

        if (deleteError) {
          console.error(`Failed to delete phases: ${deleteError.message}`);
        } else {
          console.log(`Deleted ${existingPhases?.length || 0} existing phases and their time entries`);
        }

        const phases = acf.faze_projektu || [];
        console.log(`Re-importing ${phases.length} phases from API`);
        let phasesCreated = 0;
        let timeEntriesAdded = 0;

        for (let i = 0; i < phases.length; i++) {
          const phase = phases[i];

          const phaseData: any = {
            project_id: project.id,
            position: i + 1,
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
            const savedUserId = operatorUserMap.get(String(phase.operator_faze));
            if (savedUserId) {
              phaseData.assigned_user_id = savedUserId;
            }
          }

          const { data: newPhase, error: phaseError } = await supabaseAdmin
            .from('project_phases')
            .insert(phaseData)
            .select('id, assigned_user_id')
            .single();

          if (!phaseError && newPhase) {
            phasesCreated++;
            console.log(`  ✓ Created phase: "${phaseData.name}"`);

            const timeEntries = phase.polozkovy_vykaz || [];
            console.log(`  Importing ${timeEntries.length} time entries for phase "${phaseData.name}"`);

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
                } else {
                  console.error(`  ✗ Failed to add time entry: ${timeError.message}`);
                }
              }
            }
          } else if (phaseError) {
            console.error(`  ✗ Failed to create phase: ${phaseError.message}`);
          }
        }

        results.push({
          projectId: project.id,
          projectName: project.name,
          success: true,
          phasesCreated,
          timeEntriesAdded,
        });

        console.log(`Re-imported ${project.name}: ${phasesCreated} phases, ${timeEntriesAdded} time entries`);
      } catch (error) {
        console.error(`Failed to sync project ${project.name}:`, error);
        results.push({
          projectId: project.id,
          projectName: project.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      if (i < projects.length - 1) {
        console.log(`Waiting ${delayMs}ms before next project...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    const executionTime = Date.now() - startTime;
    const { count: totalPendingProjects } = await supabaseAdmin
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('sync_enabled', true)
      .not('import_source_url', 'is', null)
      .or(`last_sync_at.is.null,last_sync_at.lt.${syncThreshold}`);

    return new Response(
      JSON.stringify({
        success: true,
        syncedProjects: results.filter(r => r.success).length,
        failedProjects: results.filter(r => !r.success).length,
        totalProjectsInBatch: projects.length,
        remainingProjects: (totalPendingProjects || 0) - projects.length,
        executionTimeMs: executionTime,
        batchSize,
        delayMs,
        syncIntervalMinutes,
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